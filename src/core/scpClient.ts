import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import SftpClient from 'ssh2-sftp-client';
import { getConfig } from '../config';
import { LogFile, ServerConfig } from '../types';
import { ConnectionPool } from './connectionPool';

const DEFAULT_TEXT_FILE_EXTENSIONS = [
    '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.jsx', '.tsx',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php',
    '.sh', '.bash', '.zsh', '.yml', '.yaml', '.toml', '.ini', '.conf', '.cfg',
    '.sql', '.vue', '.svelte', '.scss', '.sass', '.less', '.env', '.gitignore',
    '.dockerignore', '.editorconfig', '.eslintrc', '.prettierrc', '.babelrc',
    '.properties', '.gradle', '.m', '.swift', '.kt', '.scala', '.lua', '.pl',
    '.r', '.rmd', '.csv', '.tsv', '.log', '.awk', '.sed'
];

const DEFAULT_TEXT_FILE_NAMES = [
    '.gitignore', '.dockerignore', '.editorconfig', '.eslintrc', '.prettierrc',
    '.babelrc', 'license', 'readme', 'changelog', 'makefile', 'dockerfile',
    'vagrantfile', 'gemfile', 'rakefile', 'procfile'
];

function isTextFile(filePath: string, customExtensions?: string[]): boolean {
    const ext = path.extname(filePath).toLowerCase();
    
    const allExtensions = customExtensions 
        ? [...DEFAULT_TEXT_FILE_EXTENSIONS, ...customExtensions.map(e => e.toLowerCase())]
        : DEFAULT_TEXT_FILE_EXTENSIONS;
    
    if (allExtensions.includes(ext)) {
        return true;
    }
    
    const fileName = path.basename(filePath).toLowerCase();
    if (DEFAULT_TEXT_FILE_NAMES.some(name => fileName === name || fileName.startsWith(name + '.'))) {
        return true;
    }
    return false;
}

function convertCrlfToLf(content: Buffer): Buffer {
    const text = content.toString('utf8');
    const converted = text.replace(/\r\n/g, '\n');
    return Buffer.from(converted, 'utf8');
}

export class SCPClient {
    private serverConfig: ServerConfig | null = null;
    private usePool: boolean = true;
    private standaloneClient: SftpClient | null = null;

    constructor(serverConfig?: ServerConfig, usePool: boolean = true) {
        this.serverConfig = serverConfig || null;
        this.usePool = usePool;
    }

    private getServerConfig(): ServerConfig {
        if (this.serverConfig) {
            return this.serverConfig;
        }
        const config = getConfig();
        if (config.projects && config.projects.length > 0 && config.projects[0].enabled !== false) {
            return config.projects[0].server;
        }
        throw new Error('未配置服务器信息');
    }

    async connect(): Promise<SftpClient> {
        const serverConfig = this.getServerConfig();

        if (this.usePool) {
            return ConnectionPool.getInstance().getConnection(serverConfig);
        }

        if (this.standaloneClient) {
            return this.standaloneClient;
        }

        const sftpConfig: SftpClient.ConnectOptions = {
            host: serverConfig.host,
            port: serverConfig.port,
            username: serverConfig.username,
            readyTimeout: 30000
        };

        if (serverConfig.privateKeyPath && fs.existsSync(serverConfig.privateKeyPath)) {
            sftpConfig.privateKey = fs.readFileSync(serverConfig.privateKeyPath);
        } else if (serverConfig.password) {
            sftpConfig.password = serverConfig.password;
        } else {
            throw new Error('未配置 SSH 认证方式（密码或私钥）');
        }

        this.standaloneClient = new SftpClient();
        await this.standaloneClient.connect(sftpConfig);
        return this.standaloneClient;
    }

    async disconnect(): Promise<void> {
        if (this.usePool) {
            return;
        }

        if (this.standaloneClient) {
            await this.standaloneClient.end();
            this.standaloneClient = null;
        }
    }

    async getSftp(): Promise<SftpClient> {
        return this.connect();
    }

    async uploadFile(localPath: string, remotePath?: string): Promise<string> {
        const serverConfig = this.getServerConfig();
        const sftp = await this.connect();
        const config = getConfig();

        const fileName = path.basename(localPath);
        
        if (!remotePath) {
            if (!serverConfig.remoteDirectory) {
                throw new Error('未配置 remoteDirectory，无法上传文件');
            }
            remotePath = path.posix.join(serverConfig.remoteDirectory, fileName);
        }

        const remoteDir = path.posix.dirname(remotePath);
        try {
            await sftp.mkdir(remoteDir, true);
        } catch {
        }

        if (isTextFile(localPath, config.textFileExtensions)) {
            const content = fs.readFileSync(localPath);
            const convertedContent = convertCrlfToLf(content);
            await sftp.put(convertedContent, remotePath);
        } else {
            await sftp.fastPut(localPath, remotePath);
        }
        return remotePath;
    }

    async downloadFile(remotePath: string, localPath?: string): Promise<string> {
        const config = getConfig();
        const sftp = await this.connect();

        const fileName = path.basename(remotePath);
        
        let downloadPath = '';
        if (localPath) {
            downloadPath = localPath;
        } else {
            if (config.projects && config.projects.length > 0) {
                for (const project of config.projects) {
                    if (project.enabled !== false && project.logs && project.logs.downloadPath) {
                        downloadPath = path.join(project.logs.downloadPath, fileName);
                        break;
                    }
                }
            }
            if (!downloadPath) {
                throw new Error('未配置日志下载路径');
            }
        }

        const localDir = path.dirname(downloadPath);
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        await sftp.fastGet(remotePath, downloadPath);
        return downloadPath;
    }

    async listDirectory(remotePath: string): Promise<LogFile[]> {
        const sftp = await this.connect();
        const items = await sftp.list(remotePath);
        
        return items.map(item => ({
            name: item.name,
            path: path.posix.join(remotePath, item.name),
            size: item.size,
            modifiedTime: new Date(item.modifyTime),
            isDirectory: item.type === 'd'
        }));
    }

    async ensureRemoteDirectory(remotePath: string): Promise<void> {
        const sftp = await this.connect();
        try {
            await sftp.mkdir(remotePath, true);
        } catch {
        }
    }

    async downloadDirectory(remotePath: string, localPath: string): Promise<string> {
        const sftp = await this.connect();
        
        if (!fs.existsSync(localPath)) {
            fs.mkdirSync(localPath, { recursive: true });
        }

        const items = await sftp.list(remotePath);
        
        for (const item of items) {
            const itemRemotePath = path.posix.join(remotePath, item.name);
            const itemLocalPath = path.join(localPath, item.name);
            
            if (item.type === 'd') {
                await this.downloadDirectory(itemRemotePath, itemLocalPath);
            } else {
                const localDir = path.dirname(itemLocalPath);
                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }
                await sftp.fastGet(itemRemotePath, itemLocalPath);
            }
        }
        
        return localPath;
    }

    async downloadFileOrDirectory(remotePath: string, localPath: string): Promise<string> {
        const sftp = await this.connect();
        
        let isDirectory = false;
        try {
            const stat = await sftp.stat(remotePath);
            isDirectory = stat.isDirectory;
        } catch {
            throw new Error(`远程路径不存在: ${remotePath}`);
        }

        if (isDirectory) {
            return this.downloadDirectory(remotePath, localPath);
        } else {
            const localDir = path.dirname(localPath);
            if (!fs.existsSync(localDir)) {
                fs.mkdirSync(localDir, { recursive: true });
            }
            await sftp.fastGet(remotePath, localPath);
            return localPath;
        }
    }
}

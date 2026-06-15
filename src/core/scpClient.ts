import * as fs from 'fs';
import * as path from 'path';
import SftpClient from 'ssh2-sftp-client';
import { getConfig } from '../config';
import { LogFile, ProjectConfig, ServerConfig } from '../types';
import { ConnectionPool } from './connectionPool';
import { createSSHAuthConfig } from '../utils/auth';
import { isTextFile, convertCrlfToLf } from '../pure/textFile';


export class SCPClient {
    private serverConfig: ServerConfig | null = null;
    private projectConfig: ProjectConfig | null = null;
    private usePool: boolean = true;
    private standaloneClient: SftpClient | null = null;
    private static operationLocks: Map<string, Promise<void>> = new Map();

    constructor(serverConfig?: ServerConfig, usePool: boolean = true, projectConfig?: ProjectConfig) {
        this.serverConfig = serverConfig || null;
        this.usePool = usePool;
        this.projectConfig = projectConfig || null;
    }

    private getServerKey(): string {
        if (!this.serverConfig) {
            return 'unknown';
        }
        return `${this.serverConfig.host}:${this.serverConfig.port}:${this.serverConfig.username}`;
    }

    private async withLock<T>(fn: () => Promise<T>): Promise<T> {
        const key = this.getServerKey();
        const previousLock = SCPClient.operationLocks.get(key) || Promise.resolve();

        let releaseLock!: () => void;
        const currentLock = new Promise<void>(resolve => {
            releaseLock = resolve;
        });

        SCPClient.operationLocks.set(key, currentLock);

        try {
            await previousLock;
            return await fn();
        } finally {
            releaseLock();
        }
    }

    async connect(): Promise<SftpClient> {
        if (!this.serverConfig) {
            throw new Error('未指定服务器配置，无法建立 SFTP 连接');
        }
        const serverConfig = this.serverConfig;

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

        const authConfig = createSSHAuthConfig(serverConfig);
        Object.assign(sftpConfig, authConfig);

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
        return this.withLock(async () => {
            if (!this.serverConfig) {
                throw new Error('未指定服务器配置，无法上传文件');
            }
            const serverConfig = this.serverConfig;
            const sftp = await this.connect();
            const config = getConfig();

            const projectExtensions = this.projectConfig?.textFileExtensions;
            const globalExtensions = config.textFileExtensions;
            const mergedExtensions = [
                ...(projectExtensions || []),
                ...(globalExtensions || [])
            ];

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

            if (isTextFile(localPath, mergedExtensions.length > 0 ? mergedExtensions : undefined)) {
                const content = fs.readFileSync(localPath);
                const convertedContent = convertCrlfToLf(content);
                await sftp.put(convertedContent, remotePath);
            } else {
                await sftp.fastPut(localPath, remotePath);
            }
            return remotePath;
        });
    }

    async downloadFile(remotePath: string, localPath?: string): Promise<string> {
        return this.withLock(async () => {
            const sftp = await this.connect();

            const fileName = path.basename(remotePath);
            
            let downloadPath = '';
            if (localPath) {
                downloadPath = localPath;
            } else {
                if (this.projectConfig && this.projectConfig.logs && this.projectConfig.logs.downloadPath) {
                    downloadPath = path.join(this.projectConfig.logs.downloadPath, fileName);
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
        });
    }

    async listDirectory(remotePath: string): Promise<LogFile[]> {
        return this.withLock(async () => {
            const sftp = await this.connect();
            const items = await sftp.list(remotePath);
            
            return items.map(item => ({
                name: item.name,
                path: path.posix.join(remotePath, item.name),
                size: item.size,
                modifiedTime: new Date(item.modifyTime),
                isDirectory: item.type === 'd'
            }));
        });
    }

    async ensureRemoteDirectory(remotePath: string): Promise<void> {
        return this.withLock(async () => {
            const sftp = await this.connect();
            try {
                await sftp.mkdir(remotePath, true);
            } catch {
            }
        });
    }

    async downloadDirectory(remotePath: string, localPath: string): Promise<string> {
        return this.withLock(async () => {
            const sftp = await this.connect();
            
            if (!fs.existsSync(localPath)) {
                fs.mkdirSync(localPath, { recursive: true });
            }

            const items = await sftp.list(remotePath);
            
            for (const item of items) {
                const itemRemotePath = path.posix.join(remotePath, item.name);
                const itemLocalPath = path.join(localPath, item.name);
                
                if (item.type === 'd') {
                    await this.downloadDirectoryInner(sftp, itemRemotePath, itemLocalPath);
                } else {
                    const localDir = path.dirname(itemLocalPath);
                    if (!fs.existsSync(localDir)) {
                        fs.mkdirSync(localDir, { recursive: true });
                    }
                    await sftp.fastGet(itemRemotePath, itemLocalPath);
                }
            }
            
            return localPath;
        });
    }

    private async downloadDirectoryInner(sftp: SftpClient, remotePath: string, localPath: string): Promise<void> {
        if (!fs.existsSync(localPath)) {
            fs.mkdirSync(localPath, { recursive: true });
        }

        const items = await sftp.list(remotePath);
        
        for (const item of items) {
            const itemRemotePath = path.posix.join(remotePath, item.name);
            const itemLocalPath = path.join(localPath, item.name);
            
            if (item.type === 'd') {
                await this.downloadDirectoryInner(sftp, itemRemotePath, itemLocalPath);
            } else {
                const localDir = path.dirname(itemLocalPath);
                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }
                await sftp.fastGet(itemRemotePath, itemLocalPath);
            }
        }
    }

    async downloadFileOrDirectory(remotePath: string, localPath: string): Promise<string> {
        return this.withLock(async () => {
            const sftp = await this.connect();
            
            let isDirectory = false;
            try {
                const stat = await sftp.stat(remotePath);
                isDirectory = stat.isDirectory;
            } catch {
                throw new Error(`远程路径不存在: ${remotePath}`);
            }

            if (isDirectory) {
                return this.downloadDirectoryInner(sftp, remotePath, localPath).then(() => localPath);
            } else {
                const localDir = path.dirname(localPath);
                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }
                await sftp.fastGet(remotePath, localPath);
                return localPath;
            }
        });
    }
}

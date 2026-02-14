import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import SftpClient from 'ssh2-sftp-client';
import { getConfig } from '../config';
import { LogFile } from '../types';

export class SCPClient {
    private sftp: SftpClient | null = null;

    async connect(): Promise<SftpClient> {
        if (this.sftp) {
            return this.sftp;
        }

        const config = getConfig();
        const sftpConfig: SftpClient.ConnectOptions = {
            host: config.server.host,
            port: config.server.port,
            username: config.server.username,
            readyTimeout: 30000
        };

        if (config.server.privateKeyPath && fs.existsSync(config.server.privateKeyPath)) {
            sftpConfig.privateKey = fs.readFileSync(config.server.privateKeyPath);
        } else if (config.server.password) {
            sftpConfig.password = config.server.password;
        } else {
            throw new Error('未配置 SSH 认证方式（密码或私钥）');
        }

        this.sftp = new SftpClient();
        await this.sftp.connect(sftpConfig);
        return this.sftp;
    }

    async disconnect(): Promise<void> {
        if (this.sftp) {
            await this.sftp.end();
            this.sftp = null;
        }
    }

    async uploadFile(localPath: string, remotePath?: string): Promise<string> {
        const config = getConfig();
        const sftp = await this.connect();

        const fileName = path.basename(localPath);
        const remote = remotePath || path.posix.join(config.server.remoteDirectory, fileName);

        const remoteDir = path.posix.dirname(remote);
        try {
            await sftp.mkdir(remoteDir, true);
        } catch {
            // 目录可能已存在
        }

        await sftp.fastPut(localPath, remote);
        return remote;
    }

    async downloadFile(remotePath: string, localPath?: string): Promise<string> {
        const config = getConfig();
        const sftp = await this.connect();

        const fileName = path.basename(remotePath);
        const local = localPath || path.join(config.logs.downloadPath, fileName);

        const localDir = path.dirname(local);
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }

        await sftp.fastGet(remotePath, local);
        return local;
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
            // 目录可能已存在
        }
    }
}

export async function uploadFile(localPath: string, remotePath?: string): Promise<string> {
    const scpClient = new SCPClient();
    try {
        const result = await scpClient.uploadFile(localPath, remotePath);
        return result;
    } finally {
        await scpClient.disconnect();
    }
}

export async function downloadFile(remotePath: string, localPath?: string): Promise<string> {
    const scpClient = new SCPClient();
    try {
        const result = await scpClient.downloadFile(remotePath, localPath);
        return result;
    } finally {
        await scpClient.disconnect();
    }
}

export async function listDirectory(remotePath: string): Promise<LogFile[]> {
    const scpClient = new SCPClient();
    try {
        return await scpClient.listDirectory(remotePath);
    } finally {
        await scpClient.disconnect();
    }
}

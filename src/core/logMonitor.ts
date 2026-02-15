import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config';
import { downloadFile, listDirectory } from './scpClient';
import { LogFile, LogDirectoryConfig } from '../types';

export class LogMonitor {
    private refreshInterval: number = 5000;
    private monitorTimer: ReturnType<typeof setInterval> | null = null;
    private onLogFilesChange: ((files: Map<string, LogFile[]>) => void) | null = null;
    private logFilesCache: Map<string, LogFile[]> = new Map();

    constructor() {
        this.updateRefreshInterval();
    }

    private updateRefreshInterval(): void {
        const config = getConfig();
        this.refreshInterval = config.logs.refreshInterval;
    }

    getRefreshInterval(): number {
        return this.refreshInterval;
    }

    isAutoRefreshEnabled(): boolean {
        return this.refreshInterval > 0;
    }

    getDirectories(): LogDirectoryConfig[] {
        const config = getConfig();
        return config.logs.directories || [];
    }

    async fetchDirectoryContents(dirPath: string): Promise<LogFile[]> {
        try {
            const items = await listDirectory(dirPath);
            return items.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) {
                    return a.isDirectory ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
        } catch (error: any) {
            console.error(`[LogMonitor] 获取目录 ${dirPath} 内容失败:`, error.message);
            return [];
        }
    }

    async fetchAllDirectories(): Promise<Map<string, LogFile[]>> {
        const directories = this.getDirectories();
        const results = new Map<string, LogFile[]>();

        for (const dir of directories) {
            const files = await this.fetchDirectoryContents(dir.path);
            results.set(dir.path, files);
            this.logFilesCache.set(dir.path, files);
        }

        return results;
    }

    startMonitoring(onChange: (files: Map<string, LogFile[]>) => void): void {
        this.onLogFilesChange = onChange;
        
        this.fetchAllDirectories().then(files => {
            onChange(files);
        });

        if (this.isAutoRefreshEnabled()) {
            this.monitorTimer = setInterval(async () => {
                const files = await this.fetchAllDirectories();
                if (this.onLogFilesChange) {
                    this.onLogFilesChange(files);
                }
            }, this.refreshInterval);
        }
    }

    stopMonitoring(): void {
        if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
            this.monitorTimer = null;
        }
    }

    async downloadLog(logFile: LogFile): Promise<string> {
        const config = getConfig();
        const downloadPath = config.logs.downloadPath;
        
        if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
        }

        const localPath = path.join(downloadPath, logFile.name);

        try {
            await downloadFile(logFile.path, localPath);
            return localPath;
        } catch (error: any) {
            throw new Error(`下载日志失败: ${error.message}`);
        }
    }

    async downloadLogWithProgress(logFile: LogFile): Promise<string> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '下载日志',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `正在下载 ${logFile.name}...` });
            const localPath = await this.downloadLog(logFile);
            vscode.window.showInformationMessage(`日志已下载到: ${localPath}`);
            return localPath;
        });
    }

    getLogFiles(dirPath: string): LogFile[] {
        return this.logFilesCache.get(dirPath) || [];
    }
}

export function formatSize(bytes: number): string {
    if (!bytes || bytes < 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

export function formatDate(date: Date): string {
    try {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        return `${year}/${month}/${day} ${hour}:${minute}`;
    } catch {
        return '';
    }
}

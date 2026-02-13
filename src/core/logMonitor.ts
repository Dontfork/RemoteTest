import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { getConfig } from '../config';
import { LogFile } from '../types';

export class LogMonitor {
    private logFiles: LogFile[] = [];
    private refreshInterval: number = 5000;
    private monitorTimer: ReturnType<typeof setInterval> | null = null;
    private onLogFilesChange: ((files: LogFile[]) => void) | null = null;

    constructor() {
        const config = getConfig();
        this.refreshInterval = config.logs.refreshInterval;
    }

    async fetchLogFiles(): Promise<LogFile[]> {
        const config = getConfig();

        try {
            const response = await axios.get(`${config.server.executeCommand}/logs`, {
                timeout: 10000
            });
            
            if (response.data && Array.isArray(response.data)) {
                this.logFiles = response.data.map((item: any) => ({
                    name: item.name,
                    path: item.path,
                    size: item.size || 0,
                    modifiedTime: new Date(item.modifiedTime || Date.now())
                }));
            }
        } catch {
            const logDir = config.logs.monitorDirectory;
            if (fs.existsSync(logDir)) {
                const files = fs.readdirSync(logDir);
                this.logFiles = files
                    .filter(file => file.endsWith('.log'))
                    .map(file => {
                        const filePath = path.join(logDir, file);
                        const stats = fs.statSync(filePath);
                        return {
                            name: file,
                            path: filePath,
                            size: stats.size,
                            modifiedTime: stats.mtime
                        };
                    });
            }
        }

        return this.logFiles;
    }

    startMonitoring(onChange: (files: LogFile[]) => void): void {
        this.onLogFilesChange = onChange;
        
        this.fetchLogFiles().then(files => {
            onChange(files);
        });

        this.monitorTimer = setInterval(async () => {
            const files = await this.fetchLogFiles();
            if (this.onLogFilesChange) {
                this.onLogFilesChange(files);
            }
        }, this.refreshInterval);
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
            const response = await axios.get(`${config.server.executeCommand}/logs/download`, {
                params: { path: logFile.path },
                responseType: 'arraybuffer',
                timeout: 30000
            });

            fs.writeFileSync(localPath, response.data);
            return localPath;
        } catch {
            if (fs.existsSync(logFile.path)) {
                fs.copyFileSync(logFile.path, localPath);
                return localPath;
            }
            throw new Error('无法下载日志文件');
        }
    }

    async downloadSelectedLog(): Promise<string | null> {
        const files = await this.fetchLogFiles();
        
        if (files.length === 0) {
            vscode.window.showInformationMessage('没有可下载的日志文件');
            return null;
        }

        const selected = await vscode.window.showQuickPick(
            files.map(f => ({
                label: f.name,
                description: `${formatSize(f.size)} | ${formatDate(f.modifiedTime)}`
            })),
            { placeHolder: '选择要下载的日志文件' }
        );

        if (!selected) {
            return null;
        }

        const logFile = files.find(f => f.name === selected.label);
        if (!logFile) {
            return null;
        }

        const localPath = await this.downloadLog(logFile);
        vscode.window.showInformationMessage(`日志已下载到: ${localPath}`);
        
        return localPath;
    }

    getLogFiles(): LogFile[] {
        return this.logFiles;
    }
}

function formatSize(bytes: number): string {
    if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(date: Date): string {
    try {
        return new Date(date).toLocaleString('zh-CN');
    } catch {
        return '';
    }
}

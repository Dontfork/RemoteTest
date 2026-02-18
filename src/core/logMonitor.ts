import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig, getEnabledProjects, getAllLogDirectories, getRefreshInterval } from '../config';
import { SCPClient } from './scpClient';
import { ConnectionPool } from './connectionPool';
import { LogFile, LogDirectoryConfig, ProjectConfig, ServerConfig } from '../types';
import { getOutputChannelManager } from '../utils/outputChannel';

function log(message: string): void {
    const channel = getOutputChannelManager().getRemoteTestChannel();
    channel.info(`[LogMonitor] ${message}`);
}

export class LogMonitor {
    private monitorTimer: ReturnType<typeof setInterval> | null = null;
    private onLogFilesChange: ((files: Map<string, LogFile[]>) => void) | null = null;
    private logFilesCache: Map<string, LogFile[]> = new Map();
    private loadErrors: Map<string, string> = new Map();

    constructor() {}

    isAutoRefreshEnabled(): boolean {
        return getRefreshInterval() > 0;
    }

    getDirectories(): LogDirectoryConfig[] {
        const allDirs = getAllLogDirectories();
        return allDirs.map(item => item.directory);
    }

    getProjectForDirectory(dir: LogDirectoryConfig): ProjectConfig | null {
        const allDirs = getAllLogDirectories();
        const found = allDirs.find(item => item.directory.path === dir.path);
        return found ? found.project : null;
    }

    getLoadError(dirPath: string): string | null {
        return this.loadErrors.get(dirPath) || null;
    }

    private getServerConfig(project: ProjectConfig | null): ServerConfig {
        if (project) {
            return project.server;
        }
        const config = getConfig();
        if (config.projects && config.projects.length > 0 && config.projects[0].enabled !== false) {
            return config.projects[0].server;
        }
        throw new Error('未配置服务器信息');
    }

    async fetchDirectoryContents(dirPath: string, project: ProjectConfig | null = null): Promise<{ files: LogFile[]; error: string | null }> {
        try {
            const serverConfig = this.getServerConfig(project);
            const scpClient = new SCPClient(serverConfig, true);
            try {
                const items = await scpClient.listDirectory(dirPath);
                const sortedItems = items.sort((a, b) => {
                    if (a.isDirectory !== b.isDirectory) {
                        return a.isDirectory ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                });
                return { files: sortedItems, error: null };
            } finally {
                await scpClient.disconnect();
            }
        } catch (error: any) {
            const errorMsg = error.message || '未知错误';
            log(`加载目录 ${dirPath} 失败: ${errorMsg}`);
            return { files: [], error: errorMsg };
        }
    }

    async fetchAllDirectories(): Promise<Map<string, LogFile[]>> {
        const allDirs = getAllLogDirectories();
        const results = new Map<string, LogFile[]>();
        this.loadErrors.clear();

        log(`开始加载 ${allDirs.length} 个日志目录`);

        const dirsByServer = new Map<string, Array<{ dir: LogDirectoryConfig; project: ProjectConfig | null }>>();

        for (const item of allDirs) {
            const serverConfig = this.getServerConfig(item.project);
            const serverKey = `${serverConfig.host}:${serverConfig.port}:${serverConfig.username}`;
            
            if (!dirsByServer.has(serverKey)) {
                dirsByServer.set(serverKey, []);
            }
            dirsByServer.get(serverKey)!.push({
                dir: item.directory,
                project: item.project
            });
        }

        log(`共需连接 ${dirsByServer.size} 个服务器`);

        for (const [serverKey, dirs] of dirsByServer) {
            if (dirs.length === 0) continue;

            const serverConfig = this.getServerConfig(dirs[0].project);
            const scpClient = new SCPClient(serverConfig, true);

            try {
                for (const { dir, project } of dirs) {
                    const projectName = project ? project.name : '未知项目';
                    log(`加载目录: ${dir.path} (项目: ${projectName})`);
                    
                    try {
                        const items = await scpClient.listDirectory(dir.path);
                        const sortedItems = items.sort((a, b) => {
                            if (a.isDirectory !== b.isDirectory) {
                                return a.isDirectory ? -1 : 1;
                            }
                            return a.name.localeCompare(b.name);
                        });
                        results.set(dir.path, sortedItems);
                        this.logFilesCache.set(dir.path, sortedItems);
                        log(`目录 ${dir.path} 加载成功，共 ${sortedItems.length} 个文件`);
                    } catch (error: any) {
                        const errorMsg = error.message || '未知错误';
                        this.loadErrors.set(dir.path, errorMsg);
                        results.set(dir.path, []);
                        log(`目录 ${dir.path} 加载失败: ${errorMsg}`);
                    }

                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } finally {
                await scpClient.disconnect();
            }
        }

        log(`日志目录加载完成，成功: ${results.size - this.loadErrors.size}，失败: ${this.loadErrors.size}`);
        return results;
    }

    startMonitoring(onChange: (files: Map<string, LogFile[]>) => void): void {
        this.onLogFilesChange = onChange;
        
        this.fetchAllDirectories().then(files => {
            onChange(files);
        });

        this.startAutoRefresh();
    }

    private startAutoRefresh(): void {
        this.stopAutoRefresh();
        
        const interval = getRefreshInterval();
        if (interval > 0) {
            log(`启用自动刷新，间隔: ${interval}ms`);
            this.monitorTimer = setInterval(async () => {
                const files = await this.fetchAllDirectories();
                if (this.onLogFilesChange) {
                    this.onLogFilesChange(files);
                }
            }, interval);
        } else {
            log('自动刷新已禁用');
        }
    }

    private stopAutoRefresh(): void {
        if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
            this.monitorTimer = null;
        }
    }

    stopMonitoring(): void {
        this.stopAutoRefresh();
    }

    async downloadLog(logFile: LogFile, project: ProjectConfig | null = null): Promise<string> {
        let downloadPath: string;
        
        if (project && project.logs) {
            downloadPath = project.logs.downloadPath;
        } else {
            downloadPath = '';
        }
        
        if (!downloadPath) {
            throw new Error('未配置日志下载路径');
        }
        
        if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
        }

        const localPath = path.join(downloadPath, logFile.name);

        try {
            const serverConfig = this.getServerConfig(project);
            const scpClient = new SCPClient(serverConfig, true);
            await scpClient.downloadFile(logFile.path, localPath);
            await scpClient.disconnect();
            return localPath;
        } catch (error: any) {
            throw new Error(`下载日志失败: ${error.message}`);
        }
    }

    async downloadLogWithProgress(logFile: LogFile, project: ProjectConfig | null = null): Promise<string> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '下载日志',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `正在下载 ${logFile.name}...` });
            const localPath = await this.downloadLog(logFile, project);
            vscode.window.showInformationMessage(`日志已下载到: ${localPath}`);
            return localPath;
        });
    }

    getLogFiles(dirPath: string): LogFile[] {
        return this.logFilesCache.get(dirPath) || [];
    }

    refreshAfterCommand(project: ProjectConfig): void {
        this.fetchAllDirectories().then(files => {
            if (this.onLogFilesChange) {
                this.onLogFilesChange(files);
            }
        });
    }
}

export function formatSize(bytes: number): string {
    let result: string;
    if (!bytes || bytes < 0) {
        result = '0 B';
    } else if (bytes < 1024) {
        result = bytes + ' B';
    } else if (bytes < 1048576) {
        result = (bytes / 1024).toFixed(1) + ' KB';
    } else if (bytes < 1073741824) {
        result = (bytes / 1048576).toFixed(1) + ' MB';
    } else {
        result = (bytes / 1073741824).toFixed(2) + ' GB';
    }
    return result.padStart(8);
}

export function formatDate(date: Date): string {
    try {
        const d = new Date(date);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        return `${month}-${day} ${hour}:${minute}`;
    } catch {
        return '';
    }
}

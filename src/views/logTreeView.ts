import * as vscode from 'vscode';
import { LogMonitor } from '../core';
import { LogFile } from '../types';

export class LogTreeItem extends vscode.TreeItem {
    public logFile: LogFile | null;

    constructor(logFile: LogFile | null, errorMessage?: string) {
        if (logFile) {
            super(logFile.name, vscode.TreeItemCollapsibleState.None);
            this.logFile = logFile;
            this.description = `${formatSize(logFile.size)} | ${formatDate(logFile.modifiedTime)}`;
            this.tooltip = `路径: ${logFile.path}`;
            this.contextValue = 'logFile';
            this.iconPath = new vscode.ThemeIcon('file-text');
            this.command = {
                command: 'autotest.downloadLog',
                title: '下载日志',
                arguments: [this]
            };
        } else {
            super(errorMessage || '加载失败', vscode.TreeItemCollapsibleState.None);
            this.logFile = null;
            this.iconPath = new vscode.ThemeIcon('error');
            this.contextValue = 'error';
        }
    }
}

export class LogsTreeProvider implements vscode.TreeDataProvider<LogTreeItem> {
    private logMonitor: LogMonitor;
    private _onDidChangeTreeData = new vscode.EventEmitter<LogTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(logMonitor: LogMonitor) {
        this.logMonitor = logMonitor;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LogTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: LogTreeItem): Promise<LogTreeItem[]> {
        if (element) {
            return [];
        }
        
        try {
            const files = await this.logMonitor.fetchLogFiles();
            return files.map(file => new LogTreeItem(file));
        } catch (error: any) {
            return [new LogTreeItem(null, error.message)];
        }
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

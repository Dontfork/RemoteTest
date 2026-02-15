import * as vscode from 'vscode';
import { LogMonitor, formatSize, formatDate } from '../core';
import { LogFile, LogDirectoryConfig } from '../types';

export class LogTreeItem extends vscode.TreeItem {
    public logFile: LogFile | null;
    public directoryConfig: LogDirectoryConfig | null;

    constructor(
        item: LogFile | LogDirectoryConfig,
        isDirectory: boolean,
        isConfigDir: boolean = false
    ) {
        if (isConfigDir) {
            const dir = item as LogDirectoryConfig;
            super(dir.name, vscode.TreeItemCollapsibleState.Collapsed);
            this.directoryConfig = dir;
            this.logFile = null;
            this.contextValue = 'logDirectory';
            this.iconPath = new vscode.ThemeIcon('folder');
            this.tooltip = `路径: ${dir.path}`;
        } else if (isDirectory) {
            const file = item as LogFile;
            super(file.name, vscode.TreeItemCollapsibleState.Collapsed);
            this.logFile = file;
            this.directoryConfig = null;
            this.contextValue = 'logSubDirectory';
            this.iconPath = new vscode.ThemeIcon('folder');
            this.tooltip = `路径: ${file.path}`;
        } else {
            const file = item as LogFile;
            super(file.name, vscode.TreeItemCollapsibleState.None);
            this.logFile = file;
            this.directoryConfig = null;
            const sizeStr = formatSize(file.size);
            const dateStr = formatDate(file.modifiedTime);
            this.description = `${sizeStr.padEnd(10)} ${dateStr}`;
            this.tooltip = `路径: ${file.path}\n大小: ${formatSize(file.size)}\n修改时间: ${formatDate(file.modifiedTime)}`;
            this.contextValue = 'logFile';
            this.iconPath = new vscode.ThemeIcon('file-text');
            this.command = {
                command: 'autotest.downloadLog',
                title: '下载日志',
                arguments: [this]
            };
        }
    }
}

export class LogsTreeProvider implements vscode.TreeDataProvider<LogTreeItem> {
    private logMonitor: LogMonitor;
    private _onDidChangeTreeData = new vscode.EventEmitter<LogTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private directoryContents: Map<string, LogFile[]> = new Map();

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
        if (!element) {
            const directories = this.logMonitor.getDirectories();
            if (directories.length === 0) {
                return [this.createMessageItem('未配置日志目录，请检查配置文件')];
            }
            return directories.map(dir => new LogTreeItem(dir, true, true));
        }

        if (element.contextValue === 'logDirectory' && element.directoryConfig) {
            const contents = await this.logMonitor.fetchDirectoryContents(element.directoryConfig.path);
            this.directoryContents.set(element.directoryConfig.path, contents);
            return this.createLogItems(contents);
        }

        if (element.contextValue === 'logSubDirectory' && element.logFile) {
            const contents = await this.logMonitor.fetchDirectoryContents(element.logFile.path);
            this.directoryContents.set(element.logFile.path, contents);
            return this.createLogItems(contents);
        }

        return [];
    }

    private createLogItems(items: LogFile[]): LogTreeItem[] {
        if (items.length === 0) {
            return [this.createMessageItem('目录为空')];
        }
        return items.map(item => new LogTreeItem(item, item.isDirectory, false));
    }

    private createMessageItem(message: string): LogTreeItem {
        const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('info');
        item.contextValue = 'message';
        return item as LogTreeItem;
    }

    startMonitoring(): void {
        this.logMonitor.startMonitoring((files) => {
            this.directoryContents = files;
            this.refresh();
        });
    }

    stopMonitoring(): void {
        this.logMonitor.stopMonitoring();
    }
}

export class LogTreeView {
    private treeProvider: LogsTreeProvider;
    private treeView: vscode.TreeView<LogTreeItem>;
    private logMonitor: LogMonitor;

    constructor() {
        this.logMonitor = new LogMonitor();
        this.treeProvider = new LogsTreeProvider(this.logMonitor);
        this.treeView = vscode.window.createTreeView('autotestLogs', {
            treeDataProvider: this.treeProvider,
            showCollapseAll: true
        });
    }

    start(): void {
        this.treeProvider.startMonitoring();
    }

    stop(): void {
        this.treeProvider.stopMonitoring();
    }

    refresh(): void {
        this.treeProvider.refresh();
    }

    async downloadLog(item: LogTreeItem): Promise<void> {
        if (!item.logFile || item.logFile.isDirectory) {
            vscode.window.showWarningMessage('请选择一个日志文件进行下载');
            return;
        }

        try {
            await this.logMonitor.downloadLogWithProgress(item.logFile);
        } catch (error: any) {
            vscode.window.showErrorMessage(`下载失败: ${error.message}`);
        }
    }

    async openLogInEditor(item: LogTreeItem): Promise<void> {
        if (!item.logFile || item.logFile.isDirectory) {
            return;
        }

        try {
            const localPath = await this.logMonitor.downloadLog(item.logFile);
            const document = await vscode.workspace.openTextDocument(localPath);
            await vscode.window.showTextDocument(document);
        } catch (error: any) {
            vscode.window.showErrorMessage(`打开日志失败: ${error.message}`);
        }
    }
}

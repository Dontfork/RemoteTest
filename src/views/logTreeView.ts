import * as vscode from 'vscode';
import { LogMonitor, formatSize, formatDate } from '../core';
import { LogFile, LogDirectoryConfig, ProjectConfig } from '../types';
import { getEnabledProjects } from '../config';

export class LogTreeItem extends vscode.TreeItem {
    public logFile: LogFile | null;
    public directoryConfig: LogDirectoryConfig | null;
    public projectConfig: ProjectConfig | null;

    constructor(
        item: LogFile | LogDirectoryConfig,
        isDirectory: boolean,
        isConfigDir: boolean = false,
        project: ProjectConfig | null = null
    ) {
        if (isConfigDir) {
            const dir = item as LogDirectoryConfig;
            super(dir.name, vscode.TreeItemCollapsibleState.Collapsed);
            this.directoryConfig = dir;
            this.logFile = null;
            this.projectConfig = project;
            this.contextValue = 'logDirectory';
            this.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('list.foreground'));
            const projectInfo = project ? ` | 项目: ${project.name}` : '';
            this.tooltip = `路径: ${dir.path}${projectInfo}`;
            if (project) {
                this.description = `[${project.name}]`;
            }
        } else if (isDirectory) {
            const file = item as LogFile;
            super(file.name, vscode.TreeItemCollapsibleState.Collapsed);
            this.logFile = file;
            this.directoryConfig = null;
            this.projectConfig = project;
            this.contextValue = 'logSubDirectory';
            this.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('list.foreground'));
            this.tooltip = `路径: ${file.path}`;
        } else {
            const file = item as LogFile;
            const sizeStr = formatSize(file.size);
            const dateStr = formatDate(file.modifiedTime);
            super(`${dateStr.padEnd(11)}│${sizeStr}│ ${file.name}`, vscode.TreeItemCollapsibleState.None);
            this.logFile = file;
            this.directoryConfig = null;
            this.projectConfig = project;
            this.description = '';
            this.tooltip = `路径: ${file.path}\n大小: ${formatSize(file.size)}\n修改时间: ${formatDate(file.modifiedTime)}`;
            this.contextValue = 'logFile';
            this.iconPath = new vscode.ThemeIcon('output', new vscode.ThemeColor('list.foreground'));
            this.command = {
                command: 'RemoteTest.downloadLog',
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
            return directories.map(dir => {
                const project = this.logMonitor.getProjectForDirectory(dir);
                return new LogTreeItem(dir, true, true, project);
            });
        }

        if (element.contextValue === 'logDirectory' && element.directoryConfig) {
            const { files, error } = await this.logMonitor.fetchDirectoryContents(
                element.directoryConfig.path,
                element.projectConfig
            );
            this.directoryContents.set(element.directoryConfig.path, files);
            if (error) {
                return [this.createErrorItem(`加载失败: ${error}`)];
            }
            if (files.length === 0) {
                return [this.createMessageItem('目录为空')];
            }
            return files.map(item => new LogTreeItem(item, item.isDirectory, false, element.projectConfig));
        }

        if (element.contextValue === 'logSubDirectory' && element.logFile) {
            const { files, error } = await this.logMonitor.fetchDirectoryContents(
                element.logFile.path,
                element.projectConfig
            );
            this.directoryContents.set(element.logFile.path, files);
            if (error) {
                return [this.createErrorItem(`加载失败: ${error}`)];
            }
            if (files.length === 0) {
                return [this.createMessageItem('目录为空')];
            }
            return files.map(item => new LogTreeItem(item, item.isDirectory, false, element.projectConfig));
        }

        return [];
    }

    private createMessageItem(message: string): LogTreeItem {
        const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('info');
        item.contextValue = 'message';
        return item as LogTreeItem;
    }

    private createErrorItem(message: string): LogTreeItem {
        const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('error');
        item.contextValue = 'error';
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
        this.treeView = vscode.window.createTreeView('RemoteTestLogs', {
            treeDataProvider: this.treeProvider,
            showCollapseAll: true
        });
        vscode.commands.executeCommand('workbench.actions.treeView.RemoteTestLogs.collapseAll');
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
            await this.logMonitor.downloadLogWithProgress(item.logFile, item.projectConfig);
        } catch (error: any) {
            vscode.window.showErrorMessage(`下载失败: ${error.message}`);
        }
    }

    async openLogInEditor(item: LogTreeItem): Promise<void> {
        if (!item.logFile || item.logFile.isDirectory) {
            return;
        }

        try {
            const localPath = await this.logMonitor.downloadLog(item.logFile, item.projectConfig);
            const document = await vscode.workspace.openTextDocument(localPath);
            await vscode.window.showTextDocument(document);
        } catch (error: any) {
            vscode.window.showErrorMessage(`打开日志失败: ${error.message}`);
        }
    }
}

import * as vscode from 'vscode';
import { QuickCommandDetector } from '../core/quickCommandDetector';
import { QuickCommand, QuickCommandGroup } from '../types';
import { executeRemoteCommand } from '../core/sshClient';
import { getOutputChannelManager } from '../utils/outputChannel';
import { getConfig } from '../config';

export class QuickCommandItem extends vscode.TreeItem {
    public quickCommand: QuickCommand | null;
    public commandGroup: QuickCommandGroup | null;

    constructor(
        item: QuickCommand | QuickCommandGroup,
        isGroup: boolean
    ) {
        if (isGroup) {
            const group = item as QuickCommandGroup;
            super(group.projectName, vscode.TreeItemCollapsibleState.Collapsed);
            this.commandGroup = group;
            this.quickCommand = null;
            this.contextValue = 'quickCommandGroup';
            this.iconPath = new vscode.ThemeIcon('project');
            this.description = `${group.commands.length} 个命令`;
            this.tooltip = `项目: ${group.projectName}\n命令数量: ${group.commands.length}`;
        } else {
            const cmd = item as QuickCommand;
            super(cmd.name, vscode.TreeItemCollapsibleState.None);
            this.quickCommand = cmd;
            this.commandGroup = null;
            this.contextValue = 'quickCommand';
            this.iconPath = new vscode.ThemeIcon('terminal');
            this.description = '';
            this.tooltip = `命令: ${cmd.executeCommand}\n项目: ${cmd.projectName}`;
        }
    }
}

export class QuickCommandsTreeProvider implements vscode.TreeDataProvider<QuickCommandItem> {
    private detector: QuickCommandDetector;
    private _onDidChangeTreeData = new vscode.EventEmitter<QuickCommandItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private commandGroups: QuickCommandGroup[] = [];

    constructor(detector: QuickCommandDetector) {
        this.detector = detector;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: QuickCommandItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: QuickCommandItem): Promise<QuickCommandItem[]> {
        if (!element) {
            this.commandGroups = this.detector.getQuickCommands();
            
            if (this.commandGroups.length === 0) {
                return [this.createMessageItem('没有可用的快捷命令')];
            }
            
            return this.commandGroups.map(group => new QuickCommandItem(group, true));
        }

        if (element.contextValue === 'quickCommandGroup' && element.commandGroup) {
            return element.commandGroup.commands.map(cmd => new QuickCommandItem(cmd, false));
        }

        return [];
    }

    private createMessageItem(message: string): QuickCommandItem {
        const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('info');
        item.contextValue = 'message';
        return item as QuickCommandItem;
    }

    getCommandGroups(): QuickCommandGroup[] {
        return this.commandGroups;
    }
}

export class QuickCommandsTreeView {
    private treeProvider: QuickCommandsTreeProvider;
    private treeView: vscode.TreeView<QuickCommandItem>;
    private detector: QuickCommandDetector;
    private pluginChannel: vscode.LogOutputChannel;
    private testOutputChannel: vscode.LogOutputChannel;

    constructor() {
        this.detector = new QuickCommandDetector();
        const channelManager = getOutputChannelManager();
        this.pluginChannel = channelManager.getAutoTestChannel();
        this.testOutputChannel = channelManager.getTestOutputChannel();
        this.treeProvider = new QuickCommandsTreeProvider(this.detector);
        this.treeView = vscode.window.createTreeView('autotestQuickCommands', {
            treeDataProvider: this.treeProvider,
            showCollapseAll: true
        });
        vscode.commands.executeCommand('workbench.actions.treeView.autotestQuickCommands.collapseAll');
    }

    refresh(): void {
        this.treeProvider.refresh();
    }

    async executeQuickCommand(item: QuickCommandItem): Promise<void> {
        if (!item.quickCommand) {
            vscode.window.showWarningMessage('请选择一个命令');
            return;
        }

        const cmd = item.quickCommand;
        const project = cmd.project;
        const config = getConfig();
        const clearOutput = config.clearOutputBeforeRun ?? false;

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `AutoTest - 执行: ${cmd.name}`,
                cancellable: false
            }, async () => {
                await executeRemoteCommand(
                    cmd.executeCommand,
                    this.testOutputChannel,
                    project.server,
                    undefined,
                    clearOutput
                );
            });

            vscode.window.showInformationMessage(`命令 "${cmd.name}" 执行完成`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`命令执行失败: ${error.message}`);
        }
    }
}

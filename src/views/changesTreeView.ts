import * as vscode from 'vscode';
import * as path from 'path';
import { GitChangeDetector } from '../core/gitChangeDetector';
import { GitChange, GitChangeGroup, GitChangeType } from '../types';
import { FileUploader } from '../core/uploader';
import { SCPClient } from '../core/scpClient';
import { hasValidRemoteDirectory, hasValidLocalPath } from '../config';

export class ChangeTreeItem extends vscode.TreeItem {
    public change: GitChange | null;
    public changeGroup: GitChangeGroup | null;

    constructor(
        item: GitChange | GitChangeGroup,
        isGroup: boolean
    ) {
        if (isGroup) {
            const group = item as GitChangeGroup;
            super(group.projectName, vscode.TreeItemCollapsibleState.Collapsed);
            this.changeGroup = group;
            this.change = null;
            this.contextValue = 'changeGroup';
            this.iconPath = new vscode.ThemeIcon('project');
            this.description = `${group.changes.length} 个变更`;
            this.tooltip = `项目: ${group.projectName}\n变更数量: ${group.changes.length}`;
        } else {
            const change = item as GitChange;
            super(change.displayPath, vscode.TreeItemCollapsibleState.None);
            this.change = change;
            this.changeGroup = null;
            this.contextValue = this.getContextValueForChange(change);
            this.iconPath = this.getIconForChangeType(change.type);
            this.description = this.getDescriptionForChange(change);
            this.tooltip = this.getTooltipForChange(change);
            this.resourceUri = vscode.Uri.file(change.path);
        }
    }

    private getContextValueForChange(change: GitChange): string {
        if (change.type === 'deleted') {
            return 'deletedChange';
        }
        if (change.type === 'renamed' || change.type === 'moved') {
            return 'change';
        }
        return 'change';
    }

    private getIconForChangeType(type: GitChangeType): vscode.ThemeIcon {
        switch (type) {
            case 'added':
                return new vscode.ThemeIcon('add', new vscode.ThemeColor('gitDecoration.addedResourceForeground'));
            case 'modified':
                return new vscode.ThemeIcon('edit', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'));
            case 'deleted':
                return new vscode.ThemeIcon('trash', new vscode.ThemeColor('gitDecoration.deletedResourceForeground'));
            case 'renamed':
                return new vscode.ThemeIcon('arrow-right', new vscode.ThemeColor('gitDecoration.renamedResourceForeground'));
            case 'moved':
                return new vscode.ThemeIcon('arrow-swap', new vscode.ThemeColor('gitDecoration.renamedResourceForeground'));
            default:
                return new vscode.ThemeIcon('file');
        }
    }

    private getDescriptionForChange(change: GitChange): string {
        const typeLabel = this.getChangeTypeLabel(change.type);
        if ((change.type === 'renamed' || change.type === 'moved') && change.oldRelativePath) {
            return `${typeLabel} (原: ${change.oldRelativePath.replace(/\\/g, '/')})`;
        }
        return typeLabel;
    }

    private getTooltipForChange(change: GitChange): string {
        let tooltip = `${change.path}\n类型: ${this.getChangeTypeLabel(change.type)}`;
        if ((change.type === 'renamed' || change.type === 'moved') && change.oldRelativePath) {
            tooltip += `\n原路径: ${change.oldPath}`;
        }
        return tooltip;
    }

    private getChangeTypeLabel(type: GitChangeType): string {
        switch (type) {
            case 'added': return '新增';
            case 'modified': return '修改';
            case 'deleted': return '删除';
            case 'renamed': return '重命名';
            case 'moved': return '移动';
            default: return '未知';
        }
    }
}

export class ChangesTreeProvider implements vscode.TreeDataProvider<ChangeTreeItem> {
    private gitDetector: GitChangeDetector;
    private _onDidChangeTreeData = new vscode.EventEmitter<ChangeTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private changeGroups: GitChangeGroup[] = [];

    constructor(gitDetector: GitChangeDetector) {
        this.gitDetector = gitDetector;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ChangeTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ChangeTreeItem): Promise<ChangeTreeItem[]> {
        if (!element) {
            this.changeGroups = await this.gitDetector.getGitChanges();
            
            if (this.changeGroups.length === 0) {
                return [this.createMessageItem('没有检测到文件变更')];
            }
            
            return this.changeGroups.map(group => new ChangeTreeItem(group, true));
        }

        if (element.contextValue === 'changeGroup' && element.changeGroup) {
            return element.changeGroup.changes.map(change => new ChangeTreeItem(change, false));
        }

        return [];
    }

    private createMessageItem(message: string): ChangeTreeItem {
        const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('info');
        item.contextValue = 'message';
        return item as ChangeTreeItem;
    }

    getChangeGroups(): GitChangeGroup[] {
        return this.changeGroups;
    }

    getProjectChanges(projectName: string): GitChangeGroup | undefined {
        return this.changeGroups.find(g => g.projectName === projectName);
    }
}

export class ChangesTreeView {
    private treeProvider: ChangesTreeProvider;
    private treeView: vscode.TreeView<ChangeTreeItem>;
    private gitDetector: GitChangeDetector;
    private fileUploader: FileUploader;

    constructor(fileUploader: FileUploader) {
        this.gitDetector = new GitChangeDetector();
        this.treeProvider = new ChangesTreeProvider(this.gitDetector);
        this.fileUploader = fileUploader;
        this.treeView = vscode.window.createTreeView('autotestChanges', {
            treeDataProvider: this.treeProvider,
            showCollapseAll: true
        });
        vscode.commands.executeCommand('workbench.actions.treeView.autotestChanges.collapseAll');
    }

    refresh(): void {
        this.treeProvider.refresh();
    }

    async uploadProjectChanges(item: ChangeTreeItem): Promise<void> {
        if (!item.changeGroup) {
            vscode.window.showWarningMessage('请选择一个项目');
            return;
        }

        const group = item.changeGroup;
        const project = group.project;
        
        if (!hasValidLocalPath(project)) {
            vscode.window.showWarningMessage(`工程 "${project.name}" 未配置 localPath，无法进行文件上传`);
            return;
        }
        
        if (!hasValidRemoteDirectory(project)) {
            vscode.window.showWarningMessage(`工程 "${project.name}" 未配置 remoteDirectory，无法进行文件上传`);
            return;
        }
        
        const uploadableChanges = group.changes.filter(c => c.type !== 'deleted');
        const deletedChanges = group.changes.filter(c => c.type === 'deleted');
        const renamedChanges = group.changes.filter(c => c.type === 'renamed' || c.type === 'moved');

        if (uploadableChanges.length === 0 && deletedChanges.length === 0) {
            vscode.window.showInformationMessage(`项目 ${group.projectName} 没有需要上传的变更文件`);
            return;
        }

        let shouldDeleteRemote = false;
        const filesToDelete: GitChange[] = [...deletedChanges];
        
        for (const change of renamedChanges) {
            if (change.oldRelativePath) {
                filesToDelete.push({
                    ...change,
                    relativePath: change.oldRelativePath,
                    path: change.oldPath!,
                    type: 'deleted'
                });
            }
        }

        if (filesToDelete.length > 0) {
            const deleteMessage = this.formatDeletedFilesMessage(filesToDelete);
            const choice = await vscode.window.showWarningMessage(
                `项目 ${group.projectName} 检测到 ${filesToDelete.length} 个需要删除的远程文件：\n${deleteMessage}\n\n（包括 ${deletedChanges.length} 个已删除文件和 ${renamedChanges.length} 个重命名文件的旧路径）\n\n是否同步删除远程服务器上的对应文件？`,
                { modal: true },
                '是，同步删除',
                '否，仅上传修改的文件'
            );

            if (choice === '是，同步删除') {
                shouldDeleteRemote = true;
            } else if (choice === '否，仅上传修改的文件') {
                shouldDeleteRemote = false;
            } else {
                return;
            }
        }

        const totalFiles = uploadableChanges.length + (shouldDeleteRemote ? filesToDelete.length : 0);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `AutoTest - 上传 ${group.projectName} 变更文件`,
            cancellable: false
        }, async (progress) => {
            let completed = 0;

            for (const change of uploadableChanges) {
                progress.report({
                    message: `上传: ${change.relativePath} (${completed + 1}/${totalFiles})`
                });

                try {
                    await this.uploadSingleChange(change);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`上传失败 ${change.relativePath}: ${error.message}`);
                }
                completed++;
            }

            if (shouldDeleteRemote) {
                for (const change of filesToDelete) {
                    const displayPath = change.type === 'deleted' 
                        ? change.relativePath 
                        : `${change.relativePath} (重命名前的旧文件)`;
                    
                    progress.report({
                        message: `删除远程: ${displayPath} (${completed + 1}/${totalFiles})`
                    });

                    try {
                        await this.deleteRemoteFile(change);
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`删除失败 ${displayPath}: ${error.message}`);
                    }
                    completed++;
                }
            }
        });

        const summary = this.buildUploadSummary(uploadableChanges.length, deletedChanges.length, renamedChanges.length, shouldDeleteRemote);
        vscode.window.showInformationMessage(summary);
        this.refresh();
    }

    private buildUploadSummary(uploadCount: number, deleteCount: number, renameCount: number, shouldDeleteRemote: boolean): string {
        let summary = `变更处理完成: 上传 ${uploadCount} 个文件`;
        if (shouldDeleteRemote && (deleteCount > 0 || renameCount > 0)) {
            const totalDeleted = deleteCount + renameCount;
            summary += `，删除 ${totalDeleted} 个远程文件`;
            if (renameCount > 0) {
                summary += ` (含 ${renameCount} 个重命名旧文件)`;
            }
        }
        return summary;
    }

    private async uploadSingleChange(change: GitChange): Promise<void> {
        await this.fileUploader.uploadFile(change.path);
    }

    private async deleteRemoteFile(change: GitChange): Promise<void> {
        const project = change.project;
        const remotePath = this.calculateRemotePath(change);
        
        const scpClient = new SCPClient(project.server);
        try {
            const sftp = await scpClient.connect();
            
            try {
                await sftp.delete(remotePath);
            } catch (deleteError: any) {
                try {
                    await sftp.rmdir(remotePath, true);
                } catch (rmdirError: any) {
                    throw new Error(`无法删除远程文件: ${deleteError.message}`);
                }
            }
        } finally {
            await scpClient.disconnect();
        }
    }

    private calculateRemotePath(change: GitChange): string {
        const project = change.project;
        const relativePath = change.relativePath.replace(/\\/g, '/');
        return `${project.server.remoteDirectory}/${relativePath}`;
    }

    private formatDeletedFilesMessage(changes: GitChange[]): string {
        const maxDisplay = 5;
        const displayChanges = changes.slice(0, maxDisplay);
        let message = displayChanges.map(c => {
            if (c.type === 'deleted') {
                return `  - ${c.relativePath} (已删除)`;
            }
            return `  - ${c.relativePath} (重命名旧文件)`;
        }).join('\n');
        
        if (changes.length > maxDisplay) {
            message += `\n  - ... 还有 ${changes.length - maxDisplay} 个文件`;
        }
        
        return message;
    }

    async uploadSelectedChange(item: ChangeTreeItem): Promise<void> {
        if (!item.change) {
            vscode.window.showWarningMessage('请选择一个变更文件');
            return;
        }

        const project = item.change.project;
        
        if (!hasValidLocalPath(project)) {
            vscode.window.showWarningMessage(`工程 "${project.name}" 未配置 localPath，无法进行文件上传`);
            return;
        }
        
        if (!hasValidRemoteDirectory(project)) {
            vscode.window.showWarningMessage(`工程 "${project.name}" 未配置 remoteDirectory，无法进行文件上传`);
            return;
        }

        if (item.change.type === 'deleted') {
            vscode.window.showWarningMessage('已删除的文件无法上传，请使用"上传项目所有变更"功能来同步删除远程文件');
            return;
        }

        try {
            await this.uploadSingleChange(item.change);
            
            if ((item.change.type === 'renamed' || item.change.type === 'moved') && item.change.oldRelativePath) {
                const changeTypeLabel = item.change.type === 'moved' ? '移动' : '重命名';
                const choice = await vscode.window.showInformationMessage(
                    `文件 ${item.change.relativePath} 上传成功。\n\n检测到这是${changeTypeLabel}操作，原文件 ${item.change.oldRelativePath} 在服务器上可能还存在。是否删除远程的旧文件？`,
                    '删除旧文件',
                    '暂不处理'
                );
                
                if (choice === '删除旧文件') {
                    const oldChange: GitChange = {
                        ...item.change,
                        relativePath: item.change.oldRelativePath,
                        path: item.change.oldPath!,
                        type: 'deleted'
                    };
                    await this.deleteRemoteFile(oldChange);
                    vscode.window.showInformationMessage(`已删除远程旧文件: ${item.change.oldRelativePath}`);
                }
            } else {
                vscode.window.showInformationMessage(`文件 ${item.change.relativePath} 上传成功`);
            }
            
            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`上传失败: ${error.message}`);
        }
    }

    async openChangeFile(item: ChangeTreeItem): Promise<void> {
        if (!item.change || item.change.type === 'deleted') {
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(item.change.path);
            await vscode.window.showTextDocument(document);
        } catch (error: any) {
            vscode.window.showErrorMessage(`无法打开文件: ${error.message}`);
        }
    }
}

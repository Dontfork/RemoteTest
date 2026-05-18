import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitChangeDetector } from '../core/gitChangeDetector';
import { GitChange, GitChangeType, CommitChangeGroup, CommitFileChange, ProjectChangeData } from '../types';
import { FileUploader } from '../core/uploader';
import { SCPClient } from '../core/scpClient';
import { hasValidRemoteDirectory, hasValidLocalPath } from '../config';

export class ChangeTreeItem extends vscode.TreeItem {
    public change: GitChange | null;
    public changeGroup: ProjectChangeData | null;
    public commitGroup: CommitChangeGroup | null;
    public commitFileChange: CommitFileChange | null;

    constructor(item: GitChange | ProjectChangeData | CommitChangeGroup | CommitFileChange, itemType: 'project' | 'uncommitted' | 'commit' | 'commitFile') {
        super('', vscode.TreeItemCollapsibleState.Collapsed);

        this.change = null;
        this.changeGroup = null;
        this.commitGroup = null;
        this.commitFileChange = null;

        switch (itemType) {
            case 'project':
                this.fillProject(item as ProjectChangeData);
                break;
            case 'uncommitted':
                this.fillUncommitted(item as ProjectChangeData);
                break;
            case 'commit':
                this.fillCommit(item as CommitChangeGroup);
                break;
            case 'commitFile':
                this.fillCommitFile(item as CommitFileChange);
                break;
        }
    }

    private fillProject(data: ProjectChangeData): void {
        this.label = data.projectName;
        this.changeGroup = data;
        this.contextValue = 'changeGroup';
        this.iconPath = new vscode.ThemeIcon('project');
        const totalChanges = data.uncommittedChanges.length;
        const totalCommits = data.commitGroups.length;
        const parts: string[] = [];
        if (totalChanges > 0) {
            parts.push(`${totalChanges} 个未提交变更`);
        }
        if (totalCommits > 0) {
            parts.push(`${totalCommits} 个 commit`);
        }
        this.description = parts.join(', ') || '无变更';
        this.tooltip = `项目: ${data.projectName}\n未提交变更: ${totalChanges}\ncommit 记录: ${totalCommits}`;
    }

    private fillUncommitted(data: ProjectChangeData): void {
        this.label = '未提交代码';
        this.changeGroup = data;
        this.contextValue = 'uncommittedGroup';
        this.iconPath = new vscode.ThemeIcon('source-control', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'));
        this.description = `${data.uncommittedChanges.length} 个文件`;
        this.tooltip = `未提交变更: ${data.uncommittedChanges.length} 个文件`;
        this.collapsibleState = data.uncommittedChanges.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;
    }

    private fillCommit(group: CommitChangeGroup): void {
        const commit = group.commit;
        this.label = `${commit.shortHash} ${commit.message}`;
        this.commitGroup = group;
        this.contextValue = 'commitGroup';
        this.iconPath = new vscode.ThemeIcon('git-commit');
        this.description = `${commit.date.split(' ')[0]} ${group.changes.length} 文件`;
        this.tooltip = `commit: ${commit.hash}\n消息: ${commit.message}\n作者: ${commit.author}\n日期: ${commit.date}\n变更文件: ${group.changes.length}`;
        this.collapsibleState = group.changes.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;
    }

    private fillCommitFile(fileChange: CommitFileChange): void {
        this.label = fileChange.displayPath;
        this.commitFileChange = fileChange;
        this.change = {
            path: '',
            relativePath: fileChange.relativePath,
            displayPath: fileChange.displayPath,
            type: fileChange.type,
            project: fileChange.project
        };
        this.contextValue = fileChange.type === 'deleted' ? 'commitFile deletedCommitFile' : 'commitFile';
        this.iconPath = this.getIconForChangeType(fileChange.type);
        this.description = this.getChangeTypeLabel(fileChange.type);
        this.tooltip = `${fileChange.displayPath}\n类型: ${this.getChangeTypeLabel(fileChange.type)}`;
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
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
    private projectData: ProjectChangeData[] = [];

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
            this.projectData = await this.gitDetector.getProjectChangeData();

            if (this.projectData.length === 0) {
                return [this.createMessageItem('没有检测到文件变更')];
            }

            return this.projectData.map(data => new ChangeTreeItem(data, 'project'));
        }

        if (element.contextValue === 'changeGroup' && element.changeGroup) {
            const data = element.changeGroup;
            const children: ChangeTreeItem[] = [];

            children.push(new ChangeTreeItem(data, 'uncommitted'));

            for (const commitGroup of data.commitGroups) {
                children.push(new ChangeTreeItem(commitGroup, 'commit'));
            }

            return children;
        }

        if (element.contextValue === 'uncommittedGroup' && element.changeGroup) {
            return element.changeGroup.uncommittedChanges.map(change => {
                const item = new ChangeTreeItem(change, 'commitFile');
                item.change = change;
                item.commitFileChange = null;
                item.contextValue = change.type === 'deleted' ? 'change deletedChange' : 'change';
                item.label = change.displayPath;
                item.description = this.getChangeTypeLabelStatic(change.type);
                item.tooltip = `${change.path}\n类型: ${change.type}`;
                return item;
            });
        }

        if (element.contextValue === 'commitGroup' && element.commitGroup) {
            return element.commitGroup.changes.map(fileChange =>
                new ChangeTreeItem(fileChange, 'commitFile')
            );
        }

        return [];
    }

    private createMessageItem(message: string): ChangeTreeItem {
        const item = new vscode.TreeItem(message, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('info');
        item.contextValue = 'message';
        return item as ChangeTreeItem;
    }

    getProjectData(): ProjectChangeData[] {
        return this.projectData;
    }

    private getChangeTypeLabelStatic(type: GitChangeType): string {
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

export class ChangesTreeView {
    private treeProvider: ChangesTreeProvider;
    private treeView: vscode.TreeView<ChangeTreeItem>;
    private gitDetector: GitChangeDetector;
    private fileUploader: FileUploader;

    constructor(fileUploader: FileUploader) {
        this.gitDetector = new GitChangeDetector();
        this.treeProvider = new ChangesTreeProvider(this.gitDetector);
        this.fileUploader = fileUploader;
        this.treeView = vscode.window.createTreeView('RemoteTestChanges', {
            treeDataProvider: this.treeProvider,
            showCollapseAll: true
        });
        vscode.commands.executeCommand('workbench.actions.treeView.RemoteTestChanges.collapseAll');
    }

    refresh(): void {
        this.treeProvider.refresh();
    }

    async uploadProjectChanges(item: ChangeTreeItem): Promise<void> {
        if (!item.changeGroup) {
            vscode.window.setStatusBarMessage('请选择一个项目', 3000);
            return;
        }

        const data = item.changeGroup;
        const project = data.project;

        if (!hasValidLocalPath(project)) {
            vscode.window.setStatusBarMessage(`工程 "${project.name}" 未配置 localPath，无法进行文件上传`, 4000);
            return;
        }

        if (!hasValidRemoteDirectory(project)) {
            vscode.window.setStatusBarMessage(`工程 "${project.name}" 未配置 remoteDirectory，无法进行文件上传`, 4000);
            return;
        }

        const uploadableChanges = data.uncommittedChanges.filter(c => c.type !== 'deleted');
        const deletedChanges = data.uncommittedChanges.filter(c => c.type === 'deleted');
        const renamedChanges = data.uncommittedChanges.filter(c => c.type === 'renamed' || c.type === 'moved');

        if (uploadableChanges.length === 0 && deletedChanges.length === 0) {
            vscode.window.setStatusBarMessage(`项目 ${data.projectName} 没有需要上传的变更文件`, 3000);
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
                `项目 ${data.projectName} 检测到 ${filesToDelete.length} 个需要删除的远程文件：\n${deleteMessage}\n\n（包括 ${deletedChanges.length} 个已删除文件和 ${renamedChanges.length} 个重命名文件的旧路径）\n\n是否同步删除远程服务器上的对应文件？`,
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
            title: `RemoteTest - 上传 ${data.projectName} 变更文件`,
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
        vscode.window.setStatusBarMessage(summary, 4000);
        this.refresh();
    }

    async uploadCommitChanges(item: ChangeTreeItem): Promise<void> {
        if (!item.commitGroup) {
            vscode.window.setStatusBarMessage('请选择一个 commit', 3000);
            return;
        }

        const group = item.commitGroup;
        const project = group.project;

        if (!hasValidLocalPath(project)) {
            vscode.window.setStatusBarMessage(`工程 "${project.name}" 未配置 localPath，无法进行文件上传`, 4000);
            return;
        }

        if (!hasValidRemoteDirectory(project)) {
            vscode.window.setStatusBarMessage(`工程 "${project.name}" 未配置 remoteDirectory，无法进行文件上传`, 4000);
            return;
        }

        const uploadableFiles = group.changes.filter(c => c.type !== 'deleted');

        if (uploadableFiles.length === 0) {
            vscode.window.setStatusBarMessage(`commit ${group.commit.shortHash} 没有可上传的文件（全部为删除操作）`, 3000);
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `RemoteTest - 上传 commit ${group.commit.shortHash} 的文件`,
            cancellable: false
        }, async (progress) => {
            for (let i = 0; i < uploadableFiles.length; i++) {
                const fileChange = uploadableFiles[i];
                progress.report({
                    message: `上传: ${fileChange.displayPath} (${i + 1}/${uploadableFiles.length})`
                });

                try {
                    await this.uploadCommitFile(fileChange);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`上传失败 ${fileChange.displayPath}: ${error.message}`);
                }
            }
        });

        vscode.window.setStatusBarMessage(`commit ${group.commit.shortHash} 的 ${uploadableFiles.length} 个文件上传完成`, 4000);
    }

    async uploadSelectedChange(item: ChangeTreeItem): Promise<void> {
        if (!item.change) {
            vscode.window.setStatusBarMessage('请选择一个变更文件', 3000);
            return;
        }

        const project = item.change.project;

        if (!hasValidLocalPath(project)) {
            vscode.window.setStatusBarMessage(`工程 "${project.name}" 未配置 localPath，无法进行文件上传`, 4000);
            return;
        }

        if (!hasValidRemoteDirectory(project)) {
            vscode.window.setStatusBarMessage(`工程 "${project.name}" 未配置 remoteDirectory，无法进行文件上传`, 4000);
            return;
        }

        try {
            if (item.change.type === 'deleted') {
                await this.deleteRemoteFile(item.change);
                vscode.window.setStatusBarMessage(`已删除远程文件: ${item.change.relativePath}`, 3000);
            } else {
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
                        vscode.window.setStatusBarMessage(`已删除远程旧文件: ${item.change.oldRelativePath}`, 3000);
                    }
                } else {
                    vscode.window.setStatusBarMessage(`文件 ${item.change.relativePath} 上传成功`, 3000);
                }
            }

            this.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`上传失败: ${error.message}`);
        }
    }

    async uploadCommitFileChange(item: ChangeTreeItem): Promise<void> {
        if (!item.commitFileChange) {
            vscode.window.setStatusBarMessage('请选择一个变更文件', 3000);
            return;
        }

        const fileChange = item.commitFileChange;
        const project = fileChange.project;

        if (!hasValidLocalPath(project)) {
            vscode.window.setStatusBarMessage(`工程 "${project.name}" 未配置 localPath，无法进行文件上传`, 4000);
            return;
        }

        if (!hasValidRemoteDirectory(project)) {
            vscode.window.setStatusBarMessage(`工程 "${project.name}" 未配置 remoteDirectory，无法进行文件上传`, 4000);
            return;
        }

        if (fileChange.type === 'deleted') {
            vscode.window.setStatusBarMessage('删除类型的文件无法上传（文件已不存在）', 3000);
            return;
        }

        try {
            await this.uploadCommitFile(fileChange);
            vscode.window.setStatusBarMessage(`文件 ${fileChange.displayPath} 上传成功`, 3000);
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

    private async uploadCommitFile(fileChange: CommitFileChange): Promise<void> {
        const project = fileChange.project;
        const localPath = path.resolve(project.localPath!, fileChange.relativePath);

        if (!fs.existsSync(localPath)) {
            throw new Error(`本地文件不存在: ${localPath}`);
        }

        await this.fileUploader.uploadFile(localPath);
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

        const scpClient = new SCPClient(project.server, true, project);
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
}

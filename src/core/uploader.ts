import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config';
import { SCPClient } from './scpClient';
import { executeRemoteCommand } from './sshClient';
import { CommandExecutor, replaceCommandVariables, buildCommandVariables } from './commandExecutor';

export class FileUploader {
    private commandExecutor: CommandExecutor;
    private outputChannel: vscode.OutputChannel;

    constructor(commandExecutor: CommandExecutor) {
        this.commandExecutor = commandExecutor;
        this.outputChannel = vscode.window.createOutputChannel('AutoTest');
    }

    private getWorkspacePath(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath;
        }
        return '';
    }

    private calculateRemotePath(localFilePath: string): string {
        const config = getConfig();
        const workspacePath = config.server.localProjectPath || this.getWorkspacePath();
        
        if (!workspacePath) {
            throw new Error('无法确定本地工程路径，请在配置中设置 localProjectPath 或打开一个工作区');
        }

        const normalizedLocalPath = path.normalize(localFilePath);
        const normalizedWorkspacePath = path.normalize(workspacePath);

        if (!normalizedLocalPath.startsWith(normalizedWorkspacePath)) {
            throw new Error(`文件路径 "${localFilePath}" 不在本地工程路径 "${workspacePath}" 内`);
        }

        const relativePath = path.relative(normalizedWorkspacePath, normalizedLocalPath);
        const posixRelativePath = relativePath.split(path.sep).join(path.posix.sep);
        const remotePath = path.posix.join(config.server.remoteDirectory, posixRelativePath);

        return remotePath;
    }

    async uploadAndExecute(): Promise<void> {
        const config = getConfig();

        const fileUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: '选择要上传的文件',
            defaultUri: vscode.Uri.file(this.getWorkspacePath())
        });

        if (!fileUri || fileUri.length === 0) {
            return;
        }

        const localFilePath = fileUri[0].fsPath;
        const fileName = path.basename(localFilePath);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'AutoTest',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: `正在计算远程路径...` });
                
                const remoteFilePath = this.calculateRemotePath(localFilePath);
                this.outputChannel.appendLine(`[路径映射] ${localFilePath} -> ${remoteFilePath}`);

                progress.report({ message: `正在上传: ${fileName}` });
                
                const scpClient = new SCPClient();
                try {
                    await scpClient.uploadFile(localFilePath, remoteFilePath);
                    this.outputChannel.appendLine(`[上传成功] ${localFilePath} -> ${remoteFilePath}`);
                } finally {
                    await scpClient.disconnect();
                }

                progress.report({ message: '执行命令中...' });
                
                const variables = buildCommandVariables(
                    localFilePath,
                    remoteFilePath,
                    config.server.remoteDirectory
                );
                
                const command = replaceCommandVariables(config.command.executeCommand, variables);
                
                this.outputChannel.appendLine(`[变量替换] 原始命令: ${config.command.executeCommand}`);
                this.outputChannel.appendLine(`[变量替换] 替换后: ${command}`);
                
                const result = await executeRemoteCommand(command, this.outputChannel);
                
                if (result.code !== 0) {
                    throw new Error(`命令执行失败，退出码: ${result.code}`);
                }
            });

            vscode.window.showInformationMessage('文件上传并执行完成');
            this.outputChannel.show();
        } catch (error: any) {
            this.outputChannel.appendLine(`[错误] ${error.message}`);
            this.outputChannel.show();
            vscode.window.showErrorMessage(`操作失败: ${error.message}`);
            throw error;
        }
    }

    async upload(filePath: string, remotePath?: string): Promise<string> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }

        try {
            const finalRemotePath = remotePath || this.calculateRemotePath(filePath);
            
            const scpClient = new SCPClient();
            try {
                await scpClient.uploadFile(filePath, finalRemotePath);
                this.outputChannel.appendLine(`[上传成功] ${filePath} -> ${finalRemotePath}`);
                return finalRemotePath;
            } finally {
                await scpClient.disconnect();
            }
        } catch (error: any) {
            this.outputChannel.appendLine(`[上传失败] ${error.message}`);
            throw error;
        }
    }

    async uploadDirectory(localDirPath: string): Promise<string[]> {
        if (!fs.existsSync(localDirPath)) {
            throw new Error(`目录不存在: ${localDirPath}`);
        }

        const uploadedFiles: string[] = [];
        const files = this.getAllFiles(localDirPath);

        const scpClient = new SCPClient();
        try {
            for (const file of files) {
                const remotePath = this.calculateRemotePath(file);
                await scpClient.uploadFile(file, remotePath);
                this.outputChannel.appendLine(`[上传成功] ${file} -> ${remotePath}`);
                uploadedFiles.push(remotePath);
            }
        } finally {
            await scpClient.disconnect();
        }

        return uploadedFiles;
    }

    private getAllFiles(dirPath: string, filesList: string[] = []): string[] {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                if (!file.startsWith('.') && file !== 'node_modules') {
                    this.getAllFiles(fullPath, filesList);
                }
            } else {
                filesList.push(fullPath);
            }
        }
        
        return filesList;
    }

    showOutput(): void {
        this.outputChannel.show();
    }
}

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
    private onTestCaseComplete: (() => void) | null = null;

    constructor(commandExecutor: CommandExecutor) {
        this.commandExecutor = commandExecutor;
        this.outputChannel = vscode.window.createOutputChannel('AutoTest');
    }

    setOnTestCaseComplete(callback: () => void): void {
        this.onTestCaseComplete = callback;
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

    async runTestCase(localPath: string): Promise<void> {
        const config = getConfig();
        const stat = fs.statSync(localPath);
        const isDirectory = stat.isDirectory();
        const name = path.basename(localPath);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'AutoTest',
                cancellable: false
            }, async (progress) => {
                if (isDirectory) {
                    progress.report({ message: `正在扫描目录: ${name}` });
                    const files = this.getAllFiles(localPath);
                    
                    if (files.length === 0) {
                        vscode.window.showWarningMessage(`目录 ${name} 中没有可上传的文件`);
                        return;
                    }

                    progress.report({ message: `发现 ${files.length} 个文件，开始处理...` });
                    
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const fileName = path.basename(file);
                        progress.report({ message: `处理文件 (${i + 1}/${files.length}): ${fileName}` });
                        await this.runSingleTestCase(file, config);
                    }
                    
                    vscode.window.showInformationMessage(`目录 ${name} 处理完成，共 ${files.length} 个文件`);
                } else {
                    progress.report({ message: `正在处理: ${name}` });
                    await this.runSingleTestCase(localPath, config);
                    vscode.window.showInformationMessage(`文件 ${name} 运行完成`);
                }
            });

            this.outputChannel.show();
            
            if (this.onTestCaseComplete) {
                this.onTestCaseComplete();
            }
        } catch (error: any) {
            this.outputChannel.appendLine(`[错误] ${error.message}`);
            this.outputChannel.show();
            vscode.window.showErrorMessage(`操作失败: ${error.message}`);
            throw error;
        }
    }

    private async runSingleTestCase(localFilePath: string, config: ReturnType<typeof getConfig>): Promise<void> {
        const remoteFilePath = this.calculateRemotePath(localFilePath);
        this.outputChannel.appendLine(`[路径映射] ${localFilePath} -> ${remoteFilePath}`);

        const scpClient = new SCPClient();
        try {
            await scpClient.uploadFile(localFilePath, remoteFilePath);
            this.outputChannel.appendLine(`[上传成功] ${localFilePath} -> ${remoteFilePath}`);
        } finally {
            await scpClient.disconnect();
        }

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
            this.outputChannel.appendLine(`[警告] 命令退出码: ${result.code}`);
        }
    }

    async uploadFile(localPath: string): Promise<void> {
        const stat = fs.statSync(localPath);
        const isDirectory = stat.isDirectory();
        const name = path.basename(localPath);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'AutoTest',
                cancellable: false
            }, async (progress) => {
                if (isDirectory) {
                    progress.report({ message: `正在扫描目录: ${name}` });
                    const files = this.getAllFiles(localPath);
                    
                    if (files.length === 0) {
                        vscode.window.showWarningMessage(`目录 ${name} 中没有可上传的文件`);
                        return;
                    }

                    progress.report({ message: `发现 ${files.length} 个文件，开始上传...` });
                    
                    const scpClient = new SCPClient();
                    try {
                        for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const fileName = path.basename(file);
                            progress.report({ message: `上传文件 (${i + 1}/${files.length}): ${fileName}` });
                            
                            const remotePath = this.calculateRemotePath(file);
                            await scpClient.uploadFile(file, remotePath);
                            this.outputChannel.appendLine(`[上传成功] ${file} -> ${remotePath}`);
                        }
                    } finally {
                        await scpClient.disconnect();
                    }
                    
                    vscode.window.showInformationMessage(`目录 ${name} 上传完成，共 ${files.length} 个文件`);
                } else {
                    progress.report({ message: `正在上传: ${name}` });
                    
                    const remotePath = this.calculateRemotePath(localPath);
                    const scpClient = new SCPClient();
                    try {
                        await scpClient.uploadFile(localPath, remotePath);
                        this.outputChannel.appendLine(`[上传成功] ${localPath} -> ${remotePath}`);
                    } finally {
                        await scpClient.disconnect();
                    }
                    
                    vscode.window.showInformationMessage(`文件 ${name} 上传完成`);
                }
            });

            this.outputChannel.show();
        } catch (error: any) {
            this.outputChannel.appendLine(`[上传失败] ${error.message}`);
            this.outputChannel.show();
            vscode.window.showErrorMessage(`上传失败: ${error.message}`);
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

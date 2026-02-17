import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig, matchProject, hasValidLocalPath, hasValidRemoteDirectory } from '../config';
import { SCPClient } from './scpClient';
import { CommandExecutor, replaceCommandVariables, buildCommandVariables } from './commandExecutor';
import { executeRemoteCommand } from './sshClient';
import { ProjectConfig, CommandConfig } from '../types';

export class FileUploader {
    private commandExecutor: CommandExecutor;
    private pluginChannel: vscode.LogOutputChannel;
    private testOutputChannel: vscode.LogOutputChannel;
    private onTestCaseComplete: (() => void) | null = null;

    constructor(commandExecutor: CommandExecutor) {
        this.commandExecutor = commandExecutor;
        this.pluginChannel = commandExecutor.getPluginChannel();
        this.testOutputChannel = commandExecutor.getTestOutputChannel();
    }

    setOnTestCaseComplete(callback: () => void): void {
        this.onTestCaseComplete = callback;
    }

    private calculateRemotePath(localFilePath: string, project: ProjectConfig): string {
        if (!hasValidLocalPath(project)) {
            throw new Error(`工程 "${project.name}" 未配置 localPath，无法进行文件上传`);
        }
        
        if (!hasValidRemoteDirectory(project)) {
            throw new Error(`工程 "${project.name}" 未配置 remoteDirectory，无法进行文件上传`);
        }

        const normalizedLocalPath = path.normalize(localFilePath);
        const normalizedProjectPath = path.normalize(project.localPath!);

        if (normalizedLocalPath.toLowerCase() !== normalizedProjectPath.toLowerCase() &&
            !normalizedLocalPath.toLowerCase().startsWith(normalizedProjectPath.toLowerCase() + path.sep)) {
            throw new Error(`文件路径 "${localFilePath}" 不在工程路径 "${project.localPath}" 内`);
        }

        const relativePath = path.relative(normalizedProjectPath, normalizedLocalPath);
        const posixRelativePath = relativePath.split(path.sep).join(path.posix.sep);
        const remotePath = path.posix.join(project.server.remoteDirectory!, posixRelativePath);

        return remotePath;
    }

    private async selectCommand(commands: CommandConfig[]): Promise<CommandConfig | undefined> {
        if (commands.length === 1) {
            return commands[0];
        }

        const items = commands.map(cmd => ({
            label: cmd.name,
            description: cmd.executeCommand,
            command: cmd
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '请选择要执行的命令',
            title: '选择执行命令'
        });

        return selected?.command;
    }

    async runTestCase(localPath: string): Promise<void> {
        const project = matchProject(localPath);
        
        if (!project) {
            vscode.window.showErrorMessage(
                `未找到匹配的工程配置\n文件路径: ${localPath}\n请在配置文件中添加对应的工程配置。`
            );
            return;
        }

        if (!project.commands || project.commands.length === 0) {
            vscode.window.showWarningMessage('该工程未配置命令，无法运行用例');
            return;
        }

        const availableCommands = project.commands.filter(cmd => cmd.runnable === true);
        
        if (availableCommands.length === 0) {
            vscode.window.showWarningMessage('可用命令数量为 0，无法运行用例。请将需要运行的命令设置为 runnable: true。');
            return;
        }

        const stat = fs.statSync(localPath);
        const isDirectory = stat.isDirectory();
        const name = path.basename(localPath);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `AutoTest - ${project.name}`,
                cancellable: false
            }, async (progress) => {
                if (isDirectory) {
                    progress.report({ message: `正在扫描目录: ${name}` });
                    const files = this.getAllFiles(localPath);
                    
                    if (files.length === 0) {
                        vscode.window.showWarningMessage(`目录 ${name} 中没有可上传的文件`);
                        return;
                    }

                    const command = await this.selectCommand(availableCommands);
                    if (!command) {
                        vscode.window.showWarningMessage('已取消操作');
                        return;
                    }

                    progress.report({ message: `发现 ${files.length} 个文件，开始处理...` });
                    
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const fileName = path.basename(file);
                        progress.report({ message: `处理文件 (${i + 1}/${files.length}): ${fileName}` });
                        await this.runSingleTestCase(file, project, command);
                    }
                    
                    vscode.window.showInformationMessage(`目录 ${name} 处理完成，共 ${files.length} 个文件`);
                } else {
                    const command = await this.selectCommand(availableCommands);
                    if (!command) {
                        vscode.window.showWarningMessage('已取消操作');
                        return;
                    }

                    progress.report({ message: `正在处理: ${name}` });
                    await this.runSingleTestCase(localPath, project, command);
                    vscode.window.showInformationMessage(`文件 ${name} 运行完成`);
                }
            });

            this.testOutputChannel.show();
            
            if (this.onTestCaseComplete) {
                this.onTestCaseComplete();
            }
        } catch (error: any) {
            this.pluginChannel.error(`[错误] ${error.message}`);
            this.pluginChannel.show();
            vscode.window.showErrorMessage(`操作失败: ${error.message}`);
            throw error;
        }
    }

    async runTestCaseWithCommand(localPath: string, command: CommandConfig): Promise<void> {
        const project = matchProject(localPath);
        
        if (!project) {
            vscode.window.showErrorMessage(
                `未找到匹配的工程配置\n文件路径: ${localPath}\n请在配置文件中添加对应的工程配置。`
            );
            return;
        }

        const stat = fs.statSync(localPath);
        const isDirectory = stat.isDirectory();
        const name = path.basename(localPath);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `AutoTest - ${project.name} - ${command.name}`,
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
                        await this.runSingleTestCase(file, project, command);
                    }
                    
                    vscode.window.showInformationMessage(`目录 ${name} 处理完成，共 ${files.length} 个文件`);
                } else {
                    progress.report({ message: `正在处理: ${name}` });
                    await this.runSingleTestCase(localPath, project, command);
                    vscode.window.showInformationMessage(`文件 ${name} 运行完成`);
                }
            });

            this.testOutputChannel.show();
            
            if (this.onTestCaseComplete) {
                this.onTestCaseComplete();
            }
        } catch (error: any) {
            this.pluginChannel.error(`[错误] ${error.message}`);
            this.pluginChannel.show();
            vscode.window.showErrorMessage(`操作失败: ${error.message}`);
            throw error;
        }
    }

    private async runSingleTestCase(
        localFilePath: string, 
        project: ProjectConfig, 
        command: CommandConfig
    ): Promise<void> {
        const remoteFilePath = this.calculateRemotePath(localFilePath, project);

        const scpClient = new SCPClient(project.server);
        try {
            await scpClient.uploadFile(localFilePath, remoteFilePath);
        } finally {
            await scpClient.disconnect();
        }

        const variables = buildCommandVariables(
            localFilePath,
            remoteFilePath,
            project.server.remoteDirectory || ''
        );
        
        const finalCommand = replaceCommandVariables(command.executeCommand, variables);
        
        this.testOutputChannel.info(`[${project.name}] ${finalCommand}`);
        
        const config = getConfig();
        const clearOutput = config.clearOutputBeforeRun ?? false;
        
        const result = await executeRemoteCommand(
            finalCommand, 
            this.testOutputChannel,
            project.server,
            {
                includePatterns: command.includePatterns || [],
                excludePatterns: command.excludePatterns || [],
                colorRules: command.colorRules
            },
            clearOutput
        );
        
        if (result.code !== 0) {
            this.testOutputChannel.warn(`[警告] 退出码: ${result.code}`);
        }
    }

    async uploadFile(localPath: string): Promise<void> {
        const project = matchProject(localPath);
        
        if (!project) {
            vscode.window.showErrorMessage(
                `未找到匹配的工程配置\n文件路径: ${localPath}\n请在配置文件中添加对应的工程配置。`
            );
            return;
        }

        const stat = fs.statSync(localPath);
        const isDirectory = stat.isDirectory();
        const name = path.basename(localPath);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `AutoTest - ${project.name}`,
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
                    
                    const scpClient = new SCPClient(project.server);
                    try {
                        for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const fileName = path.basename(file);
                            progress.report({ message: `上传文件 (${i + 1}/${files.length}): ${fileName}` });
                            
                            const remotePath = this.calculateRemotePath(file, project);
                            await scpClient.uploadFile(file, remotePath);
                        }
                    } finally {
                        await scpClient.disconnect();
                    }
                    
                    vscode.window.showInformationMessage(`目录 ${name} 上传完成，共 ${files.length} 个文件`);
                } else {
                    progress.report({ message: `正在上传: ${name}` });
                    
                    const remotePath = this.calculateRemotePath(localPath, project);
                    const scpClient = new SCPClient(project.server);
                    try {
                        await scpClient.uploadFile(localPath, remotePath);
                    } finally {
                        await scpClient.disconnect();
                    }
                    
                    vscode.window.showInformationMessage(`文件 ${name} 上传完成`);
                }
            });
        } catch (error: any) {
            this.pluginChannel.error(`[上传失败] ${error.message}`);
            this.pluginChannel.show();
            vscode.window.showErrorMessage(`上传失败: ${error.message}`);
            throw error;
        }
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

    async syncFile(localPath: string): Promise<void> {
        const project = matchProject(localPath);
        
        if (!project) {
            vscode.window.showErrorMessage(
                `未找到匹配的工程配置\n文件路径: ${localPath}\n请在配置文件中添加对应的工程配置。`
            );
            return;
        }

        const stat = fs.statSync(localPath);
        const isDirectory = stat.isDirectory();
        const name = path.basename(localPath);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `AutoTest - ${project.name} - 同步文件`,
                cancellable: false
            }, async (progress) => {
                const remotePath = this.calculateRemotePath(localPath, project);
                
                if (isDirectory) {
                    progress.report({ message: `正在同步目录: ${name}` });
                    
                    const scpClient = new SCPClient(project.server);
                    try {
                        await scpClient.downloadDirectory(remotePath, localPath);
                    } finally {
                        await scpClient.disconnect();
                    }
                    
                    vscode.window.showInformationMessage(`目录 ${name} 同步完成`);
                } else {
                    progress.report({ message: `正在同步文件: ${name}` });
                    
                    const scpClient = new SCPClient(project.server);
                    try {
                        await scpClient.downloadFile(remotePath, localPath);
                    } finally {
                        await scpClient.disconnect();
                    }
                    
                    vscode.window.showInformationMessage(`文件 ${name} 同步完成`);
                }
            });
        } catch (error: any) {
            this.pluginChannel.error(`[同步失败] ${error.message}`);
            this.pluginChannel.show();
            vscode.window.showErrorMessage(`同步失败: ${error.message}`);
            throw error;
        }
    }

    showOutput(): void {
        this.pluginChannel.show();
    }
}

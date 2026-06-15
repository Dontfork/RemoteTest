import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig, matchProject, hasValidLocalPath, hasValidRemoteDirectory } from '../config';
import { SCPClient } from './scpClient';
import { CommandExecutor, replaceCommandVariables, buildCommandVariables } from './commandExecutor';
import { executeRemoteCommand, isExecuting } from './sshClient';
import { formatError } from '../pure/errors';
import { calculateRemotePath } from '../pure/pathUtil';
import { ProjectConfig, CommandConfig } from '../types';
import { UnifiedOutputChannel } from '../utils/outputChannel';

export class FileUploader {
    private commandExecutor: CommandExecutor;
    private pluginChannel: UnifiedOutputChannel;
    private testOutputChannel: UnifiedOutputChannel;
    private onTestCaseComplete: (() => void) | null = null;

    constructor(commandExecutor: CommandExecutor) {
        this.commandExecutor = commandExecutor;
        this.pluginChannel = commandExecutor.getPluginChannel();
        this.testOutputChannel = commandExecutor.getTestOutputChannel();
    }

    setOnTestCaseComplete(callback: () => void): void {
        this.onTestCaseComplete = callback;
    }

    private calculateRemotePathForFile(localFilePath: string, project: ProjectConfig): string {
        if (!hasValidLocalPath(project)) {
            throw new Error(`工程 "${project.name}" 未配置 localPath，无法进行文件上传`);
        }

        if (!hasValidRemoteDirectory(project)) {
            throw new Error(`工程 "${project.name}" 未配置 remoteDirectory，无法进行文件上传`);
        }

        return calculateRemotePath(localFilePath, project.localPath!, project.server.remoteDirectory!);
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

    /**
     * 运行测试用例（自动选择 runnable 命令或使用指定命令）。
     *
     * @param localPath 本地文件/目录路径
     * @param explicitCommand 指定命令（不传则从项目 runnable 命令中选择）
     */
    async runTestCase(localPath: string, explicitCommand?: CommandConfig): Promise<void> {
        const project = matchProject(localPath);

        if (!project) {
            vscode.window.showErrorMessage(
                `未找到匹配的工程配置\n文件路径: ${localPath}\n请在配置文件中添加对应的工程配置。`
            );
            return;
        }

        let command: CommandConfig | undefined = explicitCommand;

        // 未指定命令时，从项目的 runnable 命令中选取
        if (!command) {
            if (!project.commands || project.commands.length === 0) {
                vscode.window.setStatusBarMessage('该工程未配置命令，无法运行用例', 3000);
                return;
            }

            const availableCommands = project.commands.filter(cmd => cmd.runnable === true);

            if (availableCommands.length === 0) {
                vscode.window.setStatusBarMessage('可用命令数量为 0，无法运行用例。请将需要运行的命令设置为 runnable: true。', 4000);
                return;
            }

            command = await this.selectCommand(availableCommands);
            if (!command) {
                vscode.window.setStatusBarMessage('已取消操作', 2000);
                return;
            }
        }

        const stat = fs.statSync(localPath);
        const isDirectory = stat.isDirectory();
        const name = path.basename(localPath);
        const progressTitle = explicitCommand
            ? `RemoteTest - ${project.name} - ${command.name}`
            : `RemoteTest - ${project.name}`;

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: progressTitle,
                cancellable: false
            }, async (progress) => {
                if (isDirectory) {
                    progress.report({ message: `正在扫描目录: ${name}` });
                    const files = this.getAllFiles(localPath);

                    if (files.length === 0) {
                        vscode.window.setStatusBarMessage(`目录 ${name} 中没有可上传的文件`, 3000);
                        return;
                    }

                    progress.report({ message: `发现 ${files.length} 个文件，开始处理...` });

                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const fileName = path.basename(file);
                        progress.report({ message: `处理文件 (${i + 1}/${files.length}): ${fileName}` });
                        await this.runSingleTestCase(file, project, command!);
                    }

                    vscode.window.setStatusBarMessage(`目录 ${name} 处理完成，共 ${files.length} 个文件`, 3000);
                } else {
                    progress.report({ message: `正在处理: ${name}` });
                    await this.runSingleTestCase(localPath, project, command!);
                    vscode.window.setStatusBarMessage(`文件 ${name} 运行完成`, 3000);
                }
            });

            this.testOutputChannel.show();

            if (this.onTestCaseComplete) {
                this.onTestCaseComplete();
            }
        } catch (error: any) {
            this.pluginChannel.error(`[错误] ${formatError(error)}`);
            throw error;
        }
    }

    /** 向后兼容：使用指定命令运行测试用例。 */
    async runTestCaseWithCommand(localPath: string, command: CommandConfig): Promise<void> {
        return this.runTestCase(localPath, command);
    }

    private async runSingleTestCase(
        localFilePath: string, 
        project: ProjectConfig, 
        command: CommandConfig
    ): Promise<void> {
        if (isExecuting()) {
            vscode.window.setStatusBarMessage('当前有命令正在执行中，请等待执行完成后再试', 3000);
            return;
        }

        const remoteFilePath = this.calculateRemotePathForFile(localFilePath, project);

        const scpClient = new SCPClient(project.server, true, project);
        try {
            await scpClient.uploadFile(localFilePath, remoteFilePath);
        } catch (uploadError: any) {
            throw new Error(`文件上传失败: ${uploadError.message}，远程命令未执行`);
        } finally {
            try { await scpClient.disconnect(); } catch {}
        }

        const variables = buildCommandVariables(
            localFilePath,
            remoteFilePath,
            project.server.remoteDirectory || ''
        );
        
        const finalCommand = replaceCommandVariables(command.executeCommand, variables);
        
        this.testOutputChannel.info(`[${project.name}] ${finalCommand}`);
        
        const config = getConfig();
        const clearOutput = command.clearOutputBeforeRun ?? config.clearOutputBeforeRun ?? true;
        
        const result = await executeRemoteCommand(
            finalCommand, 
            this.testOutputChannel,
            project.server,
            {
                includePatterns: command.includePatterns || [],
                excludePatterns: command.excludePatterns || []
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
                title: `RemoteTest - ${project.name}`,
                cancellable: false
            }, async (progress) => {
                if (isDirectory) {
                    progress.report({ message: `正在扫描目录: ${name}` });
                    const files = this.getAllFiles(localPath);
                    
                    if (files.length === 0) {
                        vscode.window.setStatusBarMessage(`目录 ${name} 中没有可上传的文件`, 3000);
                        return;
                    }

                    progress.report({ message: `发现 ${files.length} 个文件，开始上传...` });
                    
                    const scpClient = new SCPClient(project.server, true, project);
                    try {
                        for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const fileName = path.basename(file);
                            progress.report({ message: `上传文件 (${i + 1}/${files.length}): ${fileName}` });
                            
                            const remotePath = this.calculateRemotePathForFile(file, project);
                            await scpClient.uploadFile(file, remotePath);
                        }
                    } finally {
                        try { await scpClient.disconnect(); } catch {}
                    }
                    
                    vscode.window.setStatusBarMessage(`目录 ${name} 上传完成，共 ${files.length} 个文件`, 3000);
                } else {
                    progress.report({ message: `正在上传: ${name}` });
                    
                    const remotePath = this.calculateRemotePathForFile(localPath, project);
                    const scpClient = new SCPClient(project.server, true, project);
                    try {
                        await scpClient.uploadFile(localPath, remotePath);
                    } finally {
                        try { await scpClient.disconnect(); } catch {}
                    }
                    
                    vscode.window.setStatusBarMessage(`文件 ${name} 上传完成`, 3000);
                }
            });
        } catch (error: any) {
            this.pluginChannel.error(`[上传失败] ${formatError(error)}`);
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
                title: `RemoteTest - ${project.name} - 同步文件`,
                cancellable: false
            }, async (progress) => {
                const remotePath = this.calculateRemotePathForFile(localPath, project);
                
                if (isDirectory) {
                    progress.report({ message: `正在同步目录: ${name}` });
                    
                    const scpClient = new SCPClient(project.server, true, project);
                    try {
                        await scpClient.downloadDirectory(remotePath, localPath);
                    } finally {
                        try { await scpClient.disconnect(); } catch {}
                    }
                    
                    vscode.window.setStatusBarMessage(`目录 ${name} 同步完成`, 3000);
                } else {
                    progress.report({ message: `正在同步文件: ${name}` });
                    
                    const scpClient = new SCPClient(project.server, true, project);
                    try {
                        await scpClient.downloadFile(remotePath, localPath);
                    } finally {
                        try { await scpClient.disconnect(); } catch {}
                    }
                    
                    vscode.window.setStatusBarMessage(`文件 ${name} 同步完成`, 3000);
                }
            });
        } catch (error: any) {
            this.pluginChannel.error(`[同步失败] ${formatError(error)}`);
            throw error;
        }
    }

    showOutput(): void {
        this.pluginChannel.show();
    }
}

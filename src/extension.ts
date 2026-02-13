import * as vscode from 'vscode';
import { loadConfig, getConfig } from './config';
import { CommandExecutor, FileUploader, LogMonitor } from './core';
import { AIChat } from './ai';
import { LogsTreeProvider, LogTreeItem, AIChatViewProvider } from './views';

let commandExecutor: CommandExecutor;
let fileUploader: FileUploader;
let logMonitor: LogMonitor;
let aiChat: AIChat;
let logsTreeProvider: LogsTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    if (!workspacePath) {
        vscode.window.showWarningMessage('请先打开一个工作区文件夹');
        return;
    }

    loadConfig(workspacePath);

    const config = getConfig();
    if (!config.logs.monitorDirectory) {
        config.logs.monitorDirectory = config.server.logDirectory || '/var/logs';
    }

    commandExecutor = new CommandExecutor();
    fileUploader = new FileUploader(commandExecutor);
    logMonitor = new LogMonitor();
    aiChat = new AIChat();
    logsTreeProvider = new LogsTreeProvider(logMonitor);

    const commands = [
        vscode.commands.registerCommand('autotest.uploadAndExecute', async () => {
            try {
                await fileUploader.uploadAndExecute();
            } catch (error: any) {
                vscode.window.showErrorMessage(`上传失败: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('autotest.monitorLogs', async () => {
            try {
                await logMonitor.downloadSelectedLog();
            } catch (error: any) {
                vscode.window.showErrorMessage(`下载失败: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('autotest.refreshLogs', async () => {
            await logsTreeProvider.refresh();
        }),

        vscode.commands.registerCommand('autotest.downloadLog', async (item: LogTreeItem) => {
            if (item && item.logFile) {
                try {
                    const localPath = await logMonitor.downloadLog(item.logFile);
                    vscode.window.showInformationMessage(`已下载到: ${localPath}`);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`下载失败: ${error.message}`);
                }
            }
        })
    ];

    const treeView = vscode.window.createTreeView('autotest-logs-view', {
        treeDataProvider: logsTreeProvider,
        showCollapseAll: false
    });

    const aiChatView = vscode.window.registerWebviewViewProvider('autotest-ai-view', new AIChatViewProvider(aiChat));

    context.subscriptions.push(...commands, treeView, aiChatView);

    vscode.window.showInformationMessage('AutoTest 插件已启动');
}

export function deactivate() {
    if (logMonitor) {
        logMonitor.stopMonitoring();
    }
    if (commandExecutor) {
        commandExecutor.dispose();
    }
}

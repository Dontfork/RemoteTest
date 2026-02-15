import * as vscode from 'vscode';
import { loadConfig, reloadConfig, setupConfigWatcher, onConfigChanged, dispose as disposeConfig } from './config';
import { CommandExecutor, FileUploader } from './core';
import { AIChat, SessionManager } from './ai';
import { LogTreeView, LogTreeItem, AIChatViewProvider } from './views';
import { initLogger } from './utils/logger';

let commandExecutor: CommandExecutor;
let fileUploader: FileUploader;
let aiChat: AIChat;
let sessionManager: SessionManager;
let logTreeView: LogTreeView;

export function activate(context: vscode.ExtensionContext) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    if (workspacePath) {
        loadConfig(workspacePath);
    }

    commandExecutor = new CommandExecutor();
    initLogger(commandExecutor.getPluginChannel());
    
    fileUploader = new FileUploader(commandExecutor);
    sessionManager = new SessionManager(context);
    aiChat = new AIChat(sessionManager);
    logTreeView = new LogTreeView();

    fileUploader.setOnTestCaseComplete(() => {
        logTreeView.refresh();
    });

    setupConfigWatcher(context);

    onConfigChanged((newConfig) => {
        if (logTreeView) {
            logTreeView.refresh();
        }
    });

    const commands = [
        vscode.commands.registerCommand('autotest.runTestCase', async (uri: vscode.Uri) => {
            try {
                if (!uri) {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        uri = activeEditor.document.uri;
                    } else {
                        vscode.window.showWarningMessage('请先选择一个文件或目录');
                        return;
                    }
                }
                await fileUploader.runTestCase(uri.fsPath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`运行用例失败: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('autotest.uploadFile', async (uri: vscode.Uri) => {
            try {
                if (!uri) {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        uri = activeEditor.document.uri;
                    } else {
                        vscode.window.showWarningMessage('请先选择一个文件或目录');
                        return;
                    }
                }
                await fileUploader.uploadFile(uri.fsPath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`上传失败: ${error.message}`);
            }
        }),

        vscode.commands.registerCommand('autotest.refreshLogs', async () => {
            logTreeView.refresh();
        }),

        vscode.commands.registerCommand('autotest.downloadLog', async (item: LogTreeItem) => {
            await logTreeView.downloadLog(item);
        }),

        vscode.commands.registerCommand('autotest.openLog', async (item: LogTreeItem) => {
            await logTreeView.openLogInEditor(item);
        }),

        vscode.commands.registerCommand('autotest.reloadConfig', () => {
            const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (wsPath) {
                reloadConfig(wsPath);
                vscode.window.showInformationMessage('AutoTest 配置已刷新');
            } else {
                vscode.window.showWarningMessage('无法刷新配置：未找到工作区');
            }
        }),

        vscode.commands.registerCommand('autotest.openConfig', async () => {
            const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (wsPath) {
                const configPath = vscode.workspace.getConfiguration('autotest').get<string>('configPath') || 'autotest-config.json';
                const pathsToTry = [
                    vscode.Uri.file(`${wsPath}/.vscode/${configPath}`),
                    vscode.Uri.file(`${wsPath}/${configPath}`)
                ];
                
                for (const uri of pathsToTry) {
                    try {
                        await vscode.workspace.fs.stat(uri);
                        const doc = await vscode.workspace.openTextDocument(uri);
                        await vscode.window.showTextDocument(doc);
                        return;
                    } catch {
                        continue;
                    }
                }
                
                vscode.window.showWarningMessage('未找到配置文件，将在首次使用时自动创建');
            } else {
                vscode.window.showWarningMessage('无法打开配置文件：未找到工作区');
            }
        })
    ];

    const aiChatView = vscode.window.registerWebviewViewProvider(
        AIChatViewProvider.viewType, 
        new AIChatViewProvider(context.extensionUri, aiChat, sessionManager)
    );

    context.subscriptions.push(...commands, aiChatView);

    logTreeView.start();

    vscode.window.showInformationMessage('AutoTest 插件已启动');
}

export function deactivate() {
    if (logTreeView) {
        logTreeView.stop();
    }
    if (commandExecutor) {
        commandExecutor.dispose();
    }
    if (sessionManager) {
        sessionManager.dispose();
    }
    disposeConfig();
}

import * as vscode from 'vscode';
import { loadConfig, reloadConfig, setupConfigWatcher, onConfigChanged, dispose as disposeConfig } from './config';
import { CommandExecutor, FileUploader } from './core';
import { ConnectionPool } from './core/connectionPool';
import { LogTreeView, LogTreeItem, ChangesTreeView, ChangeTreeItem, QuickCommandsTreeView, QuickCommandItem } from './views';
import { formatError } from './core/sshClient';

let commandExecutor: CommandExecutor;
let fileUploader: FileUploader;
let logTreeView: LogTreeView;
let changesTreeView: ChangesTreeView;
let quickCommandsTreeView: QuickCommandsTreeView;

export function activate(context: vscode.ExtensionContext) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    if (workspacePath) {
        loadConfig(workspacePath);
    }

    commandExecutor = new CommandExecutor();
    
    fileUploader = new FileUploader(commandExecutor);
    logTreeView = new LogTreeView();
    changesTreeView = new ChangesTreeView(fileUploader);
    quickCommandsTreeView = new QuickCommandsTreeView();

    fileUploader.setOnTestCaseComplete(() => {
        logTreeView.refresh();
    });

    setupConfigWatcher(context);

    onConfigChanged((newConfig) => {
        if (logTreeView) {
            logTreeView.refresh();
        }
        if (changesTreeView) {
            changesTreeView.refresh();
        }
        if (quickCommandsTreeView) {
            quickCommandsTreeView.refresh();
        }
    });

    const commands = [
        vscode.commands.registerCommand('RemoteTest.runTestCase', async (uri: vscode.Uri) => {
            try {
                if (!uri) {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        uri = activeEditor.document.uri;
                    } else {
                        vscode.window.setStatusBarMessage('请先选择一个文件或目录', 3000);
                        return;
                    }
                }
                await fileUploader.runTestCase(uri.fsPath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`运行用例失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.uploadFile', async (uri: vscode.Uri) => {
            try {
                if (!uri) {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        uri = activeEditor.document.uri;
                    } else {
                        vscode.window.setStatusBarMessage('请先选择一个文件或目录', 3000);
                        return;
                    }
                }
                await fileUploader.uploadFile(uri.fsPath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`上传失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.syncFile', async (uri: vscode.Uri) => {
            try {
                if (!uri) {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        uri = activeEditor.document.uri;
                    } else {
                        vscode.window.setStatusBarMessage('请先选择一个文件或目录', 3000);
                        return;
                    }
                }
                await fileUploader.syncFile(uri.fsPath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`同步失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.refreshLogs', async () => {
            logTreeView.refresh();
        }),

        vscode.commands.registerCommand('RemoteTest.downloadLog', async (item: LogTreeItem) => {
            await logTreeView.downloadLog(item);
        }),

        vscode.commands.registerCommand('RemoteTest.openLog', async (item: LogTreeItem) => {
            await logTreeView.openLogInEditor(item);
        }),

        vscode.commands.registerCommand('RemoteTest.reloadConfig', () => {
            const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (wsPath) {
                reloadConfig(wsPath);
                vscode.window.setStatusBarMessage('RemoteTest 配置已刷新', 3000);
            } else {
                vscode.window.setStatusBarMessage('无法刷新配置：未找到工作区', 3000);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.openConfig', async () => {
            const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (wsPath) {
                const configPath = vscode.workspace.getConfiguration('RemoteTest').get<string>('configPath') || 'RemoteTest-config.json';
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
            } else {
                vscode.window.setStatusBarMessage('无法打开配置文件：未找到工作区', 3000);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.refreshChanges', async () => {
            changesTreeView.refresh();
        }),

        vscode.commands.registerCommand('RemoteTest.uploadProjectChanges', async (item: ChangeTreeItem) => {
            await changesTreeView.uploadProjectChanges(item);
        }),

        vscode.commands.registerCommand('RemoteTest.uploadSelectedChange', async (item: ChangeTreeItem) => {
            await changesTreeView.uploadSelectedChange(item);
        }),

        vscode.commands.registerCommand('RemoteTest.openChangeFile', async (item: ChangeTreeItem) => {
            await changesTreeView.openChangeFile(item);
        }),

        vscode.commands.registerCommand('RemoteTest.uploadCommitChanges', async (item: ChangeTreeItem) => {
            await changesTreeView.uploadCommitChanges(item);
        }),

        vscode.commands.registerCommand('RemoteTest.uploadCommitFileChange', async (item: ChangeTreeItem) => {
            await changesTreeView.uploadCommitFileChange(item);
        }),

        vscode.commands.registerCommand('RemoteTest.refreshQuickCommands', async () => {
            quickCommandsTreeView.refresh();
        }),

        vscode.commands.registerCommand('RemoteTest.executeQuickCommand', async (item: QuickCommandItem) => {
            await quickCommandsTreeView.executeQuickCommand(item);
        })
    ];

    context.subscriptions.push(...commands);

    logTreeView.start();

    vscode.window.setStatusBarMessage('RemoteTest 插件已启动', 3000);
}

export function deactivate() {
    if (logTreeView) {
        logTreeView.stop();
    }
    if (commandExecutor) {
        commandExecutor.dispose();
    }
    ConnectionPool.getInstance().destroy();
    disposeConfig();
}

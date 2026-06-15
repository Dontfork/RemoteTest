/**
 * 命令注册中心 —— 所有 vscode.commands.registerCommand 集中在此。
 *
 * extension.ts 只需调用 `registerAll(context, services)` 即可完成注册，
 * 不再包含任何具体命令逻辑。
 */
import * as vscode from 'vscode';
import { formatError } from '../pure/errors';
import { resolveFsPath } from './uriResolver';
import { FileUploader } from '../core/uploader';
import { LogTreeView, LogTreeItem } from '../views/logTreeView';
import { ChangesTreeView, ChangeTreeItem } from '../views/changesTreeView';
import { QuickCommandsTreeView, QuickCommandItem } from '../views/quickCommandsTreeView';
import { reloadConfig } from '../config';

/** 服务集合，由 container 传入，避免 registry 自己 new 任何东西。 */
export interface Services {
    fileUploader: FileUploader;
    logTreeView: LogTreeView;
    changesTreeView: ChangesTreeView;
    quickCommandsTreeView: QuickCommandsTreeView;
}

/** 统一注册所有 RemoteTest 命令，返回 disposables 数组。 */
export function registerAll(context: vscode.ExtensionContext, svc: Services): vscode.Disposable[] {
    return [
        /* ---- 文件操作 ---- */
        vscode.commands.registerCommand('RemoteTest.runTestCase', async (uri?: vscode.Uri) => {
            try {
                const fsPath = resolveFsPath(uri);
                if (!fsPath) {
                    vscode.window.setStatusBarMessage('请先选择一个文件或目录', 3000);
                    return;
                }
                await svc.fileUploader.runTestCase(fsPath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`运行用例失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.uploadFile', async (uri?: vscode.Uri) => {
            try {
                const fsPath = resolveFsPath(uri);
                if (!fsPath) {
                    vscode.window.setStatusBarMessage('请先选择一个文件或目录', 3000);
                    return;
                }
                await svc.fileUploader.uploadFile(fsPath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`上传失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.syncFile', async (uri?: vscode.Uri) => {
            try {
                const fsPath = resolveFsPath(uri);
                if (!fsPath) {
                    vscode.window.setStatusBarMessage('请先选择一个文件或目录', 3000);
                    return;
                }
                await svc.fileUploader.syncFile(fsPath);
            } catch (error: any) {
                vscode.window.showErrorMessage(`同步失败: ${formatError(error)}`);
            }
        }),

        /* ---- 日志 ---- */
        vscode.commands.registerCommand('RemoteTest.refreshLogs', () => {
            svc.logTreeView.refresh();
        }),

        vscode.commands.registerCommand('RemoteTest.downloadLog', async (item: LogTreeItem) => {
            try {
                await svc.logTreeView.downloadLog(item);
            } catch (error: any) {
                vscode.window.showErrorMessage(`下载日志失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.openLog', async (item: LogTreeItem) => {
            try {
                await svc.logTreeView.openLogInEditor(item);
            } catch (error: any) {
                vscode.window.showErrorMessage(`打开日志失败: ${formatError(error)}`);
            }
        }),

        /* ---- 配置 ---- */
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
            if (!wsPath) {
                vscode.window.setStatusBarMessage('无法打开配置文件：未找到工作区', 3000);
                return;
            }

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
            vscode.window.showWarningMessage('未找到 RemoteTest 配置文件，请先创建配置文件。');
        }),

        /* ---- 变更树 ---- */
        vscode.commands.registerCommand('RemoteTest.refreshChanges', () => {
            svc.changesTreeView.refresh();
        }),

        vscode.commands.registerCommand('RemoteTest.uploadProjectChanges', async (item: ChangeTreeItem) => {
            try {
                await svc.changesTreeView.uploadProjectChanges(item);
            } catch (error: any) {
                vscode.window.showErrorMessage(`上传变更失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.uploadSelectedChange', async (item: ChangeTreeItem) => {
            try {
                await svc.changesTreeView.uploadSelectedChange(item);
            } catch (error: any) {
                vscode.window.showErrorMessage(`上传文件失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.openChangeFile', async (item: ChangeTreeItem) => {
            try {
                await svc.changesTreeView.openChangeFile(item);
            } catch (error: any) {
                vscode.window.showErrorMessage(`打开文件失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.uploadCommitChanges', async (item: ChangeTreeItem) => {
            try {
                await svc.changesTreeView.uploadCommitChanges(item);
            } catch (error: any) {
                vscode.window.showErrorMessage(`上传 commit 变更失败: ${formatError(error)}`);
            }
        }),

        vscode.commands.registerCommand('RemoteTest.uploadCommitFileChange', async (item: ChangeTreeItem) => {
            try {
                await svc.changesTreeView.uploadCommitFileChange(item);
            } catch (error: any) {
                vscode.window.showErrorMessage(`上传文件失败: ${formatError(error)}`);
            }
        }),

        /* ---- 快捷命令 ---- */
        vscode.commands.registerCommand('RemoteTest.refreshQuickCommands', () => {
            svc.quickCommandsTreeView.refresh();
        }),

        vscode.commands.registerCommand('RemoteTest.executeQuickCommand', async (item: QuickCommandItem) => {
            try {
                await svc.quickCommandsTreeView.executeQuickCommand(item);
            } catch (error: any) {
                vscode.window.showErrorMessage(`命令执行失败: ${formatError(error)}`);
            }
        })
    ];
}

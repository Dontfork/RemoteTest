/**
 * 服务容器 —— 统一创建 & 管理所有服务实例的生命周期。
 *
 * extension.ts 只需调用 `container.init()` 和 `container.dispose()`，
 * 不再了解各服务的构造细节和依赖关系。
 */
import * as vscode from 'vscode';
import { loadConfig, setupConfigWatcher, onConfigChanged, dispose as disposeConfig } from './config';
import { CommandExecutor } from './core/commandExecutor';
import { FileUploader } from './core/uploader';
import { ConnectionPool } from './core/connectionPool';
import { LogTreeView } from './views/logTreeView';
import { ChangesTreeView } from './views/changesTreeView';
import { QuickCommandsTreeView } from './views/quickCommandsTreeView';
import { registerAll, Services } from './commands/registry';

/** 持有的服务引用，方便 deactivate 时统一释放。 */
interface ServiceRefs {
    commandExecutor: CommandExecutor;
    fileUploader: FileUploader;
    logTreeView: LogTreeView;
    changesTreeView: ChangesTreeView;
    quickCommandsTreeView: QuickCommandsTreeView;
}

let services: ServiceRefs | null = null;

/**
 * 初始化所有服务并注册命令。
 *
 * @returns 需要推入 context.subscriptions 的 disposables
 */
export function init(context: vscode.ExtensionContext): void {
    /* 1. 加载配置 */
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspacePath) {
        loadConfig(workspacePath);
    }

    /* 2. 创建服务 */
    const commandExecutor = new CommandExecutor();
    const fileUploader = new FileUploader(commandExecutor);
    const logTreeView = new LogTreeView();
    const changesTreeView = new ChangesTreeView(fileUploader);
    const quickCommandsTreeView = new QuickCommandsTreeView();

    services = { commandExecutor, fileUploader, logTreeView, changesTreeView, quickCommandsTreeView };

    /* 3. 跨服务事件绑定 */
    fileUploader.setOnTestCaseComplete(() => {
        logTreeView.refresh();
    });

    setupConfigWatcher(context);

    onConfigChanged(() => {
        logTreeView.refresh();
        changesTreeView.refresh();
        quickCommandsTreeView.refresh();
    });

    /* 4. 注册命令 */
    const svc: Services = { fileUploader, logTreeView, changesTreeView, quickCommandsTreeView };
    const disposables = registerAll(context, svc);
    context.subscriptions.push(...disposables);

    /* 5. 启动日志监控 */
    logTreeView.start();

    vscode.window.setStatusBarMessage('RemoteTest 插件已启动', 3000);
}

/** 释放所有服务资源。 */
export async function dispose(): Promise<void> {
    if (services) {
        services.logTreeView.stop();
        services.commandExecutor.dispose();
        services = null;
    }
    await ConnectionPool.getInstance().destroy();
    disposeConfig();
}

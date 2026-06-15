/**
 * 配置模块薄壳 —— 所有逻辑委托给 ConfigStore 单例。
 *
 * 保持与原有 `from '../config'` 引用完全兼容的函数签名。
 * 新代码建议直接使用 ConfigStore 实例（可注入、可测试）。
 */
import * as vscode from 'vscode';
import { RemoteTestConfig, ProjectConfig, ServerConfig } from '../types';
import { ConfigStore } from './ConfigStore';
import { defaultConfig, checkPathConflict } from '../pure/configSchema';

/* -------------------------------------------------------------------------- */
/* 单例                                                                       */
/* -------------------------------------------------------------------------- */

let store: ConfigStore | null = null;
let fileWatcher: vscode.FileSystemWatcher | null = null;
let isReloadingConfig = false;

function getStore(): ConfigStore {
    if (!store) {
        store = new ConfigStore();
    }
    return store;
}

/** 获取底层 ConfigStore 实例（用于 DI 场景）。 */
export function getConfigStore(): ConfigStore {
    return getStore();
}

/* -------------------------------------------------------------------------- */
/* 向后兼容的便捷函数（签名与原版完全一致）                                         */
/* -------------------------------------------------------------------------- */

export const onConfigChanged = getStore().onConfigChanged;

export function loadConfig(workspacePath: string): RemoteTestConfig {
    return getStore().loadConfig(workspacePath);
}

export function getConfig(): RemoteTestConfig {
    return getStore().getConfig();
}

export function getRefreshInterval(): number {
    return getStore().getRefreshInterval();
}

export function getUseLogOutputChannel(): boolean {
    return getStore().getUseLogOutputChannel();
}

export function getCommitCount(): number {
    return getStore().getCommitCount();
}

export function getProjectCommitCount(project: ProjectConfig): number {
    return getStore().getProjectCommitCount(project);
}

export function getEnabledProjects(): ProjectConfig[] {
    return getStore().getEnabledProjects();
}

export function getProjectsWithLocalPath(): ProjectConfig[] {
    return getStore().getProjectsWithLocalPath();
}

export function getProjectsWithRemoteDirectory(): ProjectConfig[] {
    return getStore().getProjectsWithRemoteDirectory();
}

export function hasValidLocalPath(project: ProjectConfig): boolean {
    return getStore().hasValidLocalPath(project);
}

export function hasValidRemoteDirectory(project: ProjectConfig): boolean {
    return getStore().hasValidRemoteDirectory(project);
}

export function matchProject(localFilePath: string): ProjectConfig | null {
    return getStore().matchProject(localFilePath);
}

export function getProjectByName(projectName: string): ProjectConfig | null {
    return getStore().getProjectByName(projectName);
}

export function getAllLogDirectories(): { project: ProjectConfig; directory: { name: string; path: string } }[] {
    return getStore().getAllLogDirectories();
}

export function reloadConfig(workspacePath?: string): RemoteTestConfig {
    const wsPath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!wsPath) {
        return getConfig();
    }

    isReloadingConfig = true;
    try {
        return getStore().reloadConfig(wsPath);
    } finally {
        isReloadingConfig = false;
    }
}

export function setupConfigWatcher(context: vscode.ExtensionContext): void {
    if (fileWatcher) {
        fileWatcher.dispose();
    }

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        return;
    }

    const configPath = vscode.workspace.getConfiguration('RemoteTest').get<string>('configPath') || 'RemoteTest-config.json';

    fileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspacePath, `**/${configPath}`),
        false,
        false,
        false
    );

    fileWatcher.onDidChange(() => {
        if (isReloadingConfig) {
            return;
        }
        reloadConfig(workspacePath);
        vscode.window.setStatusBarMessage('RemoteTest 配置已自动刷新', 3000);
    });

    fileWatcher.onDidCreate(() => {
        if (isReloadingConfig) {
            return;
        }
        reloadConfig(workspacePath);
        vscode.window.setStatusBarMessage('RemoteTest 配置文件已创建并加载', 3000);
    });

    fileWatcher.onDidDelete(() => {
        getStore().resetToDefault();
        vscode.window.setStatusBarMessage('RemoteTest 配置文件已删除，使用默认配置', 3000);
    });

    context.subscriptions.push(fileWatcher);
}

export function getConfigFilePath(): string {
    return getStore().getConfigFilePath();
}

export function getServerConfig(serverConfig?: ServerConfig): ServerConfig {
    return getStore().getServerConfig(serverConfig);
}

export function dispose(): void {
    if (fileWatcher) {
        fileWatcher.dispose();
        fileWatcher = null;
    }
    if (store) {
        store.dispose();
        store = null;
    }
}

export { defaultConfig, checkPathConflict };

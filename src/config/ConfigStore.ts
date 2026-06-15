import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    RemoteTestConfig,
    ProjectConfig,
    ServerConfig
} from '../types';
import { validateConfig, fillMissingFields, defaultConfig, checkPathConflict } from '../pure/configSchema';
import { normalizePath } from '../pure/pathUtil';
import { showValidationMessages, saveConfigWithDefaults } from './validatorUI';

/**
 * 配置存储（类封装，替代 config/index.ts 的模块级全局状态）。
 *
 * 设计意图：
 * - 将 `let config` / `let fileWatcher` / `EventEmitter` 收进 class，便于测试时替换实例；
 * - 对外仍提供与原 config/index.ts 等价的方法签名（loadConfig / getConfig / matchProject 等），
 *   以便渐进式迁移；
 * - setupConfigWatcher 仍需 vscode 上下文，保留在 config/index.ts 的薄壳中。
 */
export class ConfigStore {
    private config: RemoteTestConfig | null = null;
    private configFilePath: string = '';
    private changeEmitter = new vscode.EventEmitter<RemoteTestConfig>();

    /** 配置变更事件。 */
    readonly onConfigChanged = this.changeEmitter.event;

    /* ---------------------------------------------------------------------- */
    /* 加载与重载                                                               */
    /* ---------------------------------------------------------------------- */

    loadConfig(workspacePath: string): RemoteTestConfig {
        const configPath = vscode.workspace.getConfiguration('RemoteTest').get<string>('configPath') || 'RemoteTest-config.json';

        const pathsToTry = [
            path.join(workspacePath, '.vscode', configPath),
            path.join(workspacePath, configPath)
        ];

        let fullPath = '';
        for (const p of pathsToTry) {
            if (fs.existsSync(p)) {
                fullPath = p;
                break;
            }
        }

        if (!fullPath) {
            fullPath = pathsToTry[0];
        }

        this.configFilePath = fullPath;

        try {
            if (!fs.existsSync(fullPath)) {
                const vscodeDir = path.join(workspacePath, '.vscode');
                if (!fs.existsSync(vscodeDir)) {
                    fs.mkdirSync(vscodeDir, { recursive: true });
                }
                fs.writeFileSync(fullPath, JSON.stringify(defaultConfig, null, 4), 'utf-8');
                vscode.window.setStatusBarMessage(`已创建默认配置文件: ${path.join('.vscode', configPath)}`, 3000);
                this.config = defaultConfig;
                return this.config as RemoteTestConfig;
            }

            const content = fs.readFileSync(fullPath, 'utf-8');
            const loadedConfig = JSON.parse(content);

            if (loadedConfig.projects && Array.isArray(loadedConfig.projects)) {
                for (const project of loadedConfig.projects) {
                    if (project.enabled === undefined) {
                        project.enabled = true;
                    }
                    if (!project.commands) {
                        project.commands = [];
                    }
                    for (const cmd of project.commands) {
                        if (!cmd.name) {
                            cmd.name = cmd.executeCommand.substring(0, 20);
                        }
                        if (!cmd.includePatterns) {
                            cmd.includePatterns = [];
                        }
                        if (!cmd.excludePatterns) {
                            cmd.excludePatterns = [];
                        }
                    }
                    this.ensureProjectLogs(project);
                }

                const { hasConflict, conflicts } = checkPathConflict(loadedConfig.projects);
                if (hasConflict) {
                    vscode.window.showErrorMessage(
                        `配置警告：检测到工程路径冲突\n${conflicts.join('\n')}\n\n自动禁用冲突的工程配置，请修正配置文件。`,
                        { modal: true }
                    );
                }

                const validationResult = validateConfig(loadedConfig);
                showValidationMessages(validationResult);

                let finalConfig = loadedConfig;
                if (validationResult.missingFields.length > 0) {
                    finalConfig = fillMissingFields(loadedConfig, validationResult.missingFields);
                    saveConfigWithDefaults(fullPath, loadedConfig, finalConfig);
                }

                this.config = {
                    projects: finalConfig.projects,
                    refreshInterval: finalConfig.refreshInterval ?? 0,
                    textFileExtensions: finalConfig.textFileExtensions,
                    clearOutputBeforeRun: finalConfig.clearOutputBeforeRun ?? true,
                    useLogOutputChannel: finalConfig.useLogOutputChannel ?? true,
                    logViewer: finalConfig.logViewer ?? "",
                    commitCount: finalConfig.commitCount ?? 1
                };
            } else {
                vscode.window.showErrorMessage('配置文件格式错误：缺少 projects 数组，请检查配置文件格式');
                this.config = defaultConfig;
            }

            return this.config as RemoteTestConfig;
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `RemoteTest 配置文件加载失败: ${error.message}，已回退到默认配置。请检查配置文件格式。`
            );
            this.config = defaultConfig;
            return this.config as RemoteTestConfig;
        }
    }

    reloadConfig(workspacePath?: string): RemoteTestConfig {
        const wsPath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsPath) {
            return this.getConfig();
        }

        const oldConfig = this.config;
        const newConfig = this.loadConfig(wsPath);

        if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
            this.changeEmitter.fire(newConfig);
        }

        return newConfig;
    }

    /** 重置为默认配置（如配置文件被删除时调用）。 */
    resetToDefault(): void {
        this.config = defaultConfig;
        this.changeEmitter.fire(defaultConfig);
    }

    /* ---------------------------------------------------------------------- */
    /* 查询                                                                     */
    /* ---------------------------------------------------------------------- */

    getConfig(): RemoteTestConfig {
        return this.config || defaultConfig;
    }

    getRefreshInterval(): number {
        return this.getConfig().refreshInterval ?? 5000;
    }

    getUseLogOutputChannel(): boolean {
        return this.getConfig().useLogOutputChannel ?? true;
    }

    getCommitCount(): number {
        return this.getConfig().commitCount ?? 1;
    }

    getProjectCommitCount(project: ProjectConfig): number {
        return project.commitCount ?? this.getCommitCount();
    }

    getEnabledProjects(): ProjectConfig[] {
        return this.getConfig().projects.filter(p => p.enabled !== false);
    }

    getProjectsWithLocalPath(): ProjectConfig[] {
        return this.getConfig().projects.filter(p =>
            p.enabled !== false && p.localPath && p.localPath.trim() !== ''
        );
    }

    getProjectsWithRemoteDirectory(): ProjectConfig[] {
        return this.getConfig().projects.filter(p =>
            p.enabled !== false && p.server?.remoteDirectory && p.server.remoteDirectory.trim() !== ''
        );
    }

    hasValidLocalPath(project: ProjectConfig): boolean {
        return !!(project.localPath && project.localPath.trim() !== '');
    }

    hasValidRemoteDirectory(project: ProjectConfig): boolean {
        return !!(project.server?.remoteDirectory && project.server.remoteDirectory.trim() !== '');
    }

    matchProject(localFilePath: string): ProjectConfig | null {
        const currentConfig = this.getConfig();
        if (!currentConfig.projects || currentConfig.projects.length === 0) {
            return null;
        }

        const normalizedFilePath = normalizePath(localFilePath);
        const enabledProjects = currentConfig.projects.filter(p => p.enabled !== false);

        let bestMatch: ProjectConfig | null = null;
        let bestMatchLength = 0;

        for (const project of enabledProjects) {
            if (!project.localPath) {
                continue;
            }
            const normalizedProjectPath = normalizePath(project.localPath);

            if (normalizedFilePath.startsWith(normalizedProjectPath + path.sep) ||
                normalizedFilePath === normalizedProjectPath) {
                if (normalizedProjectPath.length > bestMatchLength) {
                    bestMatch = project;
                    bestMatchLength = normalizedProjectPath.length;
                }
            }
        }

        return bestMatch;
    }

    getProjectByName(projectName: string): ProjectConfig | null {
        return this.getConfig().projects.find(p => p.name === projectName && p.enabled !== false) || null;
    }

    getAllLogDirectories(): { project: ProjectConfig; directory: { name: string; path: string } }[] {
        const result: { project: ProjectConfig; directory: { name: string; path: string } }[] = [];

        for (const project of this.getConfig().projects) {
            if (project.enabled === false) {
                continue;
            }
            if (project.logs && project.logs.directories) {
                for (const dir of project.logs.directories) {
                    result.push({ project, directory: dir });
                }
            }
        }

        return result;
    }

    getConfigFilePath(): string {
        return this.configFilePath;
    }

    /**
     * 获取第一个启用项目的服务器配置（便捷方法）。
     * 如提供了 serverConfig 则直接返回。
     */
    getServerConfig(serverConfig?: ServerConfig): ServerConfig {
        if (serverConfig) {
            return serverConfig;
        }
        throw new Error('未指定服务器配置，请传入 serverConfig 参数');
    }

    /* ---------------------------------------------------------------------- */
    /* 生命周期                                                                 */
    /* ---------------------------------------------------------------------- */

    dispose(): void {
        this.changeEmitter.dispose();
    }

    /* ---------------------------------------------------------------------- */
    /* 内部辅助                                                                 */
    /* ---------------------------------------------------------------------- */

    private ensureProjectLogs(project: any): void {
        if (!project.logs) {
            project.logs = { directories: [], downloadPath: "" };
        }
        if (!project.logs.directories) {
            project.logs.directories = [];
        }
        if (!project.logs.downloadPath) {
            project.logs.downloadPath = "";
        }
    }
}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { 
    RemoteTestConfig, 
    ProjectConfig, 
    CommandConfig,
    ProjectLogsConfig,
    ServerConfig
} from '../types';
import { validateConfig, fillMissingFields } from './validator';
import { showValidationMessages, saveConfigWithDefaults } from './validatorUI';

const defaultConfig: RemoteTestConfig = {
    projects: [
        {
            name: "我的测试项目",
            localPath: "",
            enabled: true,
            server: {
                host: "192.168.1.100",
                port: 22,
                username: "root",
                password: "",
                privateKeyPath: "",
                remoteDirectory: "/home/user/project"
            },
            commands: [
                {
                    name: "运行测试",
                    executeCommand: "pytest {filePath} -v",
                    runnable: true,
                    clearOutputBeforeRun: true,
                    includePatterns: [],
                    excludePatterns: []
                }
            ],
            logs: {
                directories: [
                    { name: "应用日志", path: "/var/log/app" }
                ],
                downloadPath: "D:\\downloads\\logs"
            },
            textFileExtensions: [],
            commitCount: 1
        }
    ],
    refreshInterval: 0,
    useLogOutputChannel: true,
    textFileExtensions: [],
    logViewer: "",
    commitCount: 1
};

function deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key in source) {
        if (source[key] !== undefined) {
            if (
                typeof source[key] === 'object' &&
                source[key] !== null &&
                !Array.isArray(source[key]) &&
                typeof target[key] === 'object' &&
                target[key] !== null
            ) {
                result[key] = deepMerge(target[key], source[key] as any);
            } else {
                result[key] = source[key] as any;
            }
        }
    }
    return result;
}

function normalizePath(p: string): string {
    return path.normalize(p).toLowerCase();
}

function checkPathConflict(projects: ProjectConfig[]): { hasConflict: boolean; conflicts: string[] } {
    const conflicts: string[] = [];
    const enabledProjects: ProjectConfig[] = [];
    
    for (const project of projects) {
        if (!project.localPath) {
            continue;
        }
        
        const normalizedPath = normalizePath(project.localPath);
        
        for (const existing of enabledProjects) {
            if (!existing.localPath) {
                continue;
            }
            const existingPath = normalizePath(existing.localPath);
            
            if (normalizedPath.startsWith(existingPath + path.sep) || 
                existingPath.startsWith(normalizedPath + path.sep)) {
                conflicts.push(`工程 "${project.name}" (${project.localPath}) 与工程 "${existing.name}" (${existing.localPath}) 存在路径包含关系`);
                project.enabled = false;
                break;
            }
        }
        
        if (project.enabled !== false) {
            enabledProjects.push(project);
        }
    }
    
    return { hasConflict: conflicts.length > 0, conflicts };
}

let config: RemoteTestConfig | null = null;
let configFilePath: string = '';
let fileWatcher: vscode.FileSystemWatcher | null = null;
let configChangeEmitter = new vscode.EventEmitter<RemoteTestConfig>();
let isReloadingConfig = false;

export const onConfigChanged = configChangeEmitter.event;

function ensureProjectLogs(project: any): void {
    if (!project.logs) {
        project.logs = {
            directories: [],
            downloadPath: ""
        };
    }
    if (!project.logs.directories) {
        project.logs.directories = [];
    }
    if (!project.logs.downloadPath) {
        project.logs.downloadPath = "";
    }
}

export function loadConfig(workspacePath: string): RemoteTestConfig {
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

    console.log('[RemoteTest] Config paths checked:', pathsToTry);
    console.log('[RemoteTest] Config file found at:', fullPath);

    if (!fullPath) {
        fullPath = pathsToTry[0];
    }

    configFilePath = fullPath;

    try {
        if (!fs.existsSync(fullPath)) {
            console.log('[RemoteTest] Config file not found, creating default config...');
            const vscodeDir = path.join(workspacePath, '.vscode');
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir, { recursive: true });
            }
            fs.writeFileSync(fullPath, JSON.stringify(defaultConfig, null, 4), 'utf-8');
            console.log('[RemoteTest] Default config created at:', fullPath);
            vscode.window.setStatusBarMessage(`已创建默认配置文件: ${path.join('.vscode', configPath)}`, 3000);
            config = defaultConfig;
            return config as RemoteTestConfig;
        } else {
            console.log('[RemoteTest] Config file exists, loading...');
        }
        
        const content = fs.readFileSync(fullPath, 'utf-8');
        const loadedConfig = JSON.parse(content);
        console.log('[RemoteTest] Loaded config projects:', loadedConfig.projects?.length);
        
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
                
                ensureProjectLogs(project);
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
            
            config = {
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
            config = defaultConfig;
        }
        
        return config as RemoteTestConfig;
    } catch (error: any) {
        vscode.window.showErrorMessage(
            `RemoteTest 配置文件加载失败: ${error.message}，已回退到默认配置。请检查配置文件格式。`
        );
        config = defaultConfig;
        return config as RemoteTestConfig;
    }
}

export function getConfig(): RemoteTestConfig {
    return config || defaultConfig;
}

export function getRefreshInterval(): number {
    const currentConfig = getConfig();
    return currentConfig.refreshInterval ?? 5000;
}

export function getUseLogOutputChannel(): boolean {
    const currentConfig = getConfig();
    return currentConfig.useLogOutputChannel ?? true;
}

export function getCommitCount(): number {
    const currentConfig = getConfig();
    return currentConfig.commitCount ?? 1;
}

export function getProjectCommitCount(project: ProjectConfig): number {
    return project.commitCount ?? getCommitCount();
}

export function getEnabledProjects(): ProjectConfig[] {
    const currentConfig = getConfig();
    return currentConfig.projects.filter(p => p.enabled !== false);
}

export function getProjectsWithLocalPath(): ProjectConfig[] {
    const currentConfig = getConfig();
    return currentConfig.projects.filter(p => 
        p.enabled !== false && p.localPath && p.localPath.trim() !== ''
    );
}

export function getProjectsWithRemoteDirectory(): ProjectConfig[] {
    const currentConfig = getConfig();
    return currentConfig.projects.filter(p => 
        p.enabled !== false && p.server?.remoteDirectory && p.server.remoteDirectory.trim() !== ''
    );
}

export function hasValidLocalPath(project: ProjectConfig): boolean {
    return !!(project.localPath && project.localPath.trim() !== '');
}

export function hasValidRemoteDirectory(project: ProjectConfig): boolean {
    return !!(project.server?.remoteDirectory && project.server.remoteDirectory.trim() !== '');
}

export function matchProject(localFilePath: string): ProjectConfig | null {
    const currentConfig = getConfig();
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

export function getProjectByName(projectName: string): ProjectConfig | null {
    const currentConfig = getConfig();
    return currentConfig.projects.find(p => p.name === projectName && p.enabled !== false) || null;
}

export function getAllLogDirectories(): { project: ProjectConfig; directory: { name: string; path: string } }[] {
    const result: { project: ProjectConfig; directory: { name: string; path: string } }[] = [];
    const currentConfig = getConfig();
    
    for (const project of currentConfig.projects) {
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

export function reloadConfig(workspacePath?: string): RemoteTestConfig {
    const wsPath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!wsPath) {
        return getConfig();
    }
    
    isReloadingConfig = true;
    
    try {
        const oldConfig = config;
        const newConfig = loadConfig(wsPath);
        
        if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
            configChangeEmitter.fire(newConfig);
        }
        
        return newConfig;
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

    fileWatcher.onDidChange((uri) => {
        if (isReloadingConfig) {
            return;
        }
        reloadConfig(workspacePath);
        vscode.window.setStatusBarMessage('RemoteTest 配置已自动刷新', 3000);
    });

    fileWatcher.onDidCreate((uri) => {
        if (isReloadingConfig) {
            return;
        }
        reloadConfig(workspacePath);
        vscode.window.setStatusBarMessage('RemoteTest 配置文件已创建并加载', 3000);
    });

    fileWatcher.onDidDelete((uri) => {
        config = defaultConfig;
        configChangeEmitter.fire(defaultConfig);
        vscode.window.setStatusBarMessage('RemoteTest 配置文件已删除，使用默认配置', 3000);
    });

    context.subscriptions.push(fileWatcher);
}

export function getConfigFilePath(): string {
    return configFilePath;
}

export function dispose(): void {
    if (fileWatcher) {
        fileWatcher.dispose();
        fileWatcher = null;
    }
    configChangeEmitter.dispose();
}

/**
 * 获取第一个启用项目的服务器配置
 * 
 * 这是一个便捷方法，用于获取当前配置中第一个启用项目的服务器配置。
 * 如果提供了serverConfig参数，则直接返回该配置。
 * 
 * @param serverConfig - 可选的服务器配置，如果提供则直接返回
 * @returns 服务器配置对象
 * @throws {Error} 当没有配置项目或没有启用的项目时抛出错误
 * 
 * @example
 * ```typescript
 * // 获取默认项目的服务器配置
 * const serverConfig = getServerConfig();
 * 
 * // 使用自定义服务器配置
 * const customConfig = { host: '192.168.1.100', ... };
 * const config = getServerConfig(customConfig); // 返回 customConfig
 * ```
 */
export function getServerConfig(serverConfig?: ServerConfig): ServerConfig {
    if (serverConfig) {
        return serverConfig;
    }
    
    throw new Error('未指定服务器配置，请传入 serverConfig 参数');
}

export { defaultConfig, checkPathConflict };

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { 
    RemoteTestConfig, 
    ProjectConfig, 
    CommandConfig,
    LegacyRemoteTestConfig,
    LegacyLogsConfig,
    AIConfig,
    ProjectLogsConfig
} from '../types';
import { validateConfig, fillMissingFields } from './validator';
import { showValidationMessages, saveConfigWithDefaults } from './validatorUI';

const defaultAIConfig: AIConfig = {
    models: []
};

const defaultConfig: RemoteTestConfig = {
    projects: [],
    ai: defaultAIConfig,
    refreshInterval: 0
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

function convertLegacyLogsConfig(legacyLogs: LegacyLogsConfig | undefined, projectName: string): ProjectLogsConfig {
    const directories = (legacyLogs?.directories || []).map(dir => ({
        name: dir.name,
        path: dir.path
    }));
    
    return {
        directories,
        downloadPath: legacyLogs?.downloadPath || ""
    };
}

function convertLegacyConfig(legacy: LegacyRemoteTestConfig, workspacePath: string): RemoteTestConfig {
    const projects: ProjectConfig[] = [];
    
    if (legacy.server) {
        const defaultCommand: CommandConfig = {
            name: "默认命令",
            executeCommand: legacy.command?.executeCommand || "pytest {filePath} -v",
            includePatterns: legacy.command?.filterPatterns || ["error", "failed", "FAILED", "Error", "ERROR"],
            excludePatterns: []
        };
        
        if (legacy.command?.filterMode === 'exclude') {
            defaultCommand.includePatterns = [];
            defaultCommand.excludePatterns = legacy.command?.filterPatterns || [];
        }
        
        const project: ProjectConfig = {
            name: "默认工程",
            localPath: legacy.server.localProjectPath || workspacePath,
            enabled: true,
            server: {
                host: legacy.server.host,
                port: legacy.server.port,
                username: legacy.server.username,
                password: legacy.server.password,
                privateKeyPath: legacy.server.privateKeyPath,
                remoteDirectory: legacy.server.remoteDirectory
            },
            commands: [defaultCommand],
            logs: convertLegacyLogsConfig(legacy.logs, "默认工程")
        };
        projects.push(project);
    }
    
    if (legacy.projects && legacy.projects.length > 0) {
        for (const project of legacy.projects as any[]) {
            if (project.commands) {
                for (const cmd of project.commands) {
                    if (cmd.filterPatterns && !cmd.includePatterns && !cmd.excludePatterns) {
                        if (cmd.filterMode === 'exclude') {
                            cmd.excludePatterns = cmd.filterPatterns;
                            cmd.includePatterns = [];
                        } else {
                            cmd.includePatterns = cmd.filterPatterns;
                            cmd.excludePatterns = [];
                        }
                        delete cmd.filterPatterns;
                        delete cmd.filterMode;
                    }
                }
            }
            
            if (!project.logs && legacy.logs) {
                project.logs = convertLegacyLogsConfig(legacy.logs, project.name);
            }
        }
        projects.push(...legacy.projects);
    }
    
    return {
        projects,
        ai: legacy.ai || defaultAIConfig
    };
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

    if (!fullPath) {
        fullPath = pathsToTry[0];
    }

    configFilePath = fullPath;

    try {
        if (!fs.existsSync(fullPath)) {
            const vscodeDir = path.join(workspacePath, '.vscode');
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir, { recursive: true });
            }
            fs.writeFileSync(fullPath, JSON.stringify(defaultConfig, null, 4), 'utf-8');
            vscode.window.showInformationMessage(`已创建默认配置文件: ${path.join('.vscode', configPath)}`);
            config = defaultConfig;
            return config as RemoteTestConfig;
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
                    if ((cmd as any).filterPatterns && !cmd.includePatterns && !cmd.excludePatterns) {
                        if ((cmd as any).filterMode === 'exclude') {
                            cmd.excludePatterns = (cmd as any).filterPatterns;
                            cmd.includePatterns = [];
                        } else {
                            cmd.includePatterns = (cmd as any).filterPatterns;
                            cmd.excludePatterns = [];
                        }
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
                    `配置警告：检测到工程路径冲突\n${conflicts.join('\n')}\n自动禁用冲突的工程配置，请修正配置文件。`
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
                ai: deepMerge(defaultAIConfig, finalConfig.ai || {}),
                refreshInterval: finalConfig.refreshInterval ?? 0,
                textFileExtensions: finalConfig.textFileExtensions,
                clearOutputBeforeRun: finalConfig.clearOutputBeforeRun ?? true,
                useLogOutputChannel: finalConfig.useLogOutputChannel ?? true
            };
        } else {
            config = convertLegacyConfig(loadedConfig, workspacePath);
            vscode.window.showInformationMessage('已将旧版配置格式转换为新版多工程格式，建议更新配置文件');
        }
        
        return config as RemoteTestConfig;
    } catch (error: any) {
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
        vscode.window.showInformationMessage('RemoteTest 配置已自动刷新');
    });

    fileWatcher.onDidCreate((uri) => {
        if (isReloadingConfig) {
            return;
        }
        reloadConfig(workspacePath);
        vscode.window.showInformationMessage('RemoteTest 配置文件已创建并加载');
    });

    fileWatcher.onDidDelete((uri) => {
        config = defaultConfig;
        configChangeEmitter.fire(defaultConfig);
        vscode.window.showWarningMessage('RemoteTest 配置文件已删除，使用默认配置');
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

export { defaultConfig, checkPathConflict };

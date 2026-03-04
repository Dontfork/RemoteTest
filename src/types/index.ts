export interface ServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    privateKeyPath: string;
    remoteDirectory?: string;
}

export interface CommandConfig {
    name: string;
    executeCommand: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    runnable?: boolean;
    clearOutputBeforeRun?: boolean;
}

export interface CommandVariables {
    filePath: string;
    fileName: string;
    fileDir: string;
    localPath: string;
    localDir: string;
    localFileName: string;
    remoteDir: string;
}

export interface LogDirectoryConfig {
    name: string;
    path: string;
}

export interface ProjectLogsConfig {
    directories: LogDirectoryConfig[];
    downloadPath: string;
}

export interface ProjectConfig {
    name: string;
    localPath?: string;
    enabled?: boolean;
    server: ServerConfig;
    commands?: CommandConfig[];
    logs?: ProjectLogsConfig;
}

export interface RemoteTestConfig {
    projects: ProjectConfig[];
    refreshInterval?: number;
    textFileExtensions?: string[];
    clearOutputBeforeRun?: boolean;
    useLogOutputChannel?: boolean;
    logViewer?: string;
}

export interface LegacyServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    privateKeyPath: string;
    localProjectPath: string;
    remoteDirectory: string;
}

export interface LegacyCommandConfig {
    executeCommand: string;
    filterPatterns: string[];
    filterMode: 'include' | 'exclude';
    includePatterns?: string[];
    excludePatterns?: string[];
}

export interface LegacyLogsConfig {
    directories: LogDirectoryConfig[];
    downloadPath: string;
    refreshInterval: number;
}

export interface LegacyRemoteTestConfig {
    server?: LegacyServerConfig;
    command?: LegacyCommandConfig;
    logs?: LegacyLogsConfig;
    projects?: ProjectConfig[];
}

export interface LogFile {
    name: string;
    path: string;
    size: number;
    modifiedTime: Date;
    isDirectory: boolean;
}

export interface ProjectMatchResult {
    project: ProjectConfig;
    command?: CommandConfig;
}

export type GitChangeType = 'added' | 'modified' | 'deleted' | 'renamed' | 'moved';

export interface GitChange {
    path: string;
    relativePath: string;
    displayPath: string;
    type: GitChangeType;
    project: ProjectConfig;
    oldRelativePath?: string;
    oldPath?: string;
}

export interface GitChangeGroup {
    projectName: string;
    project: ProjectConfig;
    changes: GitChange[];
}

export interface QuickCommand {
    name: string;
    executeCommand: string;
    projectName: string;
    project: ProjectConfig;
    clearOutputBeforeRun?: boolean;
}

export interface QuickCommandGroup {
    projectName: string;
    project: ProjectConfig;
    commands: QuickCommand[];
}

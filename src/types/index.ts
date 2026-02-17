export interface ServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    privateKeyPath: string;
    remoteDirectory?: string;
}

export interface OutputColorRule {
    pattern: string;
    color: 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'magenta' | 'white' | 'gray';
}

export interface CommandConfig {
    name: string;
    executeCommand: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    colorRules?: OutputColorRule[];
    runnable?: boolean;
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

export interface AIModelConfig {
    name: string;
    apiKey?: string;
    apiUrl?: string;
}

export interface AIConfig {
    models: AIModelConfig[];
    defaultModel?: string;
    proxy?: string;
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

export interface AutoTestConfig {
    projects: ProjectConfig[];
    ai: AIConfig;
    refreshInterval?: number;
    textFileExtensions?: string[];
    outputMode?: 'terminal' | 'channel';
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

export interface LegacyAutoTestConfig {
    server?: LegacyServerConfig;
    command?: LegacyCommandConfig;
    ai?: AIConfig;
    logs?: LegacyLogsConfig;
    projects?: ProjectConfig[];
}

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIResponse {
    content: string;
    error?: string;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: AIMessage[];
    createdAt: number;
    updatedAt: number;
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
}

export interface QuickCommandGroup {
    projectName: string;
    project: ProjectConfig;
    commands: QuickCommand[];
}

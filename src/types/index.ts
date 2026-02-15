export interface ServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    privateKeyPath: string;
    localProjectPath: string;
    remoteDirectory: string;
}

export interface CommandConfig {
    executeCommand: string;
    filterPatterns: string[];
    filterMode: 'include' | 'exclude';
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

export interface QWenConfig {
    apiKey: string;
    apiUrl: string;
    model: string;
}

export interface OpenAIConfig {
    apiKey: string;
    apiUrl: string;
    model: string;
}

export interface AIConfig {
    provider: 'qwen' | 'openai';
    qwen: QWenConfig;
    openai: OpenAIConfig;
}

export interface LogDirectoryConfig {
    name: string;
    path: string;
}

export interface LogsConfig {
    directories: LogDirectoryConfig[];
    downloadPath: string;
    refreshInterval: number;
}

export interface AutoTestConfig {
    server: ServerConfig;
    command: CommandConfig;
    ai: AIConfig;
    logs: LogsConfig;
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

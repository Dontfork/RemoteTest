export interface ServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    uploadUrl: string;
    executeCommand: string;
    logDirectory: string;
    downloadPath: string;
}

export interface CommandConfig {
    executeCommand: string;
    filterPatterns: string[];
    filterMode: 'include' | 'exclude';
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

export interface LogsConfig {
    monitorDirectory: string;
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

export interface LogFile {
    name: string;
    path: string;
    size: number;
    modifiedTime: Date;
}

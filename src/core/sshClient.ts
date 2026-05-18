import * as vscode from 'vscode';
import { Client, ConnectConfig } from 'ssh2';
import { ServerConfig, CommandConfig } from '../types';
import { 
    filterCommandOutput, 
    stripAnsiEscapeCodes,
    matchPattern
} from '../utils/outputFilter';
import { UnifiedOutputChannel } from '../utils/outputChannel';
import { createSSHAuthConfig } from '../utils/auth';

let isCommandExecuting = false;

export function isExecuting(): boolean {
    return isCommandExecuting;
}

export function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message || error.toString();
    }
    if (typeof error === 'string') {
        return error;
    }
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

export function fullErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        const parts: string[] = [error.message || error.toString()];
        if (error.stack) {
            parts.push(`\n--- 堆栈 ---\n${error.stack}`);
        }
        return parts.join('');
    }
    return formatError(error);
}

function getLogLevel(line: string): 'info' | 'warn' | 'error' | 'trace' {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('[error]') || lowerLine.includes('[err]') || 
        lowerLine.includes('error:') || lowerLine.includes('exception') ||
        lowerLine.includes('failed') || lowerLine.includes('failure')) {
        return 'error';
    }
    if (lowerLine.includes('[warn]') || lowerLine.includes('[warning]') ||
        lowerLine.includes('warn:') || lowerLine.includes('warning:')) {
        return 'warn';
    }
    if (lowerLine.includes('[debug]') || lowerLine.includes('[trace]')) {
        return 'trace';
    }
    return 'info';
}

function shouldExcludeLine(line: string, excludePatterns: string[]): boolean {
    if (!excludePatterns || excludePatterns.length === 0) {
        return false;
    }
    return excludePatterns.some(pattern => matchPattern(line, pattern));
}

function shouldIncludeLine(line: string, includePatterns: string[]): boolean {
    if (!includePatterns || includePatterns.length === 0) {
        return true;
    }
    return includePatterns.some(pattern => matchPattern(line, pattern));
}

export class SSHClient {
    private client: Client | null = null;
    private connected: boolean = false;
    private serverConfig: ServerConfig | null = null;
    private connectPromise: Promise<Client> | null = null;

    constructor(serverConfig?: ServerConfig) {
        this.serverConfig = serverConfig || null;
    }

    async connect(): Promise<Client> {
        if (this.client && this.connected) {
            return this.client;
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        if (!this.serverConfig) {
            throw new Error('未指定服务器配置，无法建立 SSH 连接');
        }

        this.connectPromise = this.doConnect();

        try {
            const client = await this.connectPromise;
            return client;
        } finally {
            this.connectPromise = null;
        }
    }

    private async doConnect(): Promise<Client> {
        const serverConfig = this.serverConfig!;
        const sshConfig: ConnectConfig = {
            host: serverConfig.host,
            port: serverConfig.port,
            username: serverConfig.username,
            readyTimeout: 30000,
            keepaliveInterval: 30000,
            keepaliveCountMax: 3
        };

        const authConfig = createSSHAuthConfig(serverConfig);
        Object.assign(sshConfig, authConfig);

        return new Promise((resolve, reject) => {
            const newClient = new Client();
            
            newClient.on('ready', () => {
                this.client = newClient;
                this.connected = true;
                resolve(newClient);
            });

            newClient.on('error', (err) => {
                this.connected = false;
                this.client = null;
                reject(new Error(`SSH 连接失败: ${err.message}`));
            });

            newClient.on('close', () => {
                this.connected = false;
                this.client = null;
            });

            newClient.connect(sshConfig);
        });
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            this.client.end();
            this.client = null;
            this.connected = false;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    getClient(): Client | null {
        return this.client;
    }
}

export interface ExecuteResult {
    stdout: string;
    stderr: string;
    code: number;
    filteredOutput: string;
}

const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;

let commandTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

function clearCommandLock(): void {
    isCommandExecuting = false;
    if (commandTimeoutHandle) {
        clearTimeout(commandTimeoutHandle);
        commandTimeoutHandle = null;
    }
}

export async function executeRemoteCommand(
    command: string,
    outputChannel?: UnifiedOutputChannel,
    serverConfig?: ServerConfig,
    commandConfig?: Partial<CommandConfig>,
    clearOutput?: boolean
): Promise<ExecuteResult> {
    if (isCommandExecuting) {
        throw new Error('当前有命令正在执行中，请等待执行完成后再试');
    }
    
    isCommandExecuting = true;
    const sshClient = new SSHClient(serverConfig);
    
    try {
        const client = await sshClient.connect();
        if (!serverConfig) {
            throw new Error('未指定服务器配置，无法执行命令');
        }
        const finalServerConfig = serverConfig;

        const includePatterns = commandConfig?.includePatterns || [];
        const excludePatterns = commandConfig?.excludePatterns || [];

        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let exitCode = 0;
            let settled = false;

            const settle = (fn: () => void) => {
                if (!settled) {
                    settled = true;
                    clearCommandLock();
                    fn();
                }
            };

            commandTimeoutHandle = setTimeout(() => {
                settle(() => {
                    if (outputChannel) {
                        outputChannel.error('└─ 命令执行超时 (5分钟) — 已强制终止');
                        outputChannel.show();
                    }
                    sshClient.disconnect();
                    reject(new Error(`命令执行超时 (${COMMAND_TIMEOUT_MS / 1000}秒): ${command}`));
                });
            }, COMMAND_TIMEOUT_MS);

            const fullCommand = finalServerConfig.remoteDirectory 
                ? `cd ${finalServerConfig.remoteDirectory} && ${command}`
                : command;
            
            if (outputChannel) {
                if (clearOutput) {
                    outputChannel.clear();
                }
                outputChannel.info('');
                outputChannel.info(`┌─ 执行命令 ${'─'.repeat(48)}`);
                outputChannel.info(`│ ${finalServerConfig.username}@${finalServerConfig.host}:${finalServerConfig.port}`);
                outputChannel.info(`│ ${fullCommand}`);
                outputChannel.info(`├─ 输出 ${'─'.repeat(52)}`);
                outputChannel.show();
            }

            client.exec(fullCommand, (err, stream) => {
                if (err) {
                    settle(() => {
                        reject(new Error(`命令执行失败: ${err.message}`));
                    });
                    return;
                }

                stream.on('close', (code: number, signal: string) => {
                    exitCode = code;
                    
                    settle(() => {
                        if (outputChannel) {
                            if (code === 0) {
                                outputChannel.info(`└─ 完成 (退出码: ${code}) ${'─'.repeat(42)}`);
                            } else {
                                outputChannel.error(`└─ 完成 (退出码: ${code}) ${'─'.repeat(42)}`);
                            }
                            outputChannel.show();
                        }
                        
                        const combinedOutput = stdout + stderr;
                        const cleanOutput = stripAnsiEscapeCodes(combinedOutput);
                        const filteredOutput = filterCommandOutput(cleanOutput, includePatterns, excludePatterns);
                        
                        resolve({ stdout, stderr, code: exitCode, filteredOutput });
                        sshClient.disconnect();
                    });
                });

                stream.on('error', (streamErr: Error) => {
                    settle(() => {
                        if (outputChannel) {
                            outputChannel.error(`└─ 流错误: ${streamErr.message}`);
                            outputChannel.show();
                        }
                        const combinedOutput = stdout + stderr;
                        const cleanOutput = stripAnsiEscapeCodes(combinedOutput);
                        const filteredOutput = filterCommandOutput(cleanOutput, includePatterns, excludePatterns);
                        resolve({ stdout, stderr, code: -1, filteredOutput });
                        sshClient.disconnect();
                    });
                });

                stream.on('data', (data: Buffer) => {
                    const text = data.toString();
                    stdout += text;
                    
                    if (outputChannel) {
                        const cleanText = stripAnsiEscapeCodes(text);
                        const lines = cleanText.split('\n');
                        for (const line of lines) {
                            if (line.trim()) {
                                if (shouldExcludeLine(line, excludePatterns)) {
                                    continue;
                                }
                                if (!shouldIncludeLine(line, includePatterns)) {
                                    continue;
                                }
                                
                                const level = getLogLevel(line);
                                const prefix = '│ ';
                                switch (level) {
                                    case 'error':
                                        outputChannel.error(prefix + line);
                                        break;
                                    case 'warn':
                                        outputChannel.warn(prefix + line);
                                        break;
                                    case 'trace':
                                        outputChannel.trace(prefix + line);
                                        break;
                                    default:
                                        outputChannel.info(prefix + line);
                                }
                            }
                        }
                    }
                });

                stream.stderr.on('data', (data: Buffer) => {
                    const text = data.toString();
                    stderr += text;
                    
                    if (outputChannel) {
                        const cleanText = stripAnsiEscapeCodes(text);
                        const lines = cleanText.split('\n');
                        for (const line of lines) {
                            if (line.trim()) {
                                if (shouldExcludeLine(line, excludePatterns)) {
                                    continue;
                                }
                                if (!shouldIncludeLine(line, includePatterns)) {
                                    continue;
                                }
                                outputChannel.error('│ ' + line);
                            }
                        }
                    }
                });
            });
        });
    } catch (error) {
        clearCommandLock();
        await sshClient.disconnect();
        throw error;
    }
}

export { filterCommandOutput, stripAnsiEscapeCodes } from '../utils/outputFilter';

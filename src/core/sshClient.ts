import * as vscode from 'vscode';
import { Client, ConnectConfig } from 'ssh2';
import { ServerConfig, CommandConfig } from '../types';
import {
    filterCommandOutput,
    stripAnsiEscapeCodes,
    matchPattern,
    getLogLevel
} from '../pure/outputFilter';
import { UnifiedOutputChannel } from '../utils/outputChannel';
import { createSSHAuthConfig } from '../utils/auth';
import { CommandLock } from '../services/CommandLock';



/** 全局命令执行锁（向后兼容）。新代码建议注入 CommandLock 实例。 */
const globalCommandLock = new CommandLock();

export function isExecuting(): boolean {
    return globalCommandLock.isExecuting();
}

/** 获取全局命令锁实例（用于 DI 场景）。 */
export function getGlobalCommandLock(): CommandLock {
    return globalCommandLock;
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
            
            const onError = (err: Error) => {
                this.connected = false;
                this.client = null;
                reject(new Error(`SSH 连接失败: ${err.message}`));
            };

            newClient.on('ready', () => {
                newClient.removeListener('error', onError);
                this.client = newClient;
                this.connected = true;
                resolve(newClient);
            });

            newClient.on('error', onError);

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

const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

let commandTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

export async function executeRemoteCommand(
    command: string,
    outputChannel?: UnifiedOutputChannel,
    serverConfig?: ServerConfig,
    commandConfig?: Partial<CommandConfig>,
    clearOutput?: boolean
): Promise<ExecuteResult> {
    if (!globalCommandLock.tryAcquire()) {
        throw new Error('当前有命令正在执行中，请等待执行完成后再试');
    }

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
                    if (commandTimeoutHandle) {
                        clearTimeout(commandTimeoutHandle);
                        commandTimeoutHandle = null;
                    }
                    globalCommandLock.release();
                    fn();
                }
            };

            commandTimeoutHandle = setTimeout(() => {
                settle(() => {
                    if (outputChannel) {
                        outputChannel.error('└─ 命令执行超时 (2分钟) — 已强制终止');
                        outputChannel.show();
                    }
                    sshClient.disconnect();
                    reject(new Error(`命令执行超时 (${COMMAND_TIMEOUT_MS / 1000}秒): ${command}`));
                });
            }, COMMAND_TIMEOUT_MS);

            if (!sshClient.isConnected()) {
                settle(() => {
                    reject(new Error('SSH 连接已断开，无法执行命令'));
                });
                return;
            }

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

                const finish = (code: number) => {
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
                        
                        resolve({ stdout, stderr, code, filteredOutput });
                        sshClient.disconnect();
                    });
                };

                // exit 事件是命令真正的结束信号（包含真实退出码），优先使用
                stream.on('exit', (code: number, signal: string) => {
                    if (!settled) {
                        exitCode = code;
                        finish(code);
                    }
                });

                // close 作为兜底：如果 exit 没触发（极少见），close 也能结束
                stream.on('close', () => {
                    if (!settled) {
                        finish(exitCode || 0);
                    }
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
        globalCommandLock.release();
        await sshClient.disconnect();
        throw error;
    }
}

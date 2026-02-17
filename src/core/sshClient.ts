import * as fs from 'fs';
import * as vscode from 'vscode';
import { Client, ConnectConfig } from 'ssh2';
import { getConfig } from '../config';
import { ServerConfig, CommandConfig } from '../types';
import { 
    filterCommandOutput, 
    stripAnsiEscapeCodes,
    matchPattern
} from '../utils/outputFilter';
import { WebviewOutputPanel } from '../utils/webviewOutput';

type LogOutputChannel = vscode.LogOutputChannel;

interface OutputTarget {
    channel?: LogOutputChannel;
    webview?: WebviewOutputPanel;
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

function outputLine(target: OutputTarget, text: string, level: 'info' | 'warn' | 'error' | 'trace' = 'info'): void {
    if (target.channel) {
        switch (level) {
            case 'error':
                target.channel.error(text);
                break;
            case 'warn':
                target.channel.warn(text);
                break;
            case 'trace':
                target.channel.trace(text);
                break;
            default:
                target.channel.info(text);
        }
    }
    if (target.webview) {
        switch (level) {
            case 'error':
                target.webview.appendError(text);
                break;
            case 'warn':
                target.webview.appendWarn(text);
                break;
            case 'trace':
                target.webview.appendTrace(text);
                break;
            default:
                target.webview.appendInfo(text);
        }
    }
}

export class SSHClient {
    private client: Client | null = null;
    private connected: boolean = false;
    private serverConfig: ServerConfig | null = null;

    constructor(serverConfig?: ServerConfig) {
        this.serverConfig = serverConfig || null;
    }

    private getServerConfig(): ServerConfig {
        if (this.serverConfig) {
            return this.serverConfig;
        }
        const config = getConfig();
        if (config.projects && config.projects.length > 0 && config.projects[0].enabled !== false) {
            return config.projects[0].server;
        }
        throw new Error('未配置服务器信息');
    }

    async connect(): Promise<Client> {
        if (this.client && this.connected) {
            return this.client;
        }

        const serverConfig = this.getServerConfig();
        const sshConfig: ConnectConfig = {
            host: serverConfig.host,
            port: serverConfig.port,
            username: serverConfig.username,
            readyTimeout: 30000
        };

        if (serverConfig.privateKeyPath && fs.existsSync(serverConfig.privateKeyPath)) {
            sshConfig.privateKey = fs.readFileSync(serverConfig.privateKeyPath);
        } else if (serverConfig.password) {
            sshConfig.password = serverConfig.password;
        } else {
            throw new Error('未配置 SSH 认证方式（密码或私钥）');
        }

        return new Promise((resolve, reject) => {
            this.client = new Client();
            
            this.client.on('ready', () => {
                this.connected = true;
                resolve(this.client!);
            });

            this.client.on('error', (err) => {
                this.connected = false;
                reject(new Error(`SSH 连接失败: ${err.message}`));
            });

            this.client.on('close', () => {
                this.connected = false;
            });

            this.client.connect(sshConfig);
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

export async function executeRemoteCommand(
    command: string,
    outputChannel?: LogOutputChannel,
    serverConfig?: ServerConfig,
    commandConfig?: Partial<CommandConfig>,
    outputMode: 'channel' | 'webview' = 'channel'
): Promise<ExecuteResult> {
    const sshClient = new SSHClient(serverConfig);
    
    try {
        const client = await sshClient.connect();
        const finalServerConfig = serverConfig || (() => {
            const config = getConfig();
            if (config.projects && config.projects.length > 0 && config.projects[0].enabled !== false) {
                return config.projects[0].server;
            }
            throw new Error('未配置服务器信息');
        })();

        const includePatterns = commandConfig?.includePatterns || [];
        const excludePatterns = commandConfig?.excludePatterns || [];

        const outputTarget: OutputTarget = {};
        if (outputMode === 'webview') {
            const webviewPanel = WebviewOutputPanel.getInstance();
            webviewPanel.show();
            outputTarget.webview = webviewPanel;
        } else if (outputChannel) {
            outputTarget.channel = outputChannel;
        }

        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let exitCode = 0;

            const fullCommand = finalServerConfig.remoteDirectory 
                ? `cd ${finalServerConfig.remoteDirectory} && ${command}`
                : command;
            
            outputLine(outputTarget, '');
            outputLine(outputTarget, `┌─ 执行命令 ${'─'.repeat(48)}`);
            outputLine(outputTarget, `│ ${finalServerConfig.username}@${finalServerConfig.host}:${finalServerConfig.port}`);
            outputLine(outputTarget, `│ ${fullCommand}`);
            outputLine(outputTarget, `├─ 输出 ${'─'.repeat(52)}`);
            
            if (outputTarget.channel) {
                outputTarget.channel.show();
            }

            client.exec(fullCommand, (err, stream) => {
                if (err) {
                    reject(new Error(`命令执行失败: ${err.message}`));
                    return;
                }

                stream.on('close', (code: number, signal: string) => {
                    exitCode = code;
                    
                    if (code === 0) {
                        outputLine(outputTarget, `└─ 完成 (退出码: ${code}) ${'─'.repeat(42)}`, 'info');
                    } else {
                        outputLine(outputTarget, `└─ 完成 (退出码: ${code}) ${'─'.repeat(42)}`, 'error');
                    }
                    
                    if (outputTarget.channel) {
                        outputTarget.channel.show();
                    }
                    
                    const combinedOutput = stdout + stderr;
                    const cleanOutput = stripAnsiEscapeCodes(combinedOutput);
                    const filteredOutput = filterCommandOutput(cleanOutput, includePatterns, excludePatterns);
                    
                    resolve({ stdout, stderr, code: exitCode, filteredOutput });
                    sshClient.disconnect();
                });

                stream.on('data', (data: Buffer) => {
                    const text = data.toString();
                    stdout += text;
                    
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
                            outputLine(outputTarget, prefix + line, level);
                        }
                    }
                });

                stream.stderr.on('data', (data: Buffer) => {
                    const text = data.toString();
                    stderr += text;
                    
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
                            outputLine(outputTarget, '│ ' + line, 'error');
                        }
                    }
                });
            });
        });
    } catch (error) {
        await sshClient.disconnect();
        throw error;
    }
}

export { filterCommandOutput, applyColorRules, getColorRules, stripAnsiEscapeCodes } from '../utils/outputFilter';

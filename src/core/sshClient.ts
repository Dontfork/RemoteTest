import * as fs from 'fs';
import * as vscode from 'vscode';
import { Client, ConnectConfig } from 'ssh2';
import { getConfig } from '../config';
import { ServerConfig, CommandConfig } from '../types';
import { 
    filterCommandOutput, 
    stripAnsiEscapeCodes
} from '../utils/outputFilter';
import { getOutputChannelManager } from '../utils/outputChannel';

type LogOutputChannel = vscode.LogOutputChannel;

const ANSI = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bold: '\x1b[1m'
};

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
    commandConfig?: Partial<CommandConfig>
): Promise<ExecuteResult> {
    const config = getConfig();
    const outputMode = (config.outputMode || 'channel').toLowerCase();
    
    if (outputMode === 'terminal') {
        return executeInTerminal(command, outputChannel, serverConfig, commandConfig);
    }
    
    return executeWithChannel(command, outputChannel, serverConfig, commandConfig);
}

async function executeInTerminal(
    command: string,
    outputChannel: LogOutputChannel | undefined,
    serverConfig?: ServerConfig,
    commandConfig?: Partial<CommandConfig>
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

        const channelManager = getOutputChannelManager();
        const terminal = channelManager.getTerminal();
        terminal.show();

        const includePatterns = commandConfig?.includePatterns || [];
        const excludePatterns = commandConfig?.excludePatterns || [];

        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let exitCode = 0;

            const fullCommand = finalServerConfig.remoteDirectory 
                ? `cd ${finalServerConfig.remoteDirectory} && ${command}`
                : command;
            
            terminal.sendText(`${ANSI.cyan}┌─ 执行命令 ${'─'.repeat(48)}${ANSI.reset}`);
            terminal.sendText(`${ANSI.cyan}│ ${ANSI.green}${finalServerConfig.username}@${finalServerConfig.host}:${finalServerConfig.port}${ANSI.reset}`);
            terminal.sendText(`${ANSI.cyan}│ ${ANSI.yellow}${fullCommand}${ANSI.reset}`);
            terminal.sendText(`${ANSI.cyan}├─ 输出 ${'─'.repeat(52)}${ANSI.reset}`);

            client.exec(fullCommand, (err, stream) => {
                if (err) {
                    terminal.sendText(`${ANSI.red}└─ 命令执行失败: ${err.message}${ANSI.reset}`);
                    reject(new Error(`命令执行失败: ${err.message}`));
                    return;
                }

                stream.on('close', (code: number, signal: string) => {
                    exitCode = code;
                    
                    if (code === 0) {
                        terminal.sendText(`${ANSI.green}└─ 完成 (退出码: ${code}) ${'─'.repeat(42)}${ANSI.reset}`);
                    } else {
                        terminal.sendText(`${ANSI.red}└─ 完成 (退出码: ${code}) ${'─'.repeat(42)}${ANSI.reset}`);
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
                            const level = getLogLevel(line);
                            switch (level) {
                                case 'error':
                                    terminal.sendText(`${ANSI.red}│ ${line}${ANSI.reset}`);
                                    break;
                                case 'warn':
                                    terminal.sendText(`${ANSI.yellow}│ ${line}${ANSI.reset}`);
                                    break;
                                default:
                                    terminal.sendText(`${ANSI.white}│ ${line}${ANSI.reset}`);
                            }
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
                            terminal.sendText(`${ANSI.red}│ ${line}${ANSI.reset}`);
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

async function executeWithChannel(
    command: string,
    outputChannel: LogOutputChannel | undefined,
    serverConfig?: ServerConfig,
    commandConfig?: Partial<CommandConfig>
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

        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let exitCode = 0;

            const fullCommand = finalServerConfig.remoteDirectory 
                ? `cd ${finalServerConfig.remoteDirectory} && ${command}`
                : command;
            
            if (outputChannel) {
                outputChannel.info('');
                outputChannel.info(`┌─ 执行命令 ${'─'.repeat(48)}`);
                outputChannel.info(`│ ${finalServerConfig.username}@${finalServerConfig.host}:${finalServerConfig.port}`);
                outputChannel.info(`│ ${fullCommand}`);
                outputChannel.info(`├─ 输出 ${'─'.repeat(52)}`);
                outputChannel.show();
            }

            client.exec(fullCommand, (err, stream) => {
                if (err) {
                    reject(new Error(`命令执行失败: ${err.message}`));
                    return;
                }

                stream.on('close', (code: number, signal: string) => {
                    exitCode = code;
                    
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

                stream.on('data', (data: Buffer) => {
                    const text = data.toString();
                    stdout += text;
                    
                    if (outputChannel) {
                        const cleanText = stripAnsiEscapeCodes(text);
                        const lines = cleanText.split('\n');
                        for (const line of lines) {
                            if (line.trim()) {
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
                                outputChannel.error('│ ' + line);
                            }
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

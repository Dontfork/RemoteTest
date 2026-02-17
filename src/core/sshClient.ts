import * as fs from 'fs';
import * as vscode from 'vscode';
import { Client, ConnectConfig } from 'ssh2';
import { getConfig } from '../config';
import { ServerConfig, CommandConfig } from '../types';
import { 
    filterCommandOutput, 
    applyColorRules, 
    getColorRules 
} from '../utils/outputFilter';

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

export async function executeRemoteCommand(
    command: string,
    outputChannel?: vscode.OutputChannel,
    serverConfig?: ServerConfig,
    commandConfig?: Partial<CommandConfig>
): Promise<{ stdout: string; stderr: string; code: number; filteredOutput: string }> {
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
        const colorRules = getColorRules(commandConfig?.colorRules);

        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let exitCode = 0;

            const fullCommand = finalServerConfig.remoteDirectory 
                ? `cd ${finalServerConfig.remoteDirectory} && ${command}`
                : command;
            
            if (outputChannel) {
                outputChannel.appendLine('');
                outputChannel.appendLine(`┌─ 执行命令 ${'─'.repeat(48)}`);
                outputChannel.appendLine(`│ ${finalServerConfig.username}@${finalServerConfig.host}:${finalServerConfig.port}`);
                outputChannel.appendLine(`│ ${fullCommand}`);
            }

            client.exec(fullCommand, (err, stream) => {
                if (err) {
                    reject(new Error(`命令执行失败: ${err.message}`));
                    return;
                }

                stream.on('close', (code: number, signal: string) => {
                    exitCode = code;
                    
                    const combinedOutput = stdout + stderr;
                    const filteredOutput = filterCommandOutput(combinedOutput, includePatterns, excludePatterns);
                    
                    if (outputChannel) {
                        outputChannel.appendLine(`├─ 输出 ${'─'.repeat(52)}`);
                        
                        const lines = filteredOutput.split('\n');
                        for (const line of lines) {
                            if (line.trim()) {
                                const coloredLine = applyColorRules(line, colorRules);
                                outputChannel.appendLine(`│ ${coloredLine}`);
                            }
                        }
                        
                        outputChannel.appendLine(`└─ 完成 (退出码: ${code}) ${'─'.repeat(42)}`);
                        outputChannel.show();
                    }
                    
                    resolve({ stdout, stderr, code: exitCode, filteredOutput });
                    sshClient.disconnect();
                });

                stream.on('data', (data: Buffer) => {
                    const text = data.toString();
                    stdout += text;
                });

                stream.stderr.on('data', (data: Buffer) => {
                    const text = data.toString();
                    stderr += text;
                });
            });
        });
    } catch (error) {
        await sshClient.disconnect();
        throw error;
    }
}

export { filterCommandOutput, applyColorRules, getColorRules } from '../utils/outputFilter';

import * as fs from 'fs';
import * as vscode from 'vscode';
import { Client, ConnectConfig } from 'ssh2';
import { getConfig } from '../config';

export class SSHClient {
    private client: Client | null = null;
    private connected: boolean = false;

    async connect(): Promise<Client> {
        if (this.client && this.connected) {
            return this.client;
        }

        const config = getConfig();
        const sshConfig: ConnectConfig = {
            host: config.server.host,
            port: config.server.port,
            username: config.server.username,
            readyTimeout: 30000
        };

        if (config.server.privateKeyPath && fs.existsSync(config.server.privateKeyPath)) {
            sshConfig.privateKey = fs.readFileSync(config.server.privateKeyPath);
        } else if (config.server.password) {
            sshConfig.password = config.server.password;
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

export async function executeRemoteCommand(command: string, outputChannel?: vscode.OutputChannel): Promise<{ stdout: string; stderr: string; code: number }> {
    const sshClient = new SSHClient();
    
    try {
        const client = await sshClient.connect();
        const config = getConfig();

        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            let exitCode = 0;

            const fullCommand = `cd ${config.server.remoteDirectory} && ${command}`;
            
            if (outputChannel) {
                outputChannel.appendLine(`[SSH] ${config.server.username}@${config.server.host}:${config.server.port}`);
                outputChannel.appendLine(`[执行命令] ${fullCommand}`);
                outputChannel.appendLine('─'.repeat(50));
            }

            client.exec(fullCommand, (err, stream) => {
                if (err) {
                    reject(new Error(`命令执行失败: ${err.message}`));
                    return;
                }

                stream.on('close', (code: number, signal: string) => {
                    exitCode = code;
                    if (outputChannel) {
                        outputChannel.appendLine('─'.repeat(50));
                        outputChannel.appendLine(`[执行完成] 退出码: ${code}`);
                        outputChannel.show();
                    }
                    resolve({ stdout, stderr, code: exitCode });
                    sshClient.disconnect();
                });

                stream.on('data', (data: Buffer) => {
                    const text = data.toString();
                    stdout += text;
                    if (outputChannel) {
                        outputChannel.append(text);
                    }
                });

                stream.stderr.on('data', (data: Buffer) => {
                    const text = data.toString();
                    stderr += text;
                    if (outputChannel) {
                        outputChannel.append(text);
                    }
                });
            });
        });
    } catch (error) {
        await sshClient.disconnect();
        throw error;
    }
}

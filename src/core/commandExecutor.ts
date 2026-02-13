import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { getConfig } from '../config';
import { CommandConfig } from '../types';

export class CommandExecutor {
    private terminalName = 'AutoTest';
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(this.terminalName);
    }

    private filterOutput(output: string, patterns: string[], filterMode: 'include' | 'exclude'): string {
        if (!patterns || patterns.length === 0) {
            return output;
        }

        const lines = output.split('\n');
        const filteredLines: string[] = [];

        for (const line of lines) {
            const matchesPattern = patterns.some(pattern => {
                try {
                    const regex = new RegExp(pattern, 'i');
                    return regex.test(line);
                } catch {
                    return false;
                }
            });

            if (filterMode === 'include') {
                if (matchesPattern) {
                    filteredLines.push(line);
                }
            } else {
                if (!matchesPattern) {
                    filteredLines.push(line);
                }
            }
        }

        return filteredLines.join('\n');
    }

    async execute(command: string, filterConfig?: Partial<CommandConfig>): Promise<string> {
        const config = getConfig();
        const { filterPatterns = [], filterMode = 'include' } = filterConfig || config.command;

        return new Promise((resolve, reject) => {
            const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || process.cwd();
            const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
            const shellArgs = process.platform === 'win32' 
                ? ['-Command', command] 
                : ['-c', command];

            this.outputChannel.appendLine(`\n[执行命令] ${command}`);
            this.outputChannel.appendLine(`[工作目录] ${workspacePath}`);
            this.outputChannel.appendLine('─'.repeat(50));

            const proc = child_process.spawn(shell, shellArgs, { cwd: workspacePath });

            let rawOutput = '';

            proc.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                rawOutput += text;
                this.outputChannel.append(text);
            });

            proc.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                rawOutput += text;
                this.outputChannel.append(text);
            });

            proc.on('close', (code: number | null) => {
                this.outputChannel.appendLine('\n' + '─'.repeat(50));
                this.outputChannel.appendLine(`[执行完成] 退出码: ${code}`);
                this.outputChannel.show();

                const filteredOutput = this.filterOutput(rawOutput, filterPatterns, filterMode);
                resolve(filteredOutput);
            });

            proc.on('error', (err: Error) => {
                this.outputChannel.appendLine(`[执行错误] ${err.message}`);
                reject(err);
            });
        });
    }

    async executeWithConfig(): Promise<string> {
        const config = getConfig();
        return this.execute(config.command.executeCommand);
    }

    showOutput(): void {
        this.outputChannel.show();
    }

    clearOutput(): void {
        this.outputChannel.clear();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}

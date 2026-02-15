import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | null = null;

export function initLogger(channel: vscode.OutputChannel): void {
    outputChannel = channel;
}

export function log(message: string): void {
    if (outputChannel) {
        const timestamp = new Date().toLocaleTimeString();
        outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}

export function logError(message: string, error?: any): void {
    if (outputChannel) {
        const timestamp = new Date().toLocaleTimeString();
        outputChannel.appendLine(`[${timestamp}] [ERROR] ${message}`);
        if (error) {
            outputChannel.appendLine(`  详情: ${JSON.stringify(error, null, 2)}`);
        }
    }
}

export function showOutput(): void {
    outputChannel?.show();
}

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | null = null;

export function initLogger(channel: vscode.OutputChannel): void {
    outputChannel = channel;
}

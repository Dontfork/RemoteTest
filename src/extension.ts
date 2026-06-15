/**
 * 扩展入口 —— 极简薄壳，所有初始化逻辑委托给 container。
 */
import * as vscode from 'vscode';
import * as container from './container';

export function activate(context: vscode.ExtensionContext) {
    container.init(context);
}

export async function deactivate(): Promise<void> {
    await container.dispose();
}

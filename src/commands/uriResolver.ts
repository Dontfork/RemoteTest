/**
 * URI 解析工具 —— 从 vscode.Uri 或当前活动编辑器中提取文件系统路径。
 *
 * 将 extension.ts 中大量重复的 "uri 取不到就 fallback 到 activeEditor" 模式
 * 抽为单一函数，便于测试（可 mock vscode.window.activeTextEditor）。
 */
import * as vscode from 'vscode';

/**
 * 从 Uri 或活动编辑器解析本地文件路径。
 *
 * @param uri  命令入参的 Uri（右键菜单 / explorer 操作时自动传入）
 * @returns 文件系统路径，无法解析时返回 undefined
 */
export function resolveFsPath(uri?: vscode.Uri): string | undefined {
    if (uri) {
        return uri.fsPath;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        return activeEditor.document.uri.fsPath;
    }

    return undefined;
}

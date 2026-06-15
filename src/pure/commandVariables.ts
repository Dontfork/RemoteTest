/**
 * 命令变量替换（纯逻辑，不依赖 vscode）
 *
 * 从 core/commandExecutor.ts 抽出。
 */
import * as path from 'path';
import { CommandVariables } from '../types';

/**
 * 将命令模板中的 `{filePath}` 等占位符替换为实际变量值。
 *
 * 支持的占位符：{filePath} {fileName} {fileDir}
 *               {localPath} {localDir} {localFileName} {remoteDir}
 */
export function replaceCommandVariables(command: string, variables: CommandVariables): string {
    return command
        .replace(/{filePath}/g, variables.filePath)
        .replace(/{fileName}/g, variables.fileName)
        .replace(/{fileDir}/g, variables.fileDir)
        .replace(/{localPath}/g, variables.localPath)
        .replace(/{localDir}/g, variables.localDir)
        .replace(/{localFileName}/g, variables.localFileName)
        .replace(/{remoteDir}/g, variables.remoteDir);
}

/**
 * 由本地/远程文件路径组装出命令变量集合。
 *
 * - 远程路径相关使用 posix 分隔符（SSH 侧为 Linux）；
 * - 本地路径相关使用当前平台分隔符。
 */
export function buildCommandVariables(
    localFilePath: string,
    remoteFilePath: string,
    remoteDir: string
): CommandVariables {
    return {
        filePath: remoteFilePath,
        fileName: path.posix.basename(remoteFilePath),
        fileDir: path.posix.dirname(remoteFilePath),
        localPath: localFilePath,
        localDir: path.dirname(localFilePath),
        localFileName: path.basename(localFilePath),
        remoteDir: remoteDir
    };
}

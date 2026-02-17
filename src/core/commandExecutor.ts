import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from '../config';
import { executeRemoteCommand } from './sshClient';
import { CommandConfig, CommandVariables } from '../types';
import { getOutputChannelManager } from '../utils/outputChannel';

export class CommandExecutor {
    private pluginChannel: vscode.LogOutputChannel;
    private testOutputChannel: vscode.LogOutputChannel;

    constructor() {
        const channelManager = getOutputChannelManager();
        this.pluginChannel = channelManager.getAutoTestChannel();
        this.testOutputChannel = channelManager.getTestOutputChannel();
    }

    replaceVariables(command: string, variables: CommandVariables): string {
        let result = command;
        
        result = result.replace(/{filePath}/g, variables.filePath);
        result = result.replace(/{fileName}/g, variables.fileName);
        result = result.replace(/{fileDir}/g, variables.fileDir);
        result = result.replace(/{localPath}/g, variables.localPath);
        result = result.replace(/{localDir}/g, variables.localDir);
        result = result.replace(/{localFileName}/g, variables.localFileName);
        result = result.replace(/{remoteDir}/g, variables.remoteDir);
        
        return result;
    }

    async execute(command: string, commandConfig?: Partial<CommandConfig>): Promise<string> {
        const config = getConfig();
        const clearOutput = config.clearOutputBeforeRun ?? false;
        
        try {
            const result = await executeRemoteCommand(
                command, 
                this.testOutputChannel,
                undefined,
                commandConfig,
                clearOutput
            );
            return result.filteredOutput;
        } catch (error: any) {
            this.pluginChannel.error(`[执行错误] ${error.message}`);
            this.pluginChannel.show();
            throw error;
        }
    }

    getPluginChannel(): vscode.LogOutputChannel {
        return this.pluginChannel;
    }

    getTestOutputChannel(): vscode.LogOutputChannel {
        return this.testOutputChannel;
    }

    showOutput(): void {
        this.pluginChannel.show();
    }

    clearOutput(): void {
        this.pluginChannel.clear();
        this.testOutputChannel.clear();
    }

    dispose(): void {
        const channelManager = getOutputChannelManager();
        channelManager.dispose();
    }
}

export function replaceCommandVariables(command: string, variables: CommandVariables): string {
    let result = command;
    
    result = result.replace(/{filePath}/g, variables.filePath);
    result = result.replace(/{fileName}/g, variables.fileName);
    result = result.replace(/{fileDir}/g, variables.fileDir);
    result = result.replace(/{localPath}/g, variables.localPath);
    result = result.replace(/{localDir}/g, variables.localDir);
    result = result.replace(/{localFileName}/g, variables.localFileName);
    result = result.replace(/{remoteDir}/g, variables.remoteDir);
    
    return result;
}

export function buildCommandVariables(
    localFilePath: string,
    remoteFilePath: string,
    remoteDir: string
): CommandVariables {
    const localDir = path.dirname(localFilePath);
    const localFileName = path.basename(localFilePath);
    const remoteFileDir = path.posix.dirname(remoteFilePath);
    
    return {
        filePath: remoteFilePath,
        fileName: path.posix.basename(remoteFilePath),
        fileDir: remoteFileDir,
        localPath: localFilePath,
        localDir: localDir,
        localFileName: localFileName,
        remoteDir: remoteDir
    };
}

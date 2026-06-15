import * as vscode from 'vscode';
import { getConfig } from '../config';
import { executeRemoteCommand, isExecuting } from './sshClient';
import { CommandConfig, CommandVariables, ServerConfig } from '../types';
import { getOutputChannelManager, UnifiedOutputChannel } from '../utils/outputChannel';
import {
    replaceCommandVariables,
    buildCommandVariables
} from '../pure/commandVariables';

export { replaceCommandVariables, buildCommandVariables };

export class CommandExecutor {
    private pluginChannel: UnifiedOutputChannel;
    private testOutputChannel: UnifiedOutputChannel;

    constructor() {
        const channelManager = getOutputChannelManager();
        this.pluginChannel = channelManager.getRemoteTestChannel();
        this.testOutputChannel = channelManager.getTestOutputChannel();
    }

    replaceVariables(command: string, variables: CommandVariables): string {
        return replaceCommandVariables(command, variables);
    }

    async execute(command: string, serverConfig?: ServerConfig, commandConfig?: Partial<CommandConfig>): Promise<string> {
        if (isExecuting()) {
            vscode.window.setStatusBarMessage('当前有命令正在执行中，请等待执行完成后再试', 3000);
            return '';
        }
        
        const config = getConfig();
        const clearOutput = config.clearOutputBeforeRun ?? true;
        
        try {
            const result = await executeRemoteCommand(
                command, 
                this.testOutputChannel,
                serverConfig,
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

    getPluginChannel(): UnifiedOutputChannel {
        return this.pluginChannel;
    }

    getTestOutputChannel(): UnifiedOutputChannel {
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
        getOutputChannelManager().dispose();
    }
}

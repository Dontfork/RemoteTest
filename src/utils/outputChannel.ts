import * as vscode from 'vscode';

export enum OutputChannelType {
    AUTO_TEST = 'AutoTest',
    TEST_OUTPUT = 'TestOutput'
}

export class OutputChannelManager {
    private static instance: OutputChannelManager;
    private logChannel: vscode.LogOutputChannel | null = null;
    private testOutputChannel: vscode.LogOutputChannel | null = null;

    private constructor() {}

    static getInstance(): OutputChannelManager {
        if (!OutputChannelManager.instance) {
            OutputChannelManager.instance = new OutputChannelManager();
        }
        return OutputChannelManager.instance;
    }

    getAutoTestChannel(): vscode.LogOutputChannel {
        if (!this.logChannel) {
            this.logChannel = vscode.window.createOutputChannel('AutoTest', { log: true });
        }
        return this.logChannel;
    }

    getTestOutputChannel(): vscode.LogOutputChannel {
        if (!this.testOutputChannel) {
            this.testOutputChannel = vscode.window.createOutputChannel('TestOutput', { log: true });
        }
        return this.testOutputChannel;
    }

    dispose(): void {
        if (this.logChannel) {
            this.logChannel.dispose();
            this.logChannel = null;
        }
        if (this.testOutputChannel) {
            this.testOutputChannel.dispose();
            this.testOutputChannel = null;
        }
    }
}

export function getOutputChannelManager(): OutputChannelManager {
    return OutputChannelManager.getInstance();
}

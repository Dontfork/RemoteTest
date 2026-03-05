import * as vscode from 'vscode';
import { getUseLogOutputChannel, onConfigChanged } from '../config';

export interface UnifiedOutputChannel {
    append(value: string): void;
    appendLine(value: string): void;
    clear(): void;
    show(preserveFocus?: boolean): void;
    hide(): void;
    dispose(): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    trace(message: string): void;
}

export class OutputChannelManager {
    private static instance: OutputChannelManager;
    private remoteTestChannel: vscode.LogOutputChannel | null = null;
    private testOutputChannel: vscode.OutputChannel | null = null;
    private currentIsLogChannel: boolean | null = null;

    private constructor() {
        onConfigChanged(() => {
            this.recreateChannelIfNeeded();
        });
    }

    static getInstance(): OutputChannelManager {
        if (!OutputChannelManager.instance) {
            OutputChannelManager.instance = new OutputChannelManager();
        }
        return OutputChannelManager.instance;
    }

    getRemoteTestChannel(): UnifiedOutputChannel {
        if (!this.remoteTestChannel) {
            this.remoteTestChannel = vscode.window.createOutputChannel('RemoteTest', { log: true });
        }
        const channel = this.remoteTestChannel;
        return {
            append: (v) => channel.append(v),
            appendLine: (v) => channel.appendLine(v),
            clear: () => channel.clear(),
            show: (p) => channel.show(p),
            hide: () => channel.hide(),
            dispose: () => {},
            info: (m) => channel.info(m),
            warn: (m) => channel.warn(m),
            error: (m) => channel.error(m),
            trace: (m) => channel.trace(m)
        };
    }

    getTestOutputChannel(): UnifiedOutputChannel {
        return {
            append: (v) => this.getChannel().append(v),
            appendLine: (v) => this.getChannel().appendLine(v),
            clear: () => this.getChannel().clear(),
            show: (p) => this.getChannel().show(p),
            hide: () => this.getChannel().hide(),
            dispose: () => {},
            info: (m) => this.logInfo(m),
            warn: (m) => this.logWarn(m),
            error: (m) => this.logError(m),
            trace: (m) => this.logTrace(m)
        };
    }

    private getChannel(): vscode.OutputChannel {
        const useLog = getUseLogOutputChannel();
        
        if (this.currentIsLogChannel !== null && this.currentIsLogChannel !== useLog) {
            this.testOutputChannel?.clear();
            this.testOutputChannel?.dispose();
            this.testOutputChannel = null;
        }
        
        if (!this.testOutputChannel) {
            if (useLog) {
                this.testOutputChannel = vscode.window.createOutputChannel('TestOutput', { log: true });
            } else {
                this.testOutputChannel = vscode.window.createOutputChannel('TestOutput');
            }
            this.currentIsLogChannel = useLog;
        }
        
        return this.testOutputChannel;
    }

    private recreateChannelIfNeeded(): void {
        const useLog = getUseLogOutputChannel();
        
        if (this.currentIsLogChannel !== null && this.currentIsLogChannel !== useLog) {
            this.testOutputChannel?.clear();
            this.testOutputChannel?.dispose();
            this.testOutputChannel = null;
            this.currentIsLogChannel = useLog;
        }
        
        if (this.testOutputChannel) {
            this.testOutputChannel.clear();
        }
    }

    private logInfo(m: string): void {
        const channel = this.getChannel();
        if (this.currentIsLogChannel && 'info' in channel) {
            (channel as vscode.LogOutputChannel).info(m);
        } else {
            channel.appendLine(m);
        }
    }

    private logWarn(m: string): void {
        const channel = this.getChannel();
        if (this.currentIsLogChannel && 'warn' in channel) {
            (channel as vscode.LogOutputChannel).warn(m);
        } else {
            channel.appendLine(m);
        }
    }

    private logError(m: string): void {
        const channel = this.getChannel();
        if (this.currentIsLogChannel && 'error' in channel) {
            (channel as vscode.LogOutputChannel).error(m);
        } else {
            channel.appendLine(m);
        }
    }

    private logTrace(m: string): void {
        const channel = this.getChannel();
        if (this.currentIsLogChannel && 'trace' in channel) {
            (channel as vscode.LogOutputChannel).trace(m);
        } else {
            channel.appendLine(m);
        }
    }

    dispose(): void {
        this.remoteTestChannel?.dispose();
        this.remoteTestChannel = null;
        this.testOutputChannel?.dispose();
        this.testOutputChannel = null;
        this.currentIsLogChannel = null;
    }
}

export function getOutputChannelManager(): OutputChannelManager {
    return OutputChannelManager.getInstance();
}

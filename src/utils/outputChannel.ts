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
    private testOutputChannel: vscode.LogOutputChannel | null = null;
    private testOutputProxy: UnifiedOutputChannel | null = null;

    private constructor() {
        onConfigChanged(() => {
            this.testOutputChannel?.clear();
            this.testOutputProxy = null;
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
        return this.createProxy(this.remoteTestChannel, true);
    }

    getTestOutputChannel(): UnifiedOutputChannel {
        if (!this.testOutputChannel) {
            this.testOutputChannel = vscode.window.createOutputChannel('TestOutput', { log: true });
        }
        if (!this.testOutputProxy) {
            this.testOutputProxy = this.createProxy(this.testOutputChannel, getUseLogOutputChannel());
        }
        return this.testOutputProxy;
    }

    private createProxy(channel: vscode.LogOutputChannel, useLogLevel: boolean): UnifiedOutputChannel {
        if (useLogLevel) {
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
        return {
            append: (v) => channel.append(v),
            appendLine: (v) => channel.appendLine(v),
            clear: () => channel.clear(),
            show: (p) => channel.show(p),
            hide: () => channel.hide(),
            dispose: () => {},
            info: (m) => channel.appendLine(m),
            warn: (m) => channel.appendLine(m),
            error: (m) => channel.appendLine(m),
            trace: (m) => channel.appendLine(m)
        };
    }

    dispose(): void {
        this.remoteTestChannel?.dispose();
        this.remoteTestChannel = null;
        this.testOutputChannel?.dispose();
        this.testOutputChannel = null;
        this.testOutputProxy = null;
    }
}

export function getOutputChannelManager(): OutputChannelManager {
    return OutputChannelManager.getInstance();
}

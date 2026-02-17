import * as vscode from 'vscode';

interface OutputLine {
    text: string;
    level: 'info' | 'warn' | 'error' | 'trace';
    timestamp: number;
}

export class WebviewOutputPanel {
    private static instance: WebviewOutputPanel | null = null;
    private panel: vscode.WebviewPanel | null = null;
    private outputLines: OutputLine[] = [];

    private constructor() {}

    static getInstance(): WebviewOutputPanel {
        if (!WebviewOutputPanel.instance) {
            WebviewOutputPanel.instance = new WebviewOutputPanel();
        }
        return WebviewOutputPanel.instance;
    }

    show(): void {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'autoTestOutput',
            'TestOutput',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getHtml();

        this.panel.onDidDispose(() => {
            this.panel = null;
        });

        this.updateContent();
    }

    clear(): void {
        this.outputLines = [];
        this.updateContent();
    }

    appendLine(text: string, level: 'info' | 'warn' | 'error' | 'trace' = 'info'): void {
        this.outputLines.push({
            text,
            level,
            timestamp: Date.now()
        });

        if (this.outputLines.length > 5000) {
            this.outputLines = this.outputLines.slice(-4000);
        }

        this.updateContent();
    }

    appendInfo(text: string): void {
        this.appendLine(text, 'info');
    }

    appendWarn(text: string): void {
        this.appendLine(text, 'warn');
    }

    appendError(text: string): void {
        this.appendLine(text, 'error');
    }

    appendTrace(text: string): void {
        this.appendLine(text, 'trace');
    }

    private updateContent(): void {
        if (!this.panel) {
            return;
        }

        const linesHtml = this.outputLines.map(line => {
            const levelClass = `line-${line.level}`;
            const escapedText = this.escapeHtml(line.text);
            return `<div class="line ${levelClass}">${escapedText}</div>`;
        }).join('');

        this.panel.webview.postMessage({ type: 'update', content: linesHtml });
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TestOutput</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.5;
            background-color: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-editor-foreground, #d4d4d4);
            padding: 8px;
        }
        
        #output {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .line {
            padding: 1px 0;
        }
        
        .line-info {
            color: var(--vscode-terminal-foreground, #d4d4d4);
        }
        
        .line-warn {
            color: #dcdcaa;
            background-color: rgba(220, 220, 170, 0.1);
        }
        
        .line-error {
            color: #f14c4c;
            background-color: rgba(241, 76, 76, 0.1);
        }
        
        .line-trace {
            color: #808080;
        }
        
        .header {
            color: #569cd6;
        }
        
        .success {
            color: #4ec9b0;
        }
        
        .failed {
            color: #f14c4c;
        }
    </style>
</head>
<body>
    <div id="output"></div>
    <script>
        const output = document.getElementById('output');
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'update') {
                output.innerHTML = message.content;
                window.scrollTo(0, document.body.scrollHeight);
            } else if (message.type === 'clear') {
                output.innerHTML = '';
            }
        });
    </script>
</body>
</html>`;
    }

    dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
        WebviewOutputPanel.instance = null;
    }
}

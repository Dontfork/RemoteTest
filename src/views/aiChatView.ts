import * as vscode from 'vscode';
import { marked } from 'marked';
import { AIChat } from '../ai';
import { SessionManager } from '../ai/sessionManager';
import { ChatSession, AIModelConfig } from '../types';
import { onConfigChanged } from '../config';

marked.setOptions({
    gfm: true,
    breaks: true
});

function highlightCode(code: string, lang: string): string {
    const decodeHtml = (text: string) => text.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
    const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const decoded = decodeHtml(code);
    const escaped = escapeHtml(decoded);
    
    if (!lang || lang === 'plaintext') {
        return escaped;
    }
    
    const patterns: { [key: string]: [RegExp, string][] } = {
        javascript: [
            [/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof)\b/g, 'keyword'],
            [/\b(true|false|null|undefined|NaN|Infinity)\b/g, 'literal'],
            [/(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/\/\/.*$/gm, 'comment'],
            [/(\/\*[\s\S]*?\*\/)/g, 'comment'],
            [/\b(\d+\.?\d*)\b/g, 'number'],
            [/\b([A-Z][a-zA-Z0-9]*)\b/g, 'class'],
            [/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, 'function'],
        ],
        typescript: [
            [/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|interface|type|enum|implements|extends|public|private|protected|readonly|abstract|static)\b/g, 'keyword'],
            [/\b(true|false|null|undefined|NaN|Infinity)\b/g, 'literal'],
            [/(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/\/\/.*$/gm, 'comment'],
            [/(\/\*[\s\S]*?\*\/)/g, 'comment'],
            [/\b(\d+\.?\d*)\b/g, 'number'],
            [/\b([A-Z][a-zA-Z0-9]*)\b/g, 'class'],
            [/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, 'function'],
        ],
        python: [
            [/\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|with|lambda|yield|raise|pass|break|continue|and|or|not|in|is|None|True|False)\b/g, 'keyword'],
            [/(['"]{3}[\s\S]*?['"]{3}|['"][^'"]*['"])/g, 'string'],
            [/#.*$/gm, 'comment'],
            [/\b(\d+\.?\d*)\b/g, 'number'],
            [/\b([A-Z][a-zA-Z0-9]*)\b/g, 'class'],
            [/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, 'function'],
        ],
        java: [
            [/\b(public|private|protected|class|interface|extends|implements|return|if|else|for|while|try|catch|finally|throw|throws|new|this|super|static|final|abstract|void|int|long|short|byte|float|double|boolean|char|null|true|false|import|package)\b/g, 'keyword'],
            [/(['"])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/\/\/.*$/gm, 'comment'],
            [/(\/\*[\s\S]*?\*\/)/g, 'comment'],
            [/\b(\d+\.?\d*[fFdDlL]?)\b/g, 'number'],
            [/\b([A-Z][a-zA-Z0-9]*)\b/g, 'class'],
            [/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, 'function'],
        ],
        go: [
            [/\b(package|import|func|return|if|else|for|range|switch|case|default|break|continue|go|defer|chan|select|struct|interface|map|type|var|const)\b/g, 'keyword'],
            [/\b(true|false|nil)\b/g, 'literal'],
            [/(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/\/\/.*$/gm, 'comment'],
            [/(\/\*[\s\S]*?\*\/)/g, 'comment'],
            [/\b(\d+\.?\d*)\b/g, 'number'],
            [/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, 'function'],
        ],
        rust: [
            [/\b(fn|let|mut|const|pub|mod|use|struct|enum|impl|trait|where|type|self|Self|if|else|match|for|while|loop|break|continue|return|move|ref|as|in|unsafe|extern|crate|static|dyn)\b/g, 'keyword'],
            [/\b(true|false|None|Some|Ok|Err)\b/g, 'literal'],
            [/(['"`])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/\/\/.*$/gm, 'comment'],
            [/(\/\*[\s\S]*?\*\/)/g, 'comment'],
            [/\b(\d+\.?\d*)\b/g, 'number'],
            [/\b([A-Z][a-zA-Z0-9]*)\b/g, 'class'],
            [/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, 'function'],
        ],
        sql: [
            [/\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|NULL|DEFAULT|UNIQUE|CHECK|CONSTRAINT)\b/gi, 'keyword'],
            [/(['"])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/--.*$/gm, 'comment'],
            [/\b(\d+\.?\d*)\b/g, 'number'],
        ],
        json: [
            [/(['"])(?:(?!\1)[^\\]|\\.)*?\1(?=\s*:)/g, 'attribute'],
            [/(['"])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/\b(true|false|null)\b/g, 'literal'],
            [/\b(-?\d+\.?\d*)\b/g, 'number'],
        ],
        yaml: [
            [/(['"])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/#.*$/gm, 'comment'],
            [/\b(true|false|null|yes|no|on|off)\b/gi, 'literal'],
            [/\b(-?\d+\.?\d*)\b/g, 'number'],
            [/^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*:)/gm, 'attribute'],
        ],
        bash: [
            [/\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|break|continue|local|export|source|alias|unset|readonly|declare|typeset)\b/g, 'keyword'],
            [/(['"])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/#.*$/gm, 'comment'],
            [/\b(\d+)\b/g, 'number'],
            [/\$([a-zA-Z_][a-zA-Z0-9_]*|\{[^}]+\}|\([^)]+\))/g, 'variable'],
        ],
        shell: [
            [/\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|break|continue|local|export|source|alias|unset|readonly|declare|typeset)\b/g, 'keyword'],
            [/(['"])(?:(?!\1)[^\\]|\\.)*?\1/g, 'string'],
            [/#.*$/gm, 'comment'],
            [/\b(\d+)\b/g, 'number'],
            [/\$([a-zA-Z_][a-zA-Z0-9_]*|\{[^}]+\}|\([^)]+\))/g, 'variable'],
        ],
    };
    
    const langPatterns = patterns[lang.toLowerCase()] || patterns.javascript;
    
    let result = escaped;
    const placeholders: { placeholder: string; html: string }[] = [];
    
    for (const [pattern, className] of langPatterns) {
        result = result.replace(pattern, (match) => {
            const placeholder = `__PLACEHOLDER_${placeholders.length}__`;
            placeholders.push({ placeholder, html: `<span class="hljs-${className}">${match}</span>` });
            return placeholder;
        });
    }
    
    for (const { placeholder, html } of placeholders) {
        result = result.replace(placeholder, html);
    }
    
    return result;
}

function enhanceMarkdown(html: string): string {
    html = html.replace(/<pre><code(?: class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
        const langDisplay = lang ? `<span class="code-lang">${lang}</span>` : '';
        const highlightedCode = highlightCode(code, lang);
        return `<pre><div class="code-header">${langDisplay}<button class="copy-btn" title="复制代码"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></div><code>${highlightedCode}</code></pre>`;
    });
    
    html = html.replace(/<h([1-6])>/g, '<h$1>');
    html = html.replace(/<ul>/g, '<ul>');
    html = html.replace(/<ol>/g, '<ol>');
    html = html.replace(/<li>/g, '<li>');
    html = html.replace(/<blockquote>/g, '<blockquote>');
    html = html.replace(/<table>/g, '<table>');
    html = html.replace(/<tr>/g, '<tr>');
    html = html.replace(/<th>/g, '<th>');
    html = html.replace(/<td>/g, '<td>');
    html = html.replace(/<p>/g, '<p>');
    html = html.replace(/<code>(?![^<]*<\/code><\/pre>)/g, '<code>');
    html = html.replace(/<a /g, '<a target="_blank" ');
    
    return html;
}

export class AIChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'RemoteTest-ai-view';
    private aiChat: AIChat;
    private sessionManager: SessionManager;
    private view: vscode.WebviewView | undefined;
    private extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri, aiChat: AIChat, sessionManager: SessionManager) {
        this.extensionUri = extensionUri;
        this.aiChat = aiChat;
        this.sessionManager = sessionManager;
        
        onConfigChanged(() => {
            if (this.view) {
                this.sendAvailableModels();
            }
        });
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void {
        this.view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };
        
        webviewView.webview.html = this.getHtmlContent();

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this.handleSendMessage(message.data);
                    break;
                case 'clearChat':
                    this.aiChat.clearCurrentSession();
                    this.sendCurrentSession();
                    break;
                case 'newSession':
                    const allSessions = this.aiChat.getAllSessions();
                    const emptySession = allSessions.find(s => s.messages.length === 0);
                    if (emptySession) {
                        this.aiChat.setCurrentSession(emptySession.id);
                    } else {
                        this.aiChat.createNewSession();
                    }
                    this.sendSessions();
                    this.sendCurrentSession();
                    break;
                case 'switchSession':
                    this.aiChat.setCurrentSession(message.sessionId);
                    this.sendCurrentSession();
                    break;
                case 'deleteSession':
                    this.aiChat.deleteSession(message.sessionId);
                    this.sendSessions();
                    this.sendCurrentSession();
                    break;
                case 'getSessions':
                    this.sendSessions();
                    this.sendCurrentSession();
                    break;
                case 'switchModel':
                    this.aiChat.setModel(message.modelName);
                    this.sendCurrentModel();
                    break;
                case 'getModels':
                    this.sendAvailableModels();
                    break;
                case 'importPrompt':
                    this.handleImportPrompt();
                    break;
                case 'saveSystemPrompt':
                    this.sessionManager.saveSystemPrompt(message.prompt);
                    break;
                case 'getSystemPrompt':
                    this.sendSystemPrompt();
                    break;
            }
        });

        this.sessionManager.onSessionsChange(() => {
            this.sendSessions();
        });
        
        // 初始化时发送数据
        this.sendAvailableModels();
        this.sendSessions();
        this.sendCurrentSession();
        this.sendSystemPrompt();
    }

    private sendSystemPrompt(): void {
        const prompt = this.sessionManager.getSystemPrompt();
        this.view?.webview.postMessage({
            command: 'systemPrompt',
            data: prompt
        });
    }

    private sendSessions(): void {
        const sessions = this.aiChat.getAllSessions();
        this.view?.webview.postMessage({
            command: 'sessions',
            data: sessions.map(s => ({
                id: s.id,
                title: s.title,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                messageCount: s.messages.length
            }))
        });
    }

    private async sendCurrentSession(): Promise<void> {
        const session = this.aiChat.getCurrentSession();
        if (!session) {
            this.view?.webview.postMessage({
                command: 'currentSession',
                data: null
            });
            return;
        }

        const renderedMessages = await Promise.all(
            session.messages.map(async (m) => {
                if (m.role === 'assistant') {
                    const html = await marked(m.content);
                    return { ...m, renderedContent: enhanceMarkdown(html) };
                }
                return m;
            })
        );

        this.view?.webview.postMessage({
            command: 'currentSession',
            data: {
                id: session.id,
                title: session.title,
                messages: renderedMessages
            }
        });
    }

    private sendAvailableModels(): void {
        const models = this.aiChat.getAvailableModels();
        const currentModel = this.aiChat.getCurrentModel();
        this.view?.webview.postMessage({
            command: 'models',
            data: {
                models: models.map(m => ({ name: m.name })),
                currentModel: currentModel
            }
        });
    }

    private sendCurrentModel(): void {
        const currentModel = this.aiChat.getCurrentModel();
        this.view?.webview.postMessage({
            command: 'currentModel',
            data: currentModel
        });
    }

    private async handleImportPrompt(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Prompt Files': ['txt', 'md']
            },
            title: '选择 Prompt 文件'
        });

        if (uris && uris.length > 0) {
            try {
                const content = await vscode.workspace.fs.readFile(uris[0]);
                const text = Buffer.from(content).toString('utf-8');
                this.view?.webview.postMessage({
                    command: 'promptContent',
                    data: text
                });
            } catch (error: any) {
                vscode.window.showErrorMessage('读取文件失败: ' + error.message);
            }
        }
    }

    private async handleSendMessage(data: { message: string; systemPrompt?: string }): Promise<void> {
        try {
            let fullContent = '';
            
            const response = await this.aiChat.sendMessageStream(data.message, data.systemPrompt, async (chunk) => {
                fullContent += chunk;
                const htmlContent = enhanceMarkdown(await marked(fullContent));
                this.view?.webview.postMessage({
                    command: 'streamChunk',
                    data: htmlContent
                });
            });

            if (response.error) {
                this.view?.webview.postMessage({
                    command: 'streamError',
                    error: response.error
                });
            } else {
                const markdownContent = response.content || fullContent;
                const htmlContent = enhanceMarkdown(await marked(markdownContent));
                this.view?.webview.postMessage({
                    command: 'streamComplete',
                    data: htmlContent
                });
                this.sendSessions();
            }
        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            this.view?.webview.postMessage({
                command: 'streamError',
                error: '处理消息时出错: ' + errorMsg
            });
        }
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <style>
        :root {
            --vscode-bg: var(--vscode-editor-background);
            --vscode-fg: var(--vscode-editor-foreground);
            --vscode-button-bg: var(--vscode-button-background);
            --vscode-button-fg: var(--vscode-button-foreground);
            --vscode-button-hover: var(--vscode-button-hoverBackground);
            --vscode-input-bg: var(--vscode-input-background);
            --vscode-input-fg: var(--vscode-input-foreground);
            --vscode-input-border: var(--vscode-input-border);
            --vscode-dropdown-bg: var(--vscode-dropdown-background);
            --vscode-dropdown-fg: var(--vscode-dropdown-foreground);
            --vscode-dropdown-border: var(--vscode-dropdown-border);
            --vscode-list-hover: var(--vscode-list-hoverBackground);
            --vscode-list-active: var(--vscode-list-activeSelectionBackground);
            --vscode-focus-border: var(--vscode-focusBorder);
            --vscode-border: var(--vscode-panel-border);
            --vscode-sidebar-bg: var(--vscode-sideBar-background);
            --vscode-sidebar-fg: var(--vscode-sideBar-foreground);
            --vscode-widget-bg: var(--vscode-editorWidget-background);
            --vscode-widget-border: var(--vscode-editorWidget-border);
            --vscode-scrollbar-bg: var(--vscode-scrollbarSlider-background);
            --vscode-scrollbar-hover: var(--vscode-scrollbarSlider-hoverBackground);
            --vscode-link: var(--vscode-textLink-foreground);
            --vscode-error: var(--vscode-errorForeground);
            --vscode-success: var(--vscode-terminal-ansiGreen);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif); 
            background: var(--vscode-bg); 
            color: var(--vscode-fg); 
            height: 100vh; 
            display: flex; 
            flex-direction: column;
            font-size: 12px;
        }
        
        .toolbar { 
            padding: 4px 8px; 
            background: var(--vscode-bg);
            border-bottom: 1px solid var(--vscode-border); 
            display: flex; 
            gap: 4px; 
            align-items: center; 
            position: relative; 
            justify-content: space-between;
        }
        
        .toolbar-left { display: flex; align-items: center; gap: 4px; }
        .toolbar-right { display: flex; align-items: center; gap: 4px; }
        
        .toolbar button { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            width: 28px; 
            height: 28px; 
            background: transparent; 
            color: var(--vscode-sidebar-fg); 
            border: 1px solid transparent;
            cursor: pointer; 
            transition: all 0.15s ease; 
            border-radius: 4px;
        }
        
        .toolbar button:hover { 
            color: var(--vscode-fg); 
            background: var(--vscode-list-hover);
            border-color: var(--vscode-widget-border);
        }
        
        .toolbar button svg { 
            width: 16px; 
            height: 16px; 
            stroke: currentColor; 
            stroke-width: 2; 
            fill: none;
        }
        
        .model-select-btn { 
            background: var(--vscode-input-bg); 
            color: var(--vscode-input-fg); 
            border: 1px solid var(--vscode-input-border); 
            border-radius: 4px;
            padding: 4px 8px; 
            font-size: 12px; 
            cursor: pointer; 
            min-width: 120px; 
            width: auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            transition: all 0.15s ease;
        }
        
        .model-select-btn span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 180px;
        }
        
        .model-select-btn:hover { 
            border-color: var(--vscode-focus-border);
            background: var(--vscode-input-bg);
        }
        
        .model-select-btn svg {
            width: 12px;
            height: 12px;
            stroke: currentColor;
            stroke-width: 2;
            fill: none;
            transition: transform 0.15s ease;
        }
        
        .model-select-btn.open svg {
            transform: rotate(180deg);
        }
        
        .model-panel { 
            display: none; 
            position: absolute; 
            top: 100%; 
            left: 8px; 
            right: auto;
            min-width: 160px;
            background: var(--vscode-widget-bg); 
            border: 1px solid var(--vscode-widget-border); 
            border-radius: 4px; 
            max-height: 200px; 
            overflow-y: auto; 
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            margin-top: 4px;
        }
        
        .model-panel::-webkit-scrollbar {
            width: 10px;
        }
        
        .model-panel::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .model-panel::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbar-bg);
            border-radius: 0;
        }
        
        .model-panel::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbar-hover);
        }
        
        .model-panel.show { display: block; }
        
        .model-item { 
            padding: 6px 8px; 
            cursor: pointer; 
            border-bottom: 1px solid var(--vscode-border); 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            transition: all 0.15s ease;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .model-item:last-child { border-bottom: none; }
        
        .model-item:hover { 
            background: var(--vscode-list-hover);
        }
        
        .model-item.active { 
            background: var(--vscode-list-active);
        }
        
        .model-item .name { 
            flex: 1;
            color: var(--vscode-fg);
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .model-item.active .name {
            color: var(--vscode-button-fg);
        }
        
        .model-item .check {
            color: var(--vscode-button-fg);
            opacity: 0;
            flex-shrink: 0;
        }
        
        .model-item.active .check {
            opacity: 1;
        }
        
        .model-item .check svg {
            width: 14px;
            height: 14px;
            stroke: currentColor;
            stroke-width: 2;
            fill: none;
        }
        
        .no-models { 
            padding: 20px; 
            text-align: center; 
            color: var(--vscode-sidebar-fg);
            font-size: 12px;
        }
        
        .messages { 
            flex: 1; 
            overflow-y: auto; 
            padding: 12px;
        }
        
        .messages::-webkit-scrollbar {
            width: 10px;
        }
        
        .messages::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .messages::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbar-bg);
            border-radius: 0;
        }
        
        .messages::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbar-hover);
        }
        
        .msg { 
            margin-bottom: 12px; 
            display: flex;
            gap: 8px;
            align-items: flex-start;
        }
        
        .msg.user { 
            flex-direction: row-reverse;
        }
        
        .avatar {
            width: 28px;
            height: 28px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        
        .user .avatar {
            background: var(--vscode-button-bg);
        }
        
        .assistant .avatar {
            background: var(--vscode-button-bg);
        }
        
        .error .avatar {
            background: var(--vscode-error);
        }
        
        .avatar svg {
            width: 26px;
            height: 26px;
            stroke: var(--vscode-button-fg);
            stroke-width: 1.5;
            fill: none;
        }
        
        .assistant .avatar svg {
            stroke: #ffffff;
        }
        
        .assistant .avatar svg circle {
            fill: #ffffff;
        }
        
        .bubble { 
            padding: 8px 12px; 
            border-radius: 4px; 
            max-width: 85%; 
            line-height: 1.5;
            word-wrap: break-word;
            position: relative;
            font-size: 12px;
        }
        
        .user .bubble { 
            background: var(--vscode-button-bg);
            border: none;
            color: var(--vscode-button-fg);
        }
        
        .assistant .bubble { 
            background: var(--vscode-widget-bg); 
            border: 1px solid var(--vscode-widget-border);
            color: var(--vscode-editor-foreground);
        }
        
        .error .bubble { 
            background: var(--vscode-widget-bg);
            border: 1px solid var(--vscode-error);
            color: var(--vscode-error);
        }
        
        .bubble pre { 
            background: var(--vscode-widget-bg); 
            border-radius: 4px; 
            overflow: hidden; 
            margin: 8px 0; 
            border: 1px solid var(--vscode-widget-border);
        }
        
        .bubble pre code { 
            display: block; 
            padding: 8px; 
            overflow-x: auto; 
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', 'Courier New', monospace); 
            font-size: 11px; 
            line-height: 1.5; 
            background: none;
        }
        
        .code-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 4px 8px; 
            background: var(--vscode-widget-bg); 
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        
        .code-lang { 
            font-size: 11px; 
            color: var(--vscode-sidebar-fg); 
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace); 
            text-transform: uppercase;
        }
        
        .copy-btn { 
            background: transparent; 
            color: var(--vscode-sidebar-fg); 
            border: 1px solid transparent; 
            border-radius: 4px; 
            padding: 4px 8px; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            gap: 4px; 
            font-size: 11px; 
            transition: all 0.15s ease;
        }
        
        .copy-btn:hover { 
            color: var(--vscode-fg); 
            background: var(--vscode-list-hover);
            border-color: var(--vscode-widget-border);
        }
        
        .copy-btn svg { 
            width: 12px; 
            height: 12px; 
            stroke: currentColor; 
            stroke-width: 2; 
            fill: none;
        }
        
        .copy-btn.copied { 
            color: var(--vscode-success);
            border-color: var(--vscode-success);
        }
        
        .bubble code { 
            background: var(--vscode-widget-bg); 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace); 
            font-size: 11px;
            color: var(--vscode-success);
            border: 1px solid var(--vscode-widget-border);
        }
        
        .user .bubble code {
            background: rgba(255, 255, 255, 0.2);
            color: var(--vscode-button-fg);
            border-color: rgba(255, 255, 255, 0.3);
        }
        
        .bubble a { 
            color: var(--vscode-link); 
            text-decoration: none;
            transition: all 0.15s ease;
        }
        
        .bubble a:hover {
            text-decoration: underline;
        }
        
        .bubble strong { 
            color: var(--vscode-fg); 
            font-weight: 600;
        }
        
        .bubble em { 
            color: var(--vscode-fg);
            font-style: italic;
        }
        
        .bubble hr { 
            border: none; 
            border-top: 1px solid var(--vscode-border); 
            margin: 12px 0;
        }
        
        .bubble img { 
            max-width: 100%; 
            border-radius: 4px;
        }
        
        .assistant .bubble h1, .assistant .bubble h2, .assistant .bubble h3, .assistant .bubble h4, .assistant .bubble h5, .assistant .bubble h6,
        .user .bubble h1, .user .bubble h2, .user .bubble h3, .user .bubble h4, .user .bubble h5, .user .bubble h6 {
            color: var(--vscode-editor-foreground) !important;
            margin: 12px 0 8px 0;
            font-weight: 600;
            line-height: 1.4;
        }
        
        .bubble h1 { font-size: 1.6em; }
        .bubble h2 { font-size: 1.4em; }
        .bubble h3 { font-size: 1.2em; }
        .bubble h4 { font-size: 1.1em; }
        .bubble h5, .bubble h6 { font-size: 1em; }
        
        .bubble p {
            margin: 8px 0;
            line-height: 1.6;
        }
        
        .bubble ul, .bubble ol {
            margin: 8px 0 8px 20px;
            padding: 0;
        }
        
        .bubble li {
            margin: 4px 0;
            line-height: 1.6;
        }
        
        .bubble blockquote {
            border-left: 3px solid var(--vscode-border);
            padding-left: 12px;
            margin: 8px 0;
            color: var(--vscode-editor-foreground);
            opacity: 0.9;
        }
        
        .bubble table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
        }
        
        .bubble tr {
            border-bottom: 1px solid var(--vscode-border);
        }
        
        .bubble th, .bubble td {
            padding: 8px 12px;
            text-align: left;
            color: var(--vscode-editor-foreground);
        }
        
        .bubble code:not(pre code) {
            background: var(--vscode-widget-bg);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: Consolas, Monaco, monospace;
            font-size: 0.9em;
            color: var(--vscode-editor-foreground);
            border: 1px solid var(--vscode-widget-border);
        }
        
        .bubble a {
            color: var(--vscode-link);
            text-decoration: none;
        }
        
        .bubble a:hover {
            text-decoration: underline;
        }
        
        .hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-name, .hljs-tag { color: var(--vscode-textLink-foreground); }
        .hljs-string, .hljs-title, .hljs-section, .hljs-attribute, .hljs-literal, .hljs-template-tag, .hljs-template-variable, .hljs-type { color: var(--vscode-editor-foreground); }
        .hljs-comment, .hljs-deletion { color: var(--vscode-editor-foreground); opacity: 0.6; }
        .hljs-number, .hljs-regexp, .hljs-addition { color: var(--vscode-textLink-foreground); }
        .hljs-function { color: var(--vscode-textLink-foreground); }
        .hljs-variable, .hljs-params { color: var(--vscode-editor-foreground); }
        .hljs-class .hljs-title { color: var(--vscode-textLink-foreground); }
        .hljs-symbol, .hljs-bullet { color: var(--vscode-editor-foreground); }
        .hljs-meta { color: var(--vscode-editor-foreground); opacity: 0.7; }
        .hljs-link { color: var(--vscode-link); text-decoration: underline; }
        
        .input-area { 
            padding: 8px; 
            border-top: 1px solid var(--vscode-border); 
            background: var(--vscode-bg);
        }
        
        .input-wrap { 
            display: flex; 
            gap: 8px; 
            align-items: flex-end;
        }
        
        textarea { 
            flex: 1; 
            padding: 6px 8px; 
            background: var(--vscode-input-bg); 
            color: var(--vscode-input-fg); 
            border: 1px solid var(--vscode-input-border); 
            border-radius: 4px;
            resize: none; 
            font-family: inherit; 
            font-size: 12px; 
            line-height: 1.5; 
            min-height: 32px; 
            max-height: 120px;
            overflow-y: auto;
            transition: all 0.15s ease;
        }
        
        textarea::-webkit-scrollbar {
            width: 10px;
        }
        
        textarea::-webkit-scrollbar-track {
            background: transparent;
        }
        
        textarea::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbar-bg);
            border-radius: 0;
        }
        
        textarea:focus { 
            outline: none; 
            border-color: var(--vscode-focus-border);
            background: var(--vscode-input-bg);
        }
        
        textarea::placeholder {
            color: var(--vscode-sidebar-fg);
        }
        
        button#sendBtn { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            width: 32px; 
            height: 32px; 
            background: var(--vscode-button-bg);
            color: var(--vscode-button-fg); 
            border: none; 
            border-radius: 4px;
            cursor: pointer; 
            transition: all 0.15s ease; 
            flex-shrink: 0;
        }
        
        button#sendBtn:hover { 
            background: var(--vscode-button-hover);
        }
        
        button#sendBtn:disabled { 
            background: var(--vscode-input-bg); 
            color: var(--vscode-sidebar-fg);
            cursor: not-allowed;
        }
        
        button#sendBtn svg { 
            width: 16px; 
            height: 16px; 
            stroke: currentColor; 
            stroke-width: 2; 
            fill: none;
        }
        
        .welcome { 
            text-align: center; 
            padding: 60px 24px; 
            color: var(--vscode-sidebar-fg);
        }
        
        .welcome-icon { 
            width: 48px; 
            height: 48px; 
            margin: 0 auto 16px; 
            stroke: var(--vscode-button-bg); 
            stroke-width: 1.5; 
            fill: none;
            animation: breathe 3s ease-in-out infinite;
        }
        
        @keyframes breathe {
            0%, 100% { 
                transform: scale(1); 
                opacity: 1; 
            }
            50% { 
                transform: scale(1.08); 
                opacity: 0.85; 
            }
        }
        
        .welcome h2 { 
            color: var(--vscode-fg); 
            margin-bottom: 8px; 
            font-weight: 500;
            font-size: 14px;
        }
        
        .welcome p {
            font-size: 12px;
            color: var(--vscode-sidebar-fg);
            line-height: 1.5;
        }
        
        .history-panel { 
            display: none; 
            position: absolute; 
            top: 100%; 
            right: 8px; 
            width: 280px; 
            background: var(--vscode-widget-bg); 
            border: 1px solid var(--vscode-widget-border); 
            border-radius: 4px; 
            max-height: 240px; 
            overflow-y: auto; 
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            margin-top: 4px;
        }
        
        .history-panel::-webkit-scrollbar {
            width: 10px;
        }
        
        .history-panel::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .history-panel::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbar-bg);
            border-radius: 0;
        }
        
        .history-panel.show { display: block; }
        
        .history-item { 
            padding: 6px 8px; 
            cursor: pointer; 
            border-bottom: 1px solid var(--vscode-border); 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            transition: all 0.15s ease;
        }
        
        .history-item:last-child { border-bottom: none; }
        
        .history-item:hover { 
            background: var(--vscode-list-hover);
        }
        
        .history-item.active { 
            background: var(--vscode-list-active);
        }
        
        .history-item .title { 
            flex: 1; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            white-space: nowrap;
            color: var(--vscode-fg);
            font-size: 12px;
        }
        
        .history-item.active .title {
            color: var(--vscode-button-fg);
        }
        
        .history-item .meta { 
            font-size: 11px; 
            color: var(--vscode-sidebar-fg); 
            margin-left: 8px;
            background: var(--vscode-widget-bg);
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid var(--vscode-widget-border);
        }
        
        .history-item .delete-btn { 
            background: none; 
            border: none; 
            color: var(--vscode-sidebar-fg); 
            cursor: pointer; 
            padding: 4px; 
            margin-left: 4px; 
            display: flex; 
            align-items: center;
            border-radius: 4px;
            transition: all 0.15s ease;
        }
        
        .history-item .delete-btn:hover { 
            color: var(--vscode-error); 
            background: var(--vscode-list-hover);
        }
        
        .history-item .delete-btn svg { 
            width: 14px; 
            height: 14px; 
            stroke: currentColor; 
            stroke-width: 2; 
            fill: none;
        }
        
        .no-history { 
            padding: 20px; 
            text-align: center; 
            color: var(--vscode-sidebar-fg);
            font-size: 12px;
        }
        
        .prompt-area { 
            border-top: 1px solid var(--vscode-border); 
            padding: 8px;
            background: var(--vscode-bg);
        }
        
        .prompt-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 6px;
        }
        
        .prompt-label { 
            font-size: 11px; 
            color: var(--vscode-sidebar-fg);
            font-weight: 500;
            text-transform: uppercase;
        }
        
        .prompt-actions { 
            display: flex; 
            gap: 4px;
        }
        
        .prompt-actions button { 
            background: transparent; 
            color: var(--vscode-sidebar-fg); 
            border: 1px solid transparent;
            cursor: pointer; 
            padding: 4px 6px; 
            font-size: 11px; 
            display: flex; 
            align-items: center; 
            gap: 4px;
            border-radius: 4px;
            transition: all 0.15s ease;
        }
        
        .prompt-actions button:hover { 
            color: var(--vscode-fg); 
            background: var(--vscode-list-hover);
            border-color: var(--vscode-widget-border);
        }
        
        .prompt-actions button svg { 
            width: 12px; 
            height: 12px; 
            stroke: currentColor; 
            stroke-width: 2; 
            fill: none;
        }
        
        #promptInput { 
            width: 100%; 
            min-height: 32px; 
            max-height: 80px; 
            padding: 6px 8px; 
            background: var(--vscode-input-bg); 
            color: var(--vscode-input-fg); 
            border: 1px solid var(--vscode-input-border); 
            border-radius: 4px;
            resize: vertical; 
            font-family: inherit; 
            font-size: 12px; 
            line-height: 1.5;
            transition: all 0.15s ease;
        }
        
        #promptInput:focus { 
            outline: none; 
            border-color: var(--vscode-focus-border);
            background: var(--vscode-input-bg);
        }
        
        #promptInput::-webkit-scrollbar {
            width: 10px;
        }
        
        #promptInput::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbar-bg);
            border-radius: 0;
        }
        
        #promptInput::placeholder { 
            color: var(--vscode-sidebar-fg);
        }
        
        .prompt-collapsed #promptInput { display: none; }
        
        .prompt-toggle { 
            transform: rotate(180deg); 
            transition: transform 0.15s ease;
        }
        
        .prompt-collapsed .prompt-toggle { 
            transform: rotate(0deg);
        }
        
        .thinking {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 8px 12px;
        }
        
        .thinking .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--vscode-button-bg);
            animation: bounce 1.4s ease-in-out infinite;
        }
        
        .thinking .dot:nth-child(1) {
            animation-delay: 0s;
        }
        
        .thinking .dot:nth-child(2) {
            animation-delay: 0.2s;
        }
        
        .thinking .dot:nth-child(3) {
            animation-delay: 0.4s;
        }
        
        @keyframes bounce {
            0%, 80%, 100% {
                transform: scale(0.8);
                opacity: 0.5;
            }
            40% {
                transform: scale(1.2);
                opacity: 1;
            }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <div class="toolbar-left">
            <button id="modelSelectBtn" class="model-select-btn" title="选择模型">
                <span id="currentModelName">加载中...</span>
                <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div id="modelPanel" class="model-panel"></div>
        </div>
        <div class="toolbar-right">
            <button id="newBtn" title="新建对话">
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button id="historyBtn" title="历史会话">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            </button>
        </div>
        <div id="historyPanel" class="history-panel"></div>
    </div>
    <div id="messages" class="messages">
        <div class="welcome">
            <svg class="welcome-icon" viewBox="2 1 20 20"><path d="M12 4l6 3.5v7L12 18l-6-3.5v-7L12 4z" fill="none" stroke-width="1.5"/><circle cx="12" cy="11" r="2"/></svg>
            <h2>RemoteTest AI 助手</h2>
            <p>输入问题开始对话</p>
        </div>
    </div>
    <div id="promptArea" class="prompt-area prompt-collapsed" style="padding: 8px 16px; border: none;">
        <div class="prompt-header" style="margin-bottom: 6px;">
            <span class="prompt-label">提示词</span>
            <div class="prompt-actions">
                <button id="importPromptBtn" title="导入文件">
                    <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                </button>
                <button id="clearPromptBtn" title="清空">
                    <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
                <button id="togglePromptBtn" class="prompt-toggle" title="展开/折叠">
                    <svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>
                </button>
            </div>
        </div>
        <textarea id="promptInput" placeholder="输入系统提示词..."></textarea>
    </div>
    <div class="input-area">
        <div class="input-wrap">
            <textarea id="input" placeholder="输入消息..." rows="1"></textarea>
            <button id="sendBtn" title="发送">
                <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const messages = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');
        const newBtn = document.getElementById('newBtn');
        const historyBtn = document.getElementById('historyBtn');
        const historyPanel = document.getElementById('historyPanel');
        const modelSelectBtn = document.getElementById('modelSelectBtn');
        const currentModelName = document.getElementById('currentModelName');
        const modelPanel = document.getElementById('modelPanel');
        const promptArea = document.getElementById('promptArea');
        const promptInput = document.getElementById('promptInput');
        const importPromptBtn = document.getElementById('importPromptBtn');
        const clearPromptBtn = document.getElementById('clearPromptBtn');
        const togglePromptBtn = document.getElementById('togglePromptBtn');
        let sessions = [];
        let currentSessionId = null;
        let availableModels = [];
        let currentModel = null;
        let systemPrompt = '';
        
        function escapeHtml(text) {
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        
        function renderModels() {
            if (!availableModels || availableModels.length === 0) {
                modelPanel.innerHTML = '<div class="no-models">无可用模型</div>';
                currentModelName.textContent = '无模型';
                return;
            }
            currentModelName.textContent = currentModel || availableModels[0]?.name || '选择模型';
            modelPanel.innerHTML = availableModels.map(m => 
                '<div class="model-item' + (m.name === currentModel ? ' active' : '') + '" data-name="' + escapeHtml(m.name) + '">' +
                '<span class="name">' + escapeHtml(m.name) + '</span>' +
                '<span class="check"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></span>' +
                '</div>'
            ).join('');
        }
        
        function addMessage(role, content, isRendered = false) {
            const welcome = messages.querySelector('.welcome');
            if (welcome) welcome.remove();
            const div = document.createElement('div');
            div.className = 'msg ' + role;
            
            let avatarHtml = '';
            if (role === 'user') {
                    avatarHtml = '<div class="avatar"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
                } else if (role === 'assistant') {
                    avatarHtml = '<div class="avatar"><svg viewBox="2 1 20 20"><path d="M12 4l6 3.5v7L12 18l-6-3.5v-7L12 4z" fill="none" stroke-width="1.5"/><circle cx="12" cy="11" r="2"/></svg></div>';
            } else if (role === 'error') {
                avatarHtml = '<div class="avatar"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></div>';
            }
            
            div.innerHTML = avatarHtml + '<div class="bubble">' + content + '</div>';
            messages.appendChild(div);
            addCopyButtons(div);
            messages.scrollTop = messages.scrollHeight;
            return div;
        }
        
        function addCopyButtons(container) {
            const copyBtns = container.querySelectorAll('.copy-btn');
            copyBtns.forEach((btn) => {
                btn.onclick = function() {
                    const pre = btn.closest('pre');
                    const code = pre ? (pre.querySelector('code')?.textContent || '') : '';
                    navigator.clipboard.writeText(code).then(() => {
                        btn.classList.add('copied');
                        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> 已复制';
                        setTimeout(() => {
                            btn.classList.remove('copied');
                            btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
                        }, 2000);
                    });
                };
            });
        }
        
        function renderMessages(msgs) {
            messages.innerHTML = '';
            if (!msgs || msgs.length === 0) {
                messages.innerHTML = '<div class="welcome"><svg class="welcome-icon" viewBox="2 1 20 20"><path d="M12 4l6 3.5v7L12 18l-6-3.5v-7L12 4z" fill="none" stroke-width="1.5"/><circle cx="12" cy="11" r="2"/></svg><h2>RemoteTest AI 助手</h2><p>输入问题开始对话</p></div>';
                return;
            }
            msgs.filter(m => m.role !== 'system').forEach(m => {
                const div = document.createElement('div');
                div.className = 'msg ' + m.role;
                
                let avatarHtml = '';
                if (m.role === 'user') {
                    avatarHtml = '<div class="avatar"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
                } else if (m.role === 'assistant') {
                    avatarHtml = '<div class="avatar"><svg viewBox="2 1 20 20"><path d="M12 4l6 3.5v7L12 18l-6-3.5v-7L12 4z" fill="none" stroke-width="1.5"/><circle cx="12" cy="11" r="2"/></svg></div>';
                } else if (m.role === 'error') {
                    avatarHtml = '<div class="avatar"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></div>';
                }
                
                let content = '';
                if (m.role === 'assistant' && m.renderedContent) {
                    content = m.renderedContent;
                } else {
                    content = m.role === 'user' ? escapeHtml(m.content) : m.content;
                }
                
                div.innerHTML = avatarHtml + '<div class="bubble">' + content + '</div>';
                messages.appendChild(div);
                addCopyButtons(div);
            });
            messages.scrollTop = messages.scrollHeight;
        }
        
        function renderHistory() {
            if (sessions.length === 0) {
                historyPanel.innerHTML = '<div class="no-history">暂无历史会话</div>';
                return;
            }
            historyPanel.innerHTML = sessions.map(s => 
                '<div class="history-item' + (s.id === currentSessionId ? ' active' : '') + '" data-id="' + s.id + '">' +
                '<span class="title">' + escapeHtml(s.title) + '</span>' +
                '<span class="meta">' + s.messageCount + '条</span>' +
                '<button class="delete-btn" data-id="' + s.id + '" title="删除"><svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>' +
                '</div>'
            ).join('');
        }
        
        function autoResize() {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 150) + 'px';
        }
        
        function send() {
            const text = input.value.trim();
            if (!text) return;
            systemPrompt = promptInput.value.trim();
            vscode.postMessage({ command: 'saveSystemPrompt', prompt: systemPrompt });
            addMessage('user', escapeHtml(text));
            input.value = '';
            autoResize();
            sendBtn.disabled = true;
            
            const welcome = messages.querySelector('.welcome');
            if (welcome) welcome.remove();
            const div = document.createElement('div');
            div.className = 'msg assistant';
            div.innerHTML = '<div class="avatar"><svg viewBox="2 1 20 20"><path d="M12 4l6 3.5v7L12 18l-6-3.5v-7L12 4z" fill="none" stroke-width="1.5"/><circle cx="12" cy="11" r="2"/></svg></div><div class="bubble thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
            div.id = 'thinkingMsg';
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
            
            vscode.postMessage({ command: 'sendMessage', data: { message: text, systemPrompt: systemPrompt } });
        }
        
        sendBtn.onclick = send;
        input.onkeydown = function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
            }
        };
        
        input.oninput = autoResize;
        
        newBtn.onclick = function() {
            historyPanel.classList.remove('show');
            modelPanel.classList.remove('show');
            modelSelectBtn.classList.remove('open');
            vscode.postMessage({ command: 'newSession' });
        };
        
        historyBtn.onclick = function() {
            modelPanel.classList.remove('show');
            modelSelectBtn.classList.remove('open');
            historyPanel.classList.toggle('show');
        };
        
        modelSelectBtn.onclick = function() {
            historyPanel.classList.remove('show');
            modelPanel.classList.toggle('show');
            modelSelectBtn.classList.toggle('open');
        };
        
        modelPanel.onclick = function(e) {
            const item = e.target.closest('.model-item');
            if (item) {
                const modelName = item.dataset.name;
                if (modelName && modelName !== currentModel) {
                    currentModel = modelName;
                    currentModelName.textContent = modelName;
                    vscode.postMessage({ command: 'switchModel', modelName: modelName });
                    renderModels();
                }
                modelPanel.classList.remove('show');
                modelSelectBtn.classList.remove('open');
            }
        };
        
        importPromptBtn.onclick = function() {
            vscode.postMessage({ command: 'importPrompt' });
        };
        
        clearPromptBtn.onclick = function() {
            promptInput.value = '';
            systemPrompt = '';
            vscode.postMessage({ command: 'saveSystemPrompt', prompt: '' });
        };
        
        togglePromptBtn.onclick = function() {
            promptArea.classList.toggle('prompt-collapsed');
        };
        
        historyPanel.onclick = function(e) {
            const item = e.target.closest('.history-item');
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                vscode.postMessage({ command: 'deleteSession', sessionId: deleteBtn.dataset.id });
            } else if (item) {
                historyPanel.classList.remove('show');
                vscode.postMessage({ command: 'switchSession', sessionId: item.dataset.id });
            }
        };
        
        document.onclick = function(e) {
            if (!modelSelectBtn.contains(e.target) && !modelPanel.contains(e.target)) {
                modelPanel.classList.remove('show');
                modelSelectBtn.classList.remove('open');
            }
            if (!historyBtn.contains(e.target) && !historyPanel.contains(e.target)) {
                historyPanel.classList.remove('show');
            }
        };
        
        window.onmessage = function(e) {
            const m = e.data;
            if (m.command === 'streamChunk') {
                const thinkingMsg = document.getElementById('thinkingMsg');
                if (thinkingMsg) {
                    thinkingMsg.id = '';
                    const bubble = thinkingMsg.querySelector('.bubble');
                    if (bubble && m.data) {
                        bubble.classList.remove('thinking');
                        bubble.innerHTML = m.data;
                        addCopyButtons(thinkingMsg);
                        messages.scrollTop = messages.scrollHeight;
                    }
                } else {
                    const lastMsg = messages.lastChild;
                    if (lastMsg && lastMsg.classList.contains('assistant')) {
                        const bubble = lastMsg.querySelector('.bubble');
                        if (bubble && m.data) {
                            bubble.innerHTML = m.data;
                            addCopyButtons(lastMsg);
                            messages.scrollTop = messages.scrollHeight;
                        }
                    }
                }
            } else if (m.command === 'streamComplete') {
                sendBtn.disabled = false;
                const thinkingMsg = document.getElementById('thinkingMsg');
                if (thinkingMsg) {
                    thinkingMsg.id = '';
                    const bubble = thinkingMsg.querySelector('.bubble');
                    if (bubble && m.data) {
                        bubble.classList.remove('thinking');
                        bubble.innerHTML = m.data;
                        addCopyButtons(thinkingMsg);
                    }
                } else {
                    const lastMsg = messages.lastChild;
                    if (lastMsg && lastMsg.classList.contains('assistant')) {
                        const bubble = lastMsg.querySelector('.bubble');
                        if (bubble && m.data) {
                            bubble.innerHTML = m.data;
                            addCopyButtons(lastMsg);
                        }
                    }
                }
            } else if (m.command === 'streamError') {
                const thinkingMsg = document.getElementById('thinkingMsg');
                if (thinkingMsg) {
                    thinkingMsg.remove();
                }
                addMessage('error', m.error);
                sendBtn.disabled = false;
            } else if (m.command === 'sessions') {
                sessions = m.data || [];
                renderHistory();
            } else if (m.command === 'currentSession') {
                currentSessionId = m.data ? m.data.id : null;
                renderMessages(m.data ? m.data.messages : []);
                renderHistory();
            } else if (m.command === 'models') {
                availableModels = m.data.models || [];
                currentModel = m.data.currentModel;
                renderModels();
            } else if (m.command === 'currentModel') {
                currentModel = m.data;
                renderModels();
            } else if (m.command === 'promptContent') {
                promptInput.value = m.data;
                systemPrompt = m.data;
            } else if (m.command === 'systemPrompt') {
                promptInput.value = m.data || '';
                systemPrompt = m.data || '';
            }
        };
        
        vscode.postMessage({ command: 'getSessions' });
        vscode.postMessage({ command: 'getModels' });
        vscode.postMessage({ command: 'getSystemPrompt' });
        
        promptInput.oninput = function() {
            systemPrompt = promptInput.value.trim();
            vscode.postMessage({ command: 'saveSystemPrompt', prompt: systemPrompt });
        };
    </script>
</body>
</html>`;
    }
}

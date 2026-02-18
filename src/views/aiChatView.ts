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
    
    html = html.replace(/<h([1-6])>/g, '<h$1 style="margin: 16px 0 8px 0; color: #e0e0e0; font-weight: 600;">');
    html = html.replace(/<ul>/g, '<ul style="margin: 8px 0; padding-left: 24px;">');
    html = html.replace(/<ol>/g, '<ol style="margin: 8px 0; padding-left: 24px;">');
    html = html.replace(/<li>/g, '<li style="margin: 4px 0; line-height: 1.6;">');
    html = html.replace(/<blockquote>/g, '<blockquote style="border-left: 3px solid #0e639c; padding: 8px 16px; margin: 12px 0; background: #252526; border-radius: 0 4px 4px 0;">');
    html = html.replace(/<table>/g, '<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">');
    html = html.replace(/<tr>/g, '<tr style="border-bottom: 1px solid #3c3c3c;">');
    html = html.replace(/<th>/g, '<th style="padding: 8px 12px; text-align: left;">');
    html = html.replace(/<td>/g, '<td style="padding: 8px 12px;">');
    html = html.replace(/<p>/g, '<p style="margin: 8px 0; line-height: 1.7;">');
    html = html.replace(/<code>(?![^<]*<\/code><\/pre>)/g, '<code style="background: #2d2d2d; padding: 2px 6px; border-radius: 3px; font-family: Consolas, Monaco, monospace; font-size: 0.9em;">');
    html = html.replace(/<a /g, '<a style="color: #3794ff; text-decoration: none;" target="_blank" ');
    
    return html;
}

export class AIChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'autotest-ai-view';
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
                    const currentSession = this.aiChat.getCurrentSession();
                    if (!currentSession || currentSession.messages.length > 0) {
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
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            background: linear-gradient(180deg, #1e1e1e 0%, #1a1a1a 100%); 
            color: #d4d4d4; 
            height: 100vh; 
            display: flex; 
            flex-direction: column;
        }
        
        .toolbar { 
            padding: 10px 16px; 
            background: linear-gradient(90deg, #2d2d30 0%, #252526 100%);
            border-bottom: 1px solid rgba(60, 60, 60, 0.6); 
            display: flex; 
            gap: 8px; 
            align-items: center; 
            position: relative; 
            justify-content: space-between;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .toolbar-left { display: flex; align-items: center; gap: 8px; }
        .toolbar-right { display: flex; align-items: center; gap: 6px; }
        
        .toolbar button { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            width: 38px; 
            height: 38px; 
            background: transparent; 
            color: #858585; 
            border: 1px solid transparent;
            cursor: pointer; 
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
            border-radius: 8px;
        }
        
        .toolbar button:hover { 
            color: #cccccc; 
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.1);
            transform: translateY(-1px);
        }
        
        .toolbar button:active {
            transform: translateY(0);
        }
        
        .toolbar button svg { 
            width: 20px; 
            height: 20px; 
            stroke: currentColor; 
            stroke-width: 2; 
            fill: none;
        }
        
        .model-select-btn { 
            background: rgba(255, 255, 255, 0.04); 
            color: #cccccc; 
            border: 1px solid rgba(60, 60, 60, 0.7); 
            border-radius: 10px;
            padding: 10px 16px; 
            font-size: 13px; 
            cursor: pointer; 
            min-width: 120px; 
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .model-select-btn:hover { 
            color: #ffffff; 
            border-color: rgba(80, 80, 80, 0.9);
            background: rgba(255, 255, 255, 0.06);
            transform: translateY(-1px);
        }
        
        .model-select-btn:active {
            transform: translateY(0);
        }
        
        .model-select-btn svg {
            width: 14px;
            height: 14px;
            stroke: currentColor;
            stroke-width: 1.8;
            fill: none;
            transition: transform 0.2s ease;
        }
        
        .model-select-btn.open svg {
            transform: rotate(180deg);
        }
        
        .model-panel { 
            display: none; 
            position: absolute; 
            top: 100%; 
            left: 12px; 
            right: auto;
            min-width: 200px;
            background: linear-gradient(135deg, #252526 0%, #1e1e1e 100%); 
            border: 1px solid rgba(60, 60, 60, 0.8); 
            border-radius: 12px; 
            max-height: 300px; 
            overflow-y: auto; 
            z-index: 100;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
            animation: slideDownFade 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            margin-top: 6px;
        }
        
        .model-panel::-webkit-scrollbar {
            width: 8px;
        }
        
        .model-panel::-webkit-scrollbar-track {
            background: transparent;
            margin: 8px;
        }
        
        .model-panel::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%);
            border-radius: 4px;
            border: 2px solid transparent;
            background-clip: padding-box;
        }
        
        .model-panel.show { display: block; }
        
        .model-item { 
            padding: 14px 18px; 
            cursor: pointer; 
            border-bottom: 1px solid rgba(60, 60, 60, 0.5); 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .model-item:last-child { border-bottom: none; }
        
        .model-item:hover { 
            background: rgba(255, 255, 255, 0.08);
            transform: translateX(2px);
        }
        
        .model-item.active { 
            background: rgba(14, 99, 156, 0.25);
            border-left: 4px solid #0e639c;
            padding-left: 14px;
        }
        
        .model-item .name { 
            color: #d4d4d4;
            font-size: 14px;
            font-weight: 500;
        }
        
        .model-item.active .name {
            color: #ffffff;
            font-weight: 600;
        }
        
        .model-item .check {
            color: #0e639c;
            opacity: 0;
            transform: scale(0.5);
            transition: all 0.2s ease;
        }
        
        .model-item.active .check {
            opacity: 1;
            transform: scale(1);
        }
        
        .model-item .check svg {
            width: 18px;
            height: 18px;
            stroke: currentColor;
            stroke-width: 2.5;
            fill: none;
        }
        
        .no-models { 
            padding: 40px; 
            text-align: center; 
            color: #9a9a9a;
            font-size: 14px;
        }
        
        .messages { 
            flex: 1; 
            overflow-y: auto; 
            padding: 24px 20px;
        }
        
        .messages::-webkit-scrollbar {
            width: 10px;
        }
        
        .messages::-webkit-scrollbar-track {
            background: transparent;
            margin: 4px;
        }
        
        .messages::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%);
            border-radius: 5px;
            border: 2px solid transparent;
            background-clip: padding-box;
        }
        
        .messages::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #5a5a5a 0%, #4a4a4a 100%);
        }
        
        .msg { 
            margin-bottom: 20px; 
            display: flex;
            gap: 12px;
            animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            align-items: flex-start;
        }
        
        @keyframes fadeInUp {
            from { 
                opacity: 0; 
                transform: translateY(16px) scale(0.98); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }
        
        .msg.user { 
            flex-direction: row-reverse;
        }
        
        .avatar {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .user .avatar {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .assistant .avatar {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        
        .error .avatar {
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }
        
        .avatar svg {
            width: 20px;
            height: 20px;
            stroke: #ffffff;
            stroke-width: 2;
            fill: none;
        }
        
        .bubble { 
            padding: 16px 20px; 
            border-radius: 16px; 
            max-width: 82%; 
            line-height: 1.7;
            word-wrap: break-word;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
            position: relative;
        }
        
        .user .bubble { 
            background: linear-gradient(135deg, #0e639c 0%, #007acc 50%, #0088dd 100%);
            border: none;
            color: #ffffff;
            border-bottom-right-radius: 6px;
        }
        
        .assistant .bubble { 
            background: linear-gradient(135deg, rgba(45, 45, 48, 0.95) 0%, rgba(37, 37, 38, 0.95) 100%); 
            border: 1px solid rgba(60, 60, 60, 0.6);
            backdrop-filter: blur(20px);
            border-bottom-left-radius: 6px;
        }
        
        .error .bubble { 
            background: linear-gradient(135deg, rgba(90, 29, 29, 0.5) 0%, rgba(60, 20, 20, 0.5) 100%); 
            border: 1px solid #5a1d1d; 
            color: #f48771;
        }
        
        .bubble pre { 
            background: linear-gradient(135deg, #1e1e1e 0%, #1a1a1a 100%); 
            border-radius: 12px; 
            overflow: hidden; 
            margin: 18px 0; 
            border: 1px solid rgba(60, 60, 60, 0.7);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        }
        
        .bubble pre code { 
            display: block; 
            padding: 18px; 
            overflow-x: auto; 
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace; 
            font-size: 13px; 
            line-height: 1.7; 
            background: none;
        }
        
        .code-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 12px 18px; 
            background: linear-gradient(90deg, #2d2d30 0%, #252526 100%); 
            border-bottom: 1px solid rgba(60, 60, 60, 0.6);
        }
        
        .code-lang { 
            font-size: 12px; 
            color: #a0a0a0; 
            font-family: 'Consolas', 'Monaco', monospace; 
            text-transform: uppercase; 
            letter-spacing: 0.8px;
            font-weight: 600;
        }
        
        .copy-btn { 
            background: rgba(255, 255, 255, 0.05); 
            color: #858585; 
            border: 1px solid rgba(60, 60, 60, 0.8); 
            border-radius: 8px; 
            padding: 7px 12px; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            gap: 6px; 
            font-size: 12px; 
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .copy-btn:hover { 
            color: #ffffff; 
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(100, 100, 100, 0.9);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .copy-btn:active {
            transform: translateY(0);
        }
        
        .copy-btn svg { 
            width: 14px; 
            height: 14px; 
            stroke: currentColor; 
            stroke-width: 2; 
            fill: none;
        }
        
        .copy-btn.copied { 
            color: #4ec9b0;
            border-color: #4ec9b0;
            background: rgba(78, 201, 176, 0.15);
            box-shadow: 0 0 12px rgba(78, 201, 176, 0.2);
        }
        
        .bubble code { 
            background: rgba(255, 255, 255, 0.12); 
            padding: 4px 10px; 
            border-radius: 6px; 
            font-family: 'Consolas', 'Monaco', monospace; 
            font-size: 0.88em;
            color: #4ec9b0;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .user .bubble code {
            background: rgba(255, 255, 255, 0.25);
            color: #ffffff;
            border-color: rgba(255, 255, 255, 0.15);
        }
        
        .bubble a { 
            color: #3794ff; 
            text-decoration: none;
            transition: all 0.2s ease;
            padding: 2px 4px;
            border-radius: 4px;
        }
        
        .bubble a:hover {
            color: #4da6ff;
            background: rgba(55, 148, 255, 0.1);
            text-decoration: none;
        }
        
        .bubble strong { 
            color: #ffffff; 
            font-weight: 700;
        }
        
        .bubble em { 
            color: #e0e0e0;
            font-style: italic;
        }
        
        .bubble hr { 
            border: none; 
            border-top: 2px solid rgba(60, 60, 60, 0.5); 
            margin: 24px 0;
            border-radius: 2px;
        }
        
        .bubble img { 
            max-width: 100%; 
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }
        
        .hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-name, .hljs-tag { color: #569cd6; }
        .hljs-string, .hljs-title, .hljs-section, .hljs-attribute, .hljs-literal, .hljs-template-tag, .hljs-template-variable, .hljs-type { color: #ce9178; }
        .hljs-comment, .hljs-deletion { color: #6a9955; }
        .hljs-number, .hljs-regexp, .hljs-addition { color: #b5cea8; }
        .hljs-function { color: #dcdcaa; }
        .hljs-variable, .hljs-params { color: #9cdcfe; }
        .hljs-class .hljs-title { color: #4ec9b0; }
        .hljs-symbol, .hljs-bullet { color: #d4d4d4; }
        .hljs-meta { color: #808080; }
        .hljs-link { color: #3794ff; text-decoration: underline; }
        
        .input-area { 
            padding: 14px 16px; 
            border-top: 1px solid rgba(60, 60, 60, 0.6); 
            background: linear-gradient(0deg, #252526 0%, #2d2d30 100%);
            box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
        }
        
        .input-wrap { 
            display: flex; 
            gap: 12px; 
            align-items: flex-end;
        }
        
        textarea { 
            flex: 1; 
            padding: 14px 18px; 
            background: rgba(255, 255, 255, 0.06); 
            color: #e0e0e0; 
            border: 1px solid rgba(60, 60, 60, 0.8); 
            border-radius: 12px;
            resize: none; 
            font-family: inherit; 
            font-size: 14px; 
            line-height: 1.7; 
            min-height: 52px; 
            max-height: 160px;
            -webkit-appearance: none; 
            appearance: none; 
            overflow-y: auto;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.2);
        }
        
        textarea::-webkit-scrollbar {
            width: 8px;
        }
        
        textarea::-webkit-scrollbar-track {
            background: transparent;
            margin: 4px;
        }
        
        textarea::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%);
            border-radius: 4px;
            border: 2px solid transparent;
            background-clip: padding-box;
        }
        
        textarea:focus { 
            outline: none; 
            border-color: #0e639c;
            background: rgba(14, 99, 156, 0.12);
            box-shadow: 0 0 0 3px rgba(14, 99, 156, 0.25), inset 0 1px 4px rgba(0, 0, 0, 0.2);
        }
        
        textarea::placeholder {
            color: #6a6a6a;
        }
        
        button#sendBtn { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            width: 50px; 
            height: 50px; 
            background: linear-gradient(135deg, #0e639c 0%, #007acc 50%, #0088dd 100%);
            color: #ffffff; 
            border: none; 
            border-radius: 14px;
            cursor: pointer; 
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); 
            flex-shrink: 0;
            box-shadow: 0 4px 16px rgba(0, 122, 204, 0.4);
        }
        
        button#sendBtn:hover { 
            background: linear-gradient(135deg, #1177bb 0%, #0088dd 50%, #1199ee 100%);
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 6px 24px rgba(0, 122, 204, 0.5);
        }
        
        button#sendBtn:active {
            transform: translateY(0) scale(0.97);
            box-shadow: 0 2px 12px rgba(0, 122, 204, 0.4);
        }
        
        button#sendBtn:disabled { 
            background: linear-gradient(135deg, #3c3c3c 0%, #333333 100%); 
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        button#sendBtn svg { 
            width: 24px; 
            height: 24px; 
            stroke: currentColor; 
            stroke-width: 2.2; 
            fill: none;
        }
        
        .welcome { 
            text-align: center; 
            padding: 100px 24px; 
            color: #858585;
        }
        
        .welcome-icon { 
            width: 80px; 
            height: 80px; 
            margin: 0 auto 28px; 
            stroke: #0e639c; 
            stroke-width: 1.5; 
            fill: none;
            animation: breathe 3s ease-in-out infinite;
            filter: drop-shadow(0 4px 12px rgba(14, 99, 156, 0.3));
        }
        
        @keyframes breathe {
            0%, 100% { 
                opacity: 0.7; 
                transform: scale(1); 
                filter: drop-shadow(0 4px 12px rgba(14, 99, 156, 0.3));
            }
            50% { 
                opacity: 1; 
                transform: scale(1.08); 
                filter: drop-shadow(0 6px 20px rgba(14, 99, 156, 0.5));
            }
        }
        
        .welcome h2 { 
            color: #ffffff; 
            margin-bottom: 12px; 
            font-weight: 600;
            font-size: 22px;
            background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .welcome p {
            font-size: 15px;
            color: #9a9a9a;
            line-height: 1.7;
        }
        
        .history-panel { 
            display: none; 
            position: absolute; 
            top: 100%; 
            left: 12px; 
            right: 12px; 
            background: linear-gradient(135deg, #252526 0%, #1e1e1e 100%); 
            border: 1px solid rgba(60, 60, 60, 0.8); 
            border-radius: 12px; 
            max-height: 340px; 
            overflow-y: auto; 
            z-index: 100;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
            animation: slideDownFade 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            margin-top: 6px;
        }
        
        @keyframes slideDownFade {
            from { 
                opacity: 0; 
                transform: translateY(-12px) scale(0.96); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }
        
        .history-panel::-webkit-scrollbar {
            width: 8px;
        }
        
        .history-panel::-webkit-scrollbar-track {
            background: transparent;
            margin: 8px;
        }
        
        .history-panel::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #4a4a4a 0%, #3a3a3a 100%);
            border-radius: 4px;
            border: 2px solid transparent;
            background-clip: padding-box;
        }
        
        .history-panel.show { display: block; }
        
        .history-item { 
            padding: 14px 18px; 
            cursor: pointer; 
            border-bottom: 1px solid rgba(60, 60, 60, 0.5); 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .history-item:last-child { border-bottom: none; }
        
        .history-item:hover { 
            background: rgba(255, 255, 255, 0.08);
            transform: translateX(2px);
        }
        
        .history-item.active { 
            background: rgba(14, 99, 156, 0.25);
            border-left: 4px solid #0e639c;
            padding-left: 14px;
        }
        
        .history-item .title { 
            flex: 1; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            white-space: nowrap;
            color: #d4d4d4;
            font-size: 14px;
            font-weight: 500;
        }
        
        .history-item .meta { 
            font-size: 12px; 
            color: #9a9a9a; 
            margin-left: 14px;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px 10px;
            border-radius: 8px;
            border: 1px solid rgba(60, 60, 60, 0.5);
        }
        
        .history-item .delete-btn { 
            background: none; 
            border: none; 
            color: #858585; 
            cursor: pointer; 
            padding: 8px; 
            margin-left: 10px; 
            display: flex; 
            align-items: center;
            border-radius: 8px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .history-item .delete-btn:hover { 
            color: #f48771; 
            background: rgba(244, 135, 113, 0.15);
            transform: scale(1.05);
        }
        
        .history-item .delete-btn svg { 
            width: 16px; 
            height: 16px; 
            stroke: currentColor; 
            stroke-width: 2; 
            fill: none;
        }
        
        .no-history { 
            padding: 40px; 
            text-align: center; 
            color: #9a9a9a;
            font-size: 14px;
        }
        
        .prompt-area { 
            border-top: 1px solid rgba(60, 60, 60, 0.6); 
            padding: 12px 16px;
            background: linear-gradient(0deg, #252526 0%, #2a2a2a 100%);
        }
        
        .prompt-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 10px;
        }
        
        .prompt-label { 
            font-size: 12px; 
            color: #9a9a9a;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }
        
        .prompt-actions { 
            display: flex; 
            gap: 6px;
        }
        
        .prompt-actions button { 
            background: transparent; 
            color: #858585; 
            border: 1px solid transparent;
            cursor: pointer; 
            padding: 7px 10px; 
            font-size: 12px; 
            display: flex; 
            align-items: center; 
            gap: 4px;
            border-radius: 8px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .prompt-actions button:hover { 
            color: #cccccc; 
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.1);
            transform: translateY(-1px);
        }
        
        .prompt-actions button svg { 
            width: 14px; 
            height: 14px; 
            stroke: currentColor; 
            stroke-width: 2; 
            fill: none;
        }
        
        #promptInput { 
            width: 100%; 
            min-height: 52px; 
            max-height: 120px; 
            padding: 12px 14px; 
            background: rgba(255, 255, 255, 0.04); 
            color: #d4d4d4; 
            border: 1px solid rgba(60, 60, 60, 0.8); 
            border-radius: 10px;
            resize: vertical; 
            font-family: inherit; 
            font-size: 13px; 
            line-height: 1.6;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.15);
        }
        
        #promptInput:focus { 
            outline: none; 
            border-color: #5c5c5c;
            background: rgba(255, 255, 255, 0.06);
            box-shadow: 0 0 0 3px rgba(92, 92, 92, 0.2), inset 0 1px 4px rgba(0, 0, 0, 0.15);
        }
        
        #promptInput::-webkit-scrollbar {
            width: 6px;
        }
        
        #promptInput::-webkit-scrollbar-thumb {
            background: #4a4a4a;
            border-radius: 3px;
        }
        
        #promptInput::placeholder { 
            color: #6a6a6a;
        }
        
        .prompt-collapsed #promptInput { display: none; }
        
        .prompt-toggle { 
            transform: rotate(180deg); 
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .prompt-collapsed .prompt-toggle { 
            transform: rotate(0deg);
        }
        
        .thinking {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 16px 24px;
        }
        
        .thinking .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #0e639c;
            animation: bounce 1.4s ease-in-out infinite;
            box-shadow: 0 0 8px rgba(14, 99, 156, 0.6);
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
            <svg class="welcome-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>
            <h2>AutoTest AI 助手</h2>
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
                avatarHtml = '<div class="avatar"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg></div>';
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
                messages.innerHTML = '<div class="welcome"><svg class="welcome-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg><h2>AutoTest AI 助手</h2><p>输入问题开始对话</p></div>';
                return;
            }
            msgs.filter(m => m.role !== 'system').forEach(m => {
                const div = document.createElement('div');
                div.className = 'msg ' + m.role;
                
                let avatarHtml = '';
                if (m.role === 'user') {
                    avatarHtml = '<div class="avatar"><svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>';
                } else if (m.role === 'assistant') {
                    avatarHtml = '<div class="avatar"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg></div>';
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
            div.innerHTML = '<div class="avatar"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg></div><div class="bubble thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
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

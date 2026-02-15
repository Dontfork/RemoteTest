import * as vscode from 'vscode';
import { AIChat } from '../ai';

export class AIChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'autotest-ai-view';
    private aiChat: AIChat;
    private view: vscode.WebviewView | undefined;
    private extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri, aiChat: AIChat) {
        this.extensionUri = extensionUri;
        this.aiChat = aiChat;
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
                    this.aiChat.clearMessages();
                    this.view?.webview.postMessage({ command: 'chatCleared' });
                    break;
            }
        });
    }

    private async handleSendMessage(userMessage: string): Promise<void> {
        try {
            const response = await this.aiChat.sendMessage(userMessage);
            this.view?.webview.postMessage({
                command: 'aiResponse',
                data: response.content,
                error: response.error
            });
        } catch (error: any) {
            this.view?.webview.postMessage({
                command: 'aiResponse',
                data: '',
                error: error.message
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
        body { font-family: var(--vscode-font-family); background: var(--vscode-sideBar-background); color: var(--vscode-foreground); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .chat { display: flex; flex-direction: column; height: 100%; }
        .messages { flex: 1; overflow-y: auto; padding: 16px; }
        .msg { margin-bottom: 12px; display: flex; }
        .msg.user { justify-content: flex-end; }
        .msg.assistant { justify-content: flex-start; }
        .bubble { max-width: 90%; padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.6; overflow-wrap: break-word; }
        .msg.user .bubble { background: var(--vscode-editor-inactiveSelectionBackground); }
        .msg.assistant .bubble { background: var(--vscode-editor-background); border: 1px solid var(--vscode-input-border); }
        .msg.error .bubble { background: transparent; border: 1px solid rgba(255,100,100,0.3); color: #f66; }
        .input-box { padding: 8px 12px; border-top: 1px solid var(--vscode-input-border); display: flex; gap: 8px; align-items: center; }
        .input-box input { flex: 1; padding: 8px 12px; border: none; background: transparent; font-size: 13px; color: var(--vscode-input-foreground); outline: none; }
        .input-box input::placeholder { color: var(--vscode-input-placeholderForeground); }
        .send-btn { width: 28px; height: 28px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.7; }
        .send-btn:hover { opacity: 1; }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .send-btn svg { width: 18px; height: 18px; fill: var(--vscode-foreground); }
        .welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--vscode-descriptionForeground); text-align: center; }
        .welcome-icon { font-size: 28px; margin-bottom: 8px; opacity: 0.6; }
        .welcome-text { font-size: 13px; }
        .typing { display: flex; gap: 3px; padding: 8px 12px; }
        .typing span { width: 5px; height: 5px; background: var(--vscode-descriptionForeground); border-radius: 50%; opacity: 0.5; animation: pulse 1.2s infinite; }
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
        
        .md-content p { margin: 0 0 8px 0; }
        .md-content p:last-child { margin-bottom: 0; }
        .md-content code { background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 4px; font-family: var(--vscode-editor-font-family); font-size: 12px; }
        .md-content pre { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
        .md-content pre code { background: none; padding: 0; font-size: 12px; line-height: 1.5; }
        .md-content ul, .md-content ol { margin: 8px 0; padding-left: 20px; }
        .md-content li { margin: 4px 0; }
        .md-content h1, .md-content h2, .md-content h3, .md-content h4 { margin: 12px 0 8px 0; font-weight: 600; }
        .md-content h1 { font-size: 18px; }
        .md-content h2 { font-size: 16px; }
        .md-content h3 { font-size: 14px; }
        .md-content h4 { font-size: 13px; }
        .md-content blockquote { border-left: 3px solid var(--vscode-input-border); padding-left: 12px; margin: 8px 0; color: var(--vscode-descriptionForeground); }
        .md-content strong { font-weight: 600; }
        .md-content em { font-style: italic; }
        .md-content a { color: var(--vscode-textLink-foreground); text-decoration: none; }
        .md-content a:hover { text-decoration: underline; }
        .md-content hr { border: none; border-top: 1px solid var(--vscode-input-border); margin: 12px 0; }
        .md-content table { border-collapse: collapse; margin: 8px 0; width: 100%; }
        .md-content th, .md-content td { border: 1px solid var(--vscode-input-border); padding: 6px 10px; text-align: left; }
        .md-content th { background: var(--vscode-editor-inactiveSelectionBackground); font-weight: 600; }
    </style>
</head>
<body>
    <div class="chat">
        <div class="messages" id="messages">
            <div class="welcome">
                <div class="welcome-icon">💬</div>
                <div class="welcome-text">开始对话</div>
            </div>
        </div>
        <div class="input-box">
            <input type="text" id="input" placeholder="输入消息...">
            <button class="send-btn" id="sendBtn">
                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const messages = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');
        
        function send() {
            const text = input.value.trim();
            if (!text) return;
            addMsg('user', text);
            input.value = '';
            sendBtn.disabled = true;
            showTyping();
            vscode.postMessage({ command: 'sendMessage', data: text });
        }
        
        function addMsg(role, content) {
            const w = messages.querySelector('.welcome');
            if (w) w.remove();
            const t = messages.querySelector('.typing');
            if (t) t.parentElement.remove();
            const d = document.createElement('div');
            d.className = 'msg ' + role;
            if (role === 'assistant') {
                d.innerHTML = '<div class="bubble md-content">' + renderMarkdown(content) + '</div>';
            } else if (role === 'error') {
                d.innerHTML = '<div class="bubble">' + esc(content) + '</div>';
            } else {
                d.innerHTML = '<div class="bubble">' + esc(content) + '</div>';
            }
            messages.appendChild(d);
            messages.scrollTop = messages.scrollHeight;
        }
        
        function showTyping() {
            const d = document.createElement('div');
            d.className = 'msg assistant';
            d.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
            messages.appendChild(d);
            messages.scrollTop = messages.scrollHeight;
        }
        
        function esc(t) { 
            return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); 
        }
        
        function renderMarkdown(text) {
            let html = esc(text);
            
            html = html.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(match, lang, code) {
                return '<pre><code class="language-' + lang + '">' + code.trim() + '</code></pre>';
            });
            
            html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
            
            html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
            
            html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
            html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
            html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
            
            html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
            
            html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
            html = html.replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>');
            
            html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');
            
            html = html.replace(/^---$/gm, '<hr>');
            
            html = html.replace(/\\n\\n/g, '</p><p>');
            html = '<p>' + html + '</p>';
            html = html.replace(/<p><\\/p>/g, '');
            html = html.replace(/<p>(<h[1-6]>)/g, '$1');
            html = html.replace(/(<\\/h[1-6]>)<\\/p>/g, '$1');
            html = html.replace(/<p>(<pre>)/g, '$1');
            html = html.replace(/(<\\/pre>)<\\/p>/g, '$1');
            html = html.replace(/<p>(<ul>)/g, '$1');
            html = html.replace(/(<\\/ul>)<\\/p>/g, '$1');
            html = html.replace(/<p>(<blockquote>)/g, '$1');
            html = html.replace(/(<\\/blockquote>)<\\/p>/g, '$1');
            html = html.replace(/<p>(<hr>)<\\/p>/g, '$1');
            
            return html;
        }
        
        sendBtn.onclick = send;
        input.onkeypress = e => { if (e.key === 'Enter') send(); };
        
        window.onmessage = e => {
            const m = e.data;
            sendBtn.disabled = false;
            if (m.command === 'aiResponse') {
                const t = messages.querySelector('.typing');
                if (t) t.parentElement.remove();
                addMsg(m.error ? 'error' : 'assistant', m.error || m.data);
            }
        };
    </script>
</body>
</html>`;
    }
}

import * as vscode from 'vscode';
import { AIChat } from '../ai';
import { SessionManager } from '../ai/sessionManager';
import { ChatSession } from '../types';

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
                    this.aiChat.createNewSession();
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
            }
        });

        this.sessionManager.onSessionsChange(() => {
            this.sendSessions();
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

    private sendCurrentSession(): void {
        const session = this.aiChat.getCurrentSession();
        this.view?.webview.postMessage({
            command: 'currentSession',
            data: session ? {
                id: session.id,
                title: session.title,
                messages: session.messages
            } : null
        });
    }

    private async handleSendMessage(userMessage: string): Promise<void> {
        try {
            let fullContent = '';
            
            const response = await this.aiChat.sendMessageStream(userMessage, (chunk) => {
                fullContent += chunk;
                this.view?.webview.postMessage({
                    command: 'streamChunk',
                    data: chunk
                });
            });

            if (response.error) {
                this.view?.webview.postMessage({
                    command: 'streamError',
                    error: response.error
                });
            } else {
                this.view?.webview.postMessage({
                    command: 'streamComplete',
                    data: response.content || fullContent
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #cccccc; height: 100vh; display: flex; flex-direction: column; }
        .toolbar { padding: 8px; border-bottom: 1px solid #3c3c3c; display: flex; gap: 8px; }
        .toolbar button { flex: 1; padding: 8px 12px; background: #0e639c; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .toolbar button:hover { background: #1177bb; }
        .messages { flex: 1; overflow-y: auto; padding: 12px; }
        .msg { margin-bottom: 12px; }
        .bubble { padding: 10px 14px; border-radius: 8px; max-width: 90%; }
        .user .bubble { background: #0e639c; color: white; margin-left: auto; }
        .assistant .bubble { background: #2d2d2d; border: 1px solid #3c3c3c; }
        .error .bubble { background: #5a1d1d; border: 1px solid #be1100; color: #ff6b6b; }
        .input-area { padding: 12px; border-top: 1px solid #3c3c3c; }
        .input-wrap { display: flex; gap: 8px; }
        textarea { flex: 1; padding: 10px; background: #3c3c3c; color: #cccccc; border: 1px solid #3c3c3c; border-radius: 4px; resize: none; font-family: inherit; }
        textarea:focus { outline: none; border-color: #0e639c; }
        button#sendBtn { padding: 10px 20px; background: #0e639c; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button#sendBtn:hover { background: #1177bb; }
        button#sendBtn:disabled { background: #3c3c3c; cursor: not-allowed; }
        .welcome { text-align: center; padding: 40px 20px; color: #858585; }
        .welcome h2 { color: #cccccc; margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="toolbar">
        <button id="newBtn">+ 新对话</button>
        <button id="historyBtn">历史</button>
    </div>
    <div id="messages" class="messages">
        <div class="welcome">
            <h2>AutoTest AI 助手</h2>
            <p>输入问题开始对话</p>
        </div>
    </div>
    <div class="input-area">
        <div class="input-wrap">
            <textarea id="input" placeholder="输入消息..." rows="2"></textarea>
            <button id="sendBtn">发送</button>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const messages = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');
        const newBtn = document.getElementById('newBtn');
        
        function addMessage(role, content) {
            const welcome = messages.querySelector('.welcome');
            if (welcome) welcome.remove();
            const div = document.createElement('div');
            div.className = 'msg ' + role;
            div.innerHTML = '<div class="bubble">' + content + '</div>';
            messages.appendChild(div);
            messages.scrollTop = messages.scrollHeight;
            return div;
        }
        
        function send() {
            const text = input.value.trim();
            if (!text) return;
            addMessage('user', text);
            input.value = '';
            sendBtn.disabled = true;
            addMessage('assistant', '思考中...');
            vscode.postMessage({ command: 'sendMessage', data: text });
        }
        
        sendBtn.onclick = send;
        input.onkeydown = function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
            }
        };
        
        newBtn.onclick = function() {
            messages.innerHTML = '<div class="welcome"><h2>AutoTest AI 助手</h2><p>输入问题开始对话</p></div>';
            vscode.postMessage({ command: 'newSession' });
        };
        
        window.onmessage = function(e) {
            const m = e.data;
            if (m.command === 'streamChunk') {
                const lastMsg = messages.lastChild;
                if (lastMsg && lastMsg.classList.contains('assistant')) {
                    const bubble = lastMsg.querySelector('.bubble');
                    if (bubble) {
                        if (bubble.textContent === '思考中...') bubble.textContent = '';
                        bubble.textContent += m.data;
                        messages.scrollTop = messages.scrollHeight;
                    }
                }
            } else if (m.command === 'streamComplete') {
                sendBtn.disabled = false;
            } else if (m.command === 'streamError') {
                addMessage('error', m.error);
                sendBtn.disabled = false;
            }
        };
        
        vscode.postMessage({ command: 'getSessions' });
    </script>
</body>
</html>`;
    }
}

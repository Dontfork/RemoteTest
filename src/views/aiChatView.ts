import * as vscode from 'vscode';
import { AIChat } from '../ai';
import { SessionManager } from '../ai/sessionManager';
import { ChatSession } from '../types';
import { log, logError } from '../utils/logger';

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
        log(`[AIChatView] handleSendMessage 开始, 消息: "${userMessage.substring(0, 50)}..."`);
        
        try {
            let fullContent = '';
            let chunkCount = 0;
            
            const response = await this.aiChat.sendMessageStream(userMessage, (chunk) => {
                fullContent += chunk;
                chunkCount++;
                log(`[AIChatView] 收到 chunk #${chunkCount}, 长度: ${chunk.length}`);
                this.view?.webview.postMessage({
                    command: 'streamChunk',
                    data: chunk
                });
            });

            log(`[AIChatView] sendStream 完成, 总 chunks: ${chunkCount}, 总长度: ${fullContent.length}`);

            if (response.error) {
                logError('[AIChatView] 响应包含错误', response.error);
                this.view?.webview.postMessage({
                    command: 'streamError',
                    error: response.error
                });
            } else {
                log('[AIChatView] 发送 streamComplete');
                this.view?.webview.postMessage({
                    command: 'streamComplete',
                    data: fullContent
                });
                this.sendSessions();
            }
        } catch (error: any) {
            logError('[AIChatView] handleSendMessage 异常', error.message);
            this.view?.webview.postMessage({
                command: 'streamError',
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
        
        .toolbar { padding: 8px; border-bottom: 1px solid var(--vscode-input-border); display: flex; gap: 4px; }
        .toolbar-btn { flex: 1; padding: 6px 10px; border: none; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; border-radius: 4px; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .toolbar-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
        
        .session-list { max-height: 200px; overflow-y: auto; border-bottom: 1px solid var(--vscode-input-border); }
        .session-item { padding: 8px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--vscode-input-border); }
        .session-item:hover { background: var(--vscode-list-hoverBackground); }
        .session-item.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
        .session-info { flex: 1; overflow: hidden; }
        .session-title { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .session-meta { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
        .session-delete { width: 20px; height: 20px; border: none; background: transparent; cursor: pointer; opacity: 0.5; display: flex; align-items: center; justify-content: center; color: var(--vscode-foreground); font-size: 14px; }
        .session-delete:hover { opacity: 1; color: #f66; }
        
        .messages { flex: 1; overflow-y: auto; padding: 12px; }
        .welcome { text-align: center; padding: 40px 20px; color: var(--vscode-descriptionForeground); }
        .welcome h2 { margin-bottom: 12px; color: var(--vscode-foreground); }
        .msg { margin-bottom: 12px; }
        .bubble { padding: 10px 14px; border-radius: 12px; max-width: 100%; word-wrap: break-word; line-height: 1.5; }
        .user .bubble { background: var(--vscode-button-background); color: var(--vscode-button-foreground); margin-left: auto; }
        .assistant .bubble { background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); }
        .error .bubble { background: rgba(255,0,0,0.1); border: 1px solid rgba(255,0,0,0.3); color: #f66; }
        .streaming .bubble { opacity: 0.8; }
        .cursor { animation: blink 1s infinite; }
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        
        .md-content pre { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
        .md-content code { font-family: var(--vscode-editor-font-family); font-size: 12px; }
        .md-content p code { background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 4px; }
        .md-content h1, .md-content h2, .md-content h3 { margin: 12px 0 8px; }
        .md-content ul { margin: 8px 0; padding-left: 20px; }
        .md-content li { margin: 4px 0; }
        .md-content blockquote { border-left: 3px solid var(--vscode-input-border); padding-left: 12px; margin: 8px 0; color: var(--vscode-descriptionForeground); }
        .md-content a { color: var(--vscode-textLink-foreground); }
        .md-content a:hover { text-decoration: underline; }
        
        .input-area { padding: 12px; border-top: 1px solid var(--vscode-input-border); }
        .input-wrap { display: flex; gap: 8px; }
        textarea { flex: 1; resize: none; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 6px; padding: 10px; font-family: inherit; font-size: 13px; min-height: 60px; max-height: 150px; }
        textarea:focus { outline: 1px solid var(--vscode-focusBorder); }
        button { padding: 10px 16px; border: none; background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; border-radius: 6px; font-size: 13px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
    </style>
</head>
<body>
    <div class="chat">
        <div class="toolbar">
            <button id="newBtn" class="toolbar-btn">+ 新对话</button>
            <button id="toggleSessions" class="toolbar-btn">历史</button>
        </div>
        <div id="sessionList" class="session-list hidden"></div>
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
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const messages = document.getElementById('messages');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');
        const newBtn = document.getElementById('newBtn');
        const toggleSessions = document.getElementById('toggleSessions');
        const sessionList = document.getElementById('sessionList');
        
        let streamingMsg = null;
        let streamContent = '';
        let currentSessionId = null;
        let sessions = [];
        
        vscode.postMessage({ command: 'getSessions' });
        
        function send() {
            const text = input.value.trim();
            if (!text) return;
            addMsg('user', text);
            input.value = '';
            sendBtn.disabled = true;
            showStreamingMsg();
            vscode.postMessage({ command: 'sendMessage', data: text });
        }
        
        function addMsg(role, content) {
            const w = messages.querySelector('.welcome');
            if (w) w.remove();
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
            return d;
        }
        
        function showStreamingMsg() {
            streamContent = '';
            const d = document.createElement('div');
            d.className = 'msg assistant streaming';
            d.innerHTML = '<div class="bubble md-content"><span class="cursor">▌</span></div>';
            messages.appendChild(d);
            messages.scrollTop = messages.scrollHeight;
            streamingMsg = d;
        }
        
        function updateStreamingMsg(chunk) {
            streamContent += chunk;
            if (streamingMsg) {
                const bubble = streamingMsg.querySelector('.bubble');
                if (bubble) {
                    bubble.innerHTML = renderMarkdown(streamContent) + '<span class="cursor">▌</span>';
                    messages.scrollTop = messages.scrollHeight;
                }
            }
        }
        
        function completeStreamingMsg(content) {
            if (streamingMsg) {
                streamingMsg.classList.remove('streaming');
                const bubble = streamingMsg.querySelector('.bubble');
                if (bubble) {
                    bubble.innerHTML = renderMarkdown(content || streamContent);
                }
            }
            streamingMsg = null;
            streamContent = '';
        }
        
        function showError(error) {
            if (streamingMsg) {
                streamingMsg.remove();
                streamingMsg = null;
            }
            addMsg('error', error);
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
        
        function renderSessionList() {
            sessionList.innerHTML = '';
            sessions.forEach(s => {
                const item = document.createElement('div');
                item.className = 'session-item' + (s.id === currentSessionId ? ' active' : '');
                
                const date = new Date(s.updatedAt);
                const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString().slice(0,5);
                
                item.innerHTML = 
                    '<div class="session-info">' +
                        '<div class="session-title">' + esc(s.title) + '</div>' +
                        '<div class="session-meta">' + s.messageCount + ' 条消息 · ' + timeStr + '</div>' +
                    '</div>' +
                    '<button class="session-delete" data-id="' + s.id + '" title="删除">×</button>';
                
                item.querySelector('.session-info').onclick = () => {
                    currentSessionId = s.id;
                    vscode.postMessage({ command: 'switchSession', sessionId: s.id });
                    sessionList.classList.add('hidden');
                };
                
                item.querySelector('.session-delete').onclick = (e) => {
                    e.stopPropagation();
                    vscode.postMessage({ command: 'deleteSession', sessionId: s.id });
                };
                
                sessionList.appendChild(item);
            });
        }
        
        function loadSession(session) {
            messages.innerHTML = '';
            if (session && session.messages && session.messages.length > 0) {
                session.messages.forEach(m => {
                    addMsg(m.role, m.content);
                });
            } else {
                messages.innerHTML = '<div class="welcome"><h2>AutoTest AI 助手</h2><p>输入问题开始对话</p></div>';
            }
        }
        
        sendBtn.onclick = send;
        input.onkeypress = e => { if (e.key === 'Enter') send(); };
        
        newBtn.onclick = () => {
            vscode.postMessage({ command: 'newSession' });
            sessionList.classList.add('hidden');
        };
        
        toggleSessions.onclick = () => {
            sessionList.classList.toggle('hidden');
        };
        
        window.onmessage = e => {
            const m = e.data;
            if (m.command === 'streamChunk') {
                updateStreamingMsg(m.data);
            } else if (m.command === 'streamComplete') {
                completeStreamingMsg(m.data);
                sendBtn.disabled = false;
            } else if (m.command === 'streamError') {
                showError(m.error);
                sendBtn.disabled = false;
            } else if (m.command === 'sessions') {
                sessions = m.data;
                renderSessionList();
            } else if (m.command === 'currentSession') {
                currentSessionId = m.data ? m.data.id : null;
                loadSession(m.data);
                renderSessionList();
            }
        };
    </script>
</body>
</html>`;
    }
}

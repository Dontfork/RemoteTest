import * as vscode from 'vscode';
import { marked } from 'marked';
import { AIChat } from '../ai';
import { SessionManager } from '../ai/sessionManager';
import { ChatSession, AIModelConfig } from '../types';
import { onConfigChanged } from '../config';

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

    private async handleSendMessage(userMessage: string): Promise<void> {
        try {
            let fullContent = '';
            
            const response = await this.aiChat.sendMessageStream(userMessage, async (chunk) => {
                fullContent += chunk;
                const htmlContent = await marked(fullContent);
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
                const htmlContent = await marked(markdownContent);
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #cccccc; height: 100vh; display: flex; flex-direction: column; }
        .toolbar { padding: 4px 12px; border-bottom: 1px solid #3c3c3c; display: flex; gap: 8px; align-items: center; position: relative; justify-content: space-between; }
        .toolbar-left { display: flex; align-items: center; gap: 8px; }
        .toolbar-right { display: flex; align-items: center; gap: 8px; }
        .toolbar button { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: transparent; color: #858585; border: none; cursor: pointer; transition: all 0.2s; }
        .toolbar button:hover { color: #cccccc; }
        .toolbar button svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.5; fill: none; }
        .model-select { background: transparent; color: #858585; border: none; border-bottom: 1px solid #3c3c3c; padding: 2px 0; font-size: 12px; cursor: pointer; min-width: 80px; appearance: none; -webkit-appearance: none; }
        .model-select:hover { color: #cccccc; border-bottom-color: #858585; }
        .model-select:focus { outline: none; border-bottom-color: #858585; }
        .model-select option { background: #1e1e1e; color: #cccccc; padding: 4px 8px; }
        .model-select option:checked, .model-select option:hover { background: #2d2d2d; color: #cccccc; }
        .messages { flex: 1; overflow-y: auto; padding: 16px; }
        .msg { margin-bottom: 16px; display: flex; }
        .msg.user { justify-content: flex-end; }
        .bubble { padding: 10px 14px; border-radius: 4px; max-width: 85%; line-height: 1.6; }
        .user .bubble { background: transparent; border: 1px solid #3c3c3c; }
        .assistant .bubble { background: transparent; border: 1px solid #3c3c3c; }
        .error .bubble { background: transparent; border: 1px solid #5a1d1d; color: #f48771; }
        .bubble pre { background: #1e1e1e; padding: 12px 16px; border-radius: 8px; overflow-x: auto; margin: 10px 0; }
        .bubble code { background: #1e1e1e; padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', 'Monaco', monospace; font-size: 0.9em; }
        .bubble pre code { background: none; padding: 0; }
        .bubble h1, .bubble h2, .bubble h3 { margin: 14px 0 10px 0; color: #e0e0e0; }
        .bubble h1 { font-size: 1.3em; }
        .bubble h2 { font-size: 1.15em; }
        .bubble h3 { font-size: 1em; }
        .bubble ul, .bubble ol { margin: 10px 0; padding-left: 20px; }
        .bubble li { margin: 4px 0; }
        .bubble blockquote { border-left: 3px solid #0e639c; padding-left: 12px; margin: 10px 0; color: #a0a0a0; }
        .bubble a { color: #3794ff; }
        .bubble strong { color: #ffffff; }
        .bubble em { color: #d0d0d0; }
        .input-area { padding: 10px 12px; border-top: 1px solid #3c3c3c; background: transparent; overflow: hidden; }
        .input-wrap { display: flex; gap: 8px; align-items: flex-end; overflow: hidden; }
        textarea { flex: 1; padding: 4px 0 3px 0; background: transparent; color: #cccccc; border: none; border-bottom: 1px solid #3c3c3c; resize: none; font-family: inherit; font-size: 14px; line-height: 18px; height: 25px; -webkit-appearance: none; appearance: none; overflow: hidden; }
        textarea::-webkit-resizer { display: none; }
        textarea::-webkit-scrollbar { display: none; }
        textarea::resizer { display: none; }
        textarea:focus { outline: none; border-bottom-color: #858585; }
        button#sendBtn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: transparent; color: #858585; border: none; cursor: pointer; transition: all 0.2s; flex-shrink: 0; margin-bottom: -6px; }
        button#sendBtn:hover { color: #cccccc; }
        button#sendBtn:disabled { color: #3c3c3c; cursor: not-allowed; }
        button#sendBtn svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 1.5; fill: none; }
        .welcome { text-align: center; padding: 60px 20px; color: #858585; }
        .welcome-icon { width: 48px; height: 48px; margin: 0 auto 16px; stroke: #858585; stroke-width: 1; fill: none; }
        .welcome h2 { color: #cccccc; margin-bottom: 8px; font-weight: 400; }
        .history-panel { display: none; position: absolute; top: 100%; left: 12px; right: 12px; background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 4px; max-height: 300px; overflow-y: auto; z-index: 100; }
        .history-panel.show { display: block; }
        .history-item { padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #3c3c3c; display: flex; justify-content: space-between; align-items: center; }
        .history-item:last-child { border-bottom: none; }
        .history-item:hover { background: #2d2d2d; }
        .history-item.active { background: #2d2d2d; }
        .history-item .title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .history-item .meta { font-size: 0.8em; color: #858585; margin-left: 8px; }
        .history-item .delete-btn { background: none; border: none; color: #858585; cursor: pointer; padding: 4px; margin-left: 8px; display: flex; align-items: center; }
        .history-item .delete-btn:hover { color: #f48771; }
        .history-item .delete-btn svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.5; fill: none; }
        .no-history { padding: 24px; text-align: center; color: #858585; }
    </style>
</head>
<body>
    <div class="toolbar">
        <div class="toolbar-left">
            <select id="modelSelect" class="model-select" title="选择模型">
                <option value="">加载中...</option>
            </select>
        </div>
        <div class="toolbar-right">
            <button id="newBtn" title="新对话">
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button id="historyBtn" title="历史">
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
    <div class="input-area">
        <div class="input-wrap">
            <textarea id="input" placeholder="输入消息..." rows="2"></textarea>
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
        const modelSelect = document.getElementById('modelSelect');
        let sessions = [];
        let currentSessionId = null;
        let availableModels = [];
        let currentModel = null;
        
        function escapeHtml(text) {
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        
        function renderModels() {
            if (!availableModels || availableModels.length === 0) {
                modelSelect.innerHTML = '<option value="">无可用模型</option>';
                return;
            }
            modelSelect.innerHTML = availableModels.map(m => 
                '<option value="' + escapeHtml(m.name) + '"' + (m.name === currentModel ? ' selected' : '') + '>' + escapeHtml(m.name) + '</option>'
            ).join('');
        }
        
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
        
        function renderMessages(msgs) {
            messages.innerHTML = '';
            if (!msgs || msgs.length === 0) {
                messages.innerHTML = '<div class="welcome"><h2>AutoTest AI 助手</h2><p>输入问题开始对话</p></div>';
                return;
            }
            msgs.forEach(m => {
                addMessage(m.role, m.role === 'user' ? escapeHtml(m.content) : m.content);
            });
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
        
        function send() {
            const text = input.value.trim();
            if (!text) return;
            addMessage('user', escapeHtml(text));
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
            historyPanel.classList.remove('show');
            vscode.postMessage({ command: 'newSession' });
        };
        
        historyBtn.onclick = function() {
            historyPanel.classList.toggle('show');
        };
        
        modelSelect.onchange = function() {
            const selectedModel = modelSelect.value;
            if (selectedModel && selectedModel !== currentModel) {
                vscode.postMessage({ command: 'switchModel', modelName: selectedModel });
            }
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
            if (!historyBtn.contains(e.target) && !historyPanel.contains(e.target)) {
                historyPanel.classList.remove('show');
            }
        };
        
        window.onmessage = function(e) {
            const m = e.data;
            if (m.command === 'streamChunk') {
                const lastMsg = messages.lastChild;
                if (lastMsg && lastMsg.classList.contains('assistant')) {
                    const bubble = lastMsg.querySelector('.bubble');
                    if (bubble && m.data) {
                        bubble.innerHTML = m.data;
                        messages.scrollTop = messages.scrollHeight;
                    }
                }
            } else if (m.command === 'streamComplete') {
                sendBtn.disabled = false;
                const lastMsg = messages.lastChild;
                if (lastMsg && lastMsg.classList.contains('assistant')) {
                    const bubble = lastMsg.querySelector('.bubble');
                    if (bubble && m.data) {
                        bubble.innerHTML = m.data;
                    }
                }
            } else if (m.command === 'streamError') {
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
            }
        };
        
        vscode.postMessage({ command: 'getSessions' });
        vscode.postMessage({ command: 'getModels' });
    </script>
</body>
</html>`;
    }
}

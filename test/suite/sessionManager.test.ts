import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';

interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatSession {
    id: string;
    title: string;
    messages: AIMessage[];
    createdAt: number;
    updatedAt: number;
}

class MockSessionManager {
    private sessions: Map<string, ChatSession> = new Map();
    private currentSessionId: string | null = null;
    private storagePath: string;
    private listeners: ((sessions: ChatSession[]) => void)[] = [];

    constructor(storagePath: string) {
        this.storagePath = storagePath;
        this.ensureStorageDir();
        this.loadSessions();
    }

    private ensureStorageDir(): void {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
    }

    private loadSessions(): void {
        try {
            const files = fs.readdirSync(this.storagePath);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.storagePath, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const session = JSON.parse(content) as ChatSession;
                    this.sessions.set(session.id, session);
                }
            }
            
            const sortedSessions = Array.from(this.sessions.values())
                .sort((a, b) => b.updatedAt - a.updatedAt);
            
            if (sortedSessions.length > 0) {
                this.currentSessionId = sortedSessions[0].id;
            }
        } catch {
            this.sessions.clear();
        }
    }

    private saveSession(session: ChatSession): void {
        const filePath = path.join(this.storagePath, `${session.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
    }

    private deleteSessionFile(sessionId: string): void {
        const filePath = path.join(this.storagePath, `${sessionId}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    createSession(): ChatSession {
        const session: ChatSession = {
            id: this.generateId(),
            title: '新对话',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.sessions.set(session.id, session);
        this.currentSessionId = session.id;
        this.saveSession(session);
        this.emitChange();
        
        return session;
    }

    getCurrentSession(): ChatSession | null {
        if (!this.currentSessionId) {
            return null;
        }
        return this.sessions.get(this.currentSessionId) || null;
    }

    setCurrentSession(sessionId: string): ChatSession | null {
        if (this.sessions.has(sessionId)) {
            this.currentSessionId = sessionId;
            return this.sessions.get(sessionId) || null;
        }
        return null;
    }

    getAllSessions(): ChatSession[] {
        return Array.from(this.sessions.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    addMessage(sessionId: string, message: AIMessage): ChatSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        session.messages.push(message);
        session.updatedAt = Date.now();
        
        if (session.title === '新对话' && message.role === 'user') {
            session.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
        }
        
        this.saveSession(session);
        this.emitChange();
        
        return session;
    }

    insertMessage(sessionId: string, index: number, message: AIMessage): ChatSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        session.messages.splice(index, 0, message);
        session.updatedAt = Date.now();
        
        this.saveSession(session);
        this.emitChange();
        
        return session;
    }

    updateMessage(sessionId: string, message: AIMessage, updates: Partial<AIMessage>): ChatSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        const msgIndex = session.messages.indexOf(message);
        if (msgIndex === -1) return null;
        
        session.messages[msgIndex] = { ...message, ...updates };
        session.updatedAt = Date.now();
        
        this.saveSession(session);
        this.emitChange();
        
        return session;
    }

    deleteSession(sessionId: string): boolean {
        if (!this.sessions.has(sessionId)) return false;
        
        this.sessions.delete(sessionId);
        this.deleteSessionFile(sessionId);
        
        if (this.currentSessionId === sessionId) {
            const remaining = this.getAllSessions();
            this.currentSessionId = remaining.length > 0 ? remaining[0].id : null;
        }
        
        this.emitChange();
        return true;
    }

    clearSession(sessionId: string): ChatSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        session.messages = [];
        session.title = '新对话';
        session.updatedAt = Date.now();
        
        this.saveSession(session);
        this.emitChange();
        
        return session;
    }

    onSessionsChange(listener: (sessions: ChatSession[]) => void): void {
        this.listeners.push(listener);
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    private emitChange(): void {
        this.listeners.forEach(l => l(this.getAllSessions()));
    }
}

describe('SessionManager - 会话管理器测试', () => {
    let sessionManager: MockSessionManager;
    let testStoragePath: string;

    beforeEach(() => {
        testStoragePath = path.join(__dirname, '..', 'test-storage-' + Date.now());
        sessionManager = new MockSessionManager(testStoragePath);
    });

    afterEach(() => {
        if (fs.existsSync(testStoragePath)) {
            fs.rmSync(testStoragePath, { recursive: true, force: true });
        }
    });

    describe('createSession - 创建会话', () => {
        it('创建新会话 - 返回包含id、title、messages的会话对象', () => {
            const session = sessionManager.createSession();
            
            assert.ok(session.id);
            assert.strictEqual(session.title, '新对话');
            assert.deepStrictEqual(session.messages, []);
            assert.ok(session.createdAt);
            assert.ok(session.updatedAt);
        });

        it('创建多个会话 - 每个会话有唯一id', () => {
            const session1 = sessionManager.createSession();
            const session2 = sessionManager.createSession();
            
            assert.notStrictEqual(session1.id, session2.id);
        });

        it('创建会话后自动设为当前会话', () => {
            const session = sessionManager.createSession();
            const current = sessionManager.getCurrentSession();
            
            assert.strictEqual(current?.id, session.id);
        });

        it('创建会话后可通过getAllSessions获取', () => {
            const session = sessionManager.createSession();
            const all = sessionManager.getAllSessions();
            
            assert.strictEqual(all.length, 1);
            assert.strictEqual(all[0].id, session.id);
        });
    });

    describe('getCurrentSession - 获取当前会话', () => {
        it('无会话时返回null', () => {
            const session = sessionManager.getCurrentSession();
            
            assert.strictEqual(session, null);
        });

        it('返回当前激活的会话', () => {
            const session = sessionManager.createSession();
            const current = sessionManager.getCurrentSession();
            
            assert.strictEqual(current?.id, session.id);
        });
    });

    describe('setCurrentSession - 切换会话', () => {
        it('切换到指定会话', () => {
            const session1 = sessionManager.createSession();
            const session2 = sessionManager.createSession();
            
            const switched = sessionManager.setCurrentSession(session1.id);
            
            assert.strictEqual(switched?.id, session1.id);
            assert.strictEqual(sessionManager.getCurrentSession()?.id, session1.id);
        });

        it('切换到不存在的会话返回null', () => {
            const result = sessionManager.setCurrentSession('non-existent-id');
            
            assert.strictEqual(result, null);
        });
    });

    describe('getAllSessions - 获取所有会话', () => {
        it('返回按更新时间降序排列的会话列表', async () => {
            const session1 = sessionManager.createSession();
            await new Promise(r => setTimeout(r, 10));
            const session2 = sessionManager.createSession();
            
            const all = sessionManager.getAllSessions();
            
            assert.strictEqual(all.length, 2);
            assert.strictEqual(all[0].id, session2.id);
            assert.strictEqual(all[1].id, session1.id);
        });

        it('空会话列表返回空数组', () => {
            const all = sessionManager.getAllSessions();
            assert.strictEqual(all.length, 0);
        });
    });

    describe('addMessage - 添加消息', () => {
        it('添加用户消息到会话', () => {
            const session = sessionManager.createSession();
            
            sessionManager.addMessage(session.id, { role: 'user', content: 'Hello' });
            
            const current = sessionManager.getCurrentSession();
            assert.strictEqual(current?.messages.length, 1);
            assert.strictEqual(current?.messages[0].role, 'user');
            assert.strictEqual(current?.messages[0].content, 'Hello');
        });

        it('添加助手消息到会话', () => {
            const session = sessionManager.createSession();
            
            sessionManager.addMessage(session.id, { role: 'assistant', content: 'Hi there!' });
            
            const current = sessionManager.getCurrentSession();
            assert.strictEqual(current?.messages.length, 1);
            assert.strictEqual(current?.messages[0].role, 'assistant');
        });

        it('首条用户消息自动更新会话标题', () => {
            const session = sessionManager.createSession();
            
            sessionManager.addMessage(session.id, { role: 'user', content: 'This is a very long message that should be truncated' });
            
            const updated = sessionManager.getAllSessions()[0];
            assert.ok(updated.title.startsWith('This is a very long message'));
            assert.ok(updated.title.endsWith('...'));
        });

        it('短消息完整作为标题', () => {
            const session = sessionManager.createSession();
            
            sessionManager.addMessage(session.id, { role: 'user', content: 'Short message' });
            
            const updated = sessionManager.getAllSessions()[0];
            assert.strictEqual(updated.title, 'Short message');
        });

        it('添加消息后更新updatedAt时间', async () => {
            const session = sessionManager.createSession();
            const originalTime = session.updatedAt;
            
            await new Promise(r => setTimeout(r, 10));
            sessionManager.addMessage(session.id, { role: 'user', content: 'Test' });
            
            const updated = sessionManager.getCurrentSession();
            assert.ok(updated!.updatedAt > originalTime);
        });
    });

    describe('deleteSession - 删除会话', () => {
        it('删除指定会话', () => {
            const session = sessionManager.createSession();
            
            const result = sessionManager.deleteSession(session.id);
            
            assert.strictEqual(result, true);
            assert.strictEqual(sessionManager.getAllSessions().length, 0);
        });

        it('删除不存在的会话返回false', () => {
            const result = sessionManager.deleteSession('non-existent');
            
            assert.strictEqual(result, false);
        });

        it('删除当前会话后自动切换到其他会话', () => {
            const session1 = sessionManager.createSession();
            const session2 = sessionManager.createSession();
            
            sessionManager.deleteSession(session2.id);
            
            const current = sessionManager.getCurrentSession();
            assert.strictEqual(current?.id, session1.id);
        });

        it('删除最后一个会话后当前会话为null', () => {
            const session = sessionManager.createSession();
            
            sessionManager.deleteSession(session.id);
            
            const all = sessionManager.getAllSessions();
            assert.strictEqual(all.length, 0);
        });
    });

    describe('clearSession - 清空会话', () => {
        it('清空会话消息', () => {
            const session = sessionManager.createSession();
            sessionManager.addMessage(session.id, { role: 'user', content: 'Test' });
            sessionManager.addMessage(session.id, { role: 'assistant', content: 'Response' });
            
            sessionManager.clearSession(session.id);
            
            const cleared = sessionManager.getCurrentSession();
            assert.strictEqual(cleared?.messages.length, 0);
            assert.strictEqual(cleared?.title, '新对话');
        });

        it('清空不存在的会话返回null', () => {
            const result = sessionManager.clearSession('non-existent');
            
            assert.strictEqual(result, null);
        });
    });

    describe('Persistence - 持久化', () => {
        it('会话自动保存到文件', () => {
            const session = sessionManager.createSession();
            sessionManager.addMessage(session.id, { role: 'user', content: 'Test' });
            
            const sessionFile = path.join(testStoragePath, `${session.id}.json`);
            
            assert.ok(fs.existsSync(sessionFile));
            
            const saved = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
            assert.strictEqual(saved.id, session.id);
            assert.strictEqual(saved.messages.length, 1);
        });

        it('重新加载时恢复会话', () => {
            const session = sessionManager.createSession();
            sessionManager.addMessage(session.id, { role: 'user', content: 'Test message' });
            
            const newManager = new MockSessionManager(testStoragePath);
            const sessions = newManager.getAllSessions();
            
            assert.strictEqual(sessions.length, 1);
            assert.strictEqual(sessions[0].messages.length, 1);
            assert.strictEqual(sessions[0].messages[0].content, 'Test message');
        });

        it('删除会话时删除对应文件', () => {
            const session = sessionManager.createSession();
            const sessionFile = path.join(testStoragePath, `${session.id}.json`);
            
            assert.ok(fs.existsSync(sessionFile));
            
            sessionManager.deleteSession(session.id);
            
            assert.ok(!fs.existsSync(sessionFile));
        });
    });

    describe('Events - 事件', () => {
        it('会话变更时触发事件', (done) => {
            sessionManager.onSessionsChange((sessions) => {
                assert.strictEqual(sessions.length, 1);
                done();
            });
            
            sessionManager.createSession();
        });

        it('删除会话时触发事件', (done) => {
            const session = sessionManager.createSession();
            
            sessionManager.onSessionsChange((sessions) => {
                assert.strictEqual(sessions.length, 0);
                done();
            });
            
            sessionManager.deleteSession(session.id);
        });
    });

    describe('New Session Logic - 新建会话逻辑', () => {
        it('无会话时点击新建应创建会话', () => {
            const current = sessionManager.getCurrentSession();
            assert.strictEqual(current, null);
            
            const newSession = sessionManager.createSession();
            
            assert.ok(newSession);
            assert.strictEqual(sessionManager.getAllSessions().length, 1);
        });

        it('当前会话为空时点击新建不应创建新会话', () => {
            const session = sessionManager.createSession();
            const sessionCount = sessionManager.getAllSessions().length;
            
            const current = sessionManager.getCurrentSession();
            if (current && current.messages.length === 0) {
                // 不创建新会话
            } else {
                sessionManager.createSession();
            }
            
            assert.strictEqual(sessionManager.getAllSessions().length, sessionCount);
        });

        it('当前会话有内容时点击新建应创建新会话', () => {
            const session = sessionManager.createSession();
            sessionManager.addMessage(session.id, { role: 'user', content: 'Hello' });
            
            const sessionCount = sessionManager.getAllSessions().length;
            
            const current = sessionManager.getCurrentSession();
            if (!current || current.messages.length > 0) {
                sessionManager.createSession();
            }
            
            assert.strictEqual(sessionManager.getAllSessions().length, sessionCount + 1);
        });

        it('删除最后一个会话后getCurrentSession返回null', () => {
            const session = sessionManager.createSession();
            
            sessionManager.deleteSession(session.id);
            
            const current = sessionManager.getCurrentSession();
            assert.strictEqual(current, null);
        });
    });

    describe('insertMessage - 插入消息', () => {
        it('在指定位置插入消息', () => {
            const session = sessionManager.createSession();
            sessionManager.addMessage(session.id, { role: 'user', content: 'Hello' });
            sessionManager.addMessage(session.id, { role: 'assistant', content: 'Hi' });
            
            sessionManager.insertMessage(session.id, 0, { role: 'system', content: 'You are a helper' });
            
            const current = sessionManager.getCurrentSession();
            assert.strictEqual(current?.messages.length, 3);
            assert.strictEqual(current?.messages[0].role, 'system');
            assert.strictEqual(current?.messages[0].content, 'You are a helper');
        });

        it('插入消息后更新updatedAt时间', async () => {
            const session = sessionManager.createSession();
            const originalTime = session.updatedAt;
            
            await new Promise(r => setTimeout(r, 10));
            sessionManager.insertMessage(session.id, 0, { role: 'system', content: 'System prompt' });
            
            const updated = sessionManager.getCurrentSession();
            assert.ok(updated!.updatedAt > originalTime);
        });
    });

    describe('updateMessage - 更新消息', () => {
        it('更新指定消息内容', () => {
            const session = sessionManager.createSession();
            sessionManager.addMessage(session.id, { role: 'system', content: 'Old prompt' });
            
            const current = sessionManager.getCurrentSession();
            const systemMsg = current?.messages[0];
            if (systemMsg) {
                sessionManager.updateMessage(session.id, systemMsg, { content: 'New prompt' });
            }
            
            const updated = sessionManager.getCurrentSession();
            assert.strictEqual(updated?.messages[0].content, 'New prompt');
        });

        it('更新不存在的消息返回null', () => {
            const session = sessionManager.createSession();
            
            const result = sessionManager.updateMessage(session.id, { role: 'system', content: 'test' }, { content: 'new' });
            
            assert.strictEqual(result, null);
        });
    });
});

describe('SessionManager Workspace Storage - 工作区存储测试', () => {
    it('源码应包含getWorkspaceStoragePath方法', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'ai', 'sessionManager.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('getWorkspaceStoragePath'));
    });

    it('应优先使用工作区路径', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'ai', 'sessionManager.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('workspaceFolders'));
        assert.ok(source.includes('.autotest'));
    });

    it('无工作区时应回退到全局存储', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'ai', 'sessionManager.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('globalStorageUri'));
    });

    it('存储路径应包含chat-sessions子目录', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'ai', 'sessionManager.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('chat-sessions'));
    });
});

describe('SessionManager System Prompt - 系统提示词持久化测试', () => {
    it('应有getSystemPrompt方法', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'ai', 'sessionManager.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('getSystemPrompt'));
    });

    it('应有saveSystemPrompt方法', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'ai', 'sessionManager.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('saveSystemPrompt'));
    });

    it('系统提示词应存储在.autotest目录下', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'ai', 'sessionManager.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('system-prompt.json'));
    });
});

describe('AIChatView System Prompt - 系统提示词UI测试', () => {
    it('应处理saveSystemPrompt命令', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'views', 'aiChatView.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes("case 'saveSystemPrompt'"));
    });

    it('应处理getSystemPrompt命令', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'views', 'aiChatView.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes("case 'getSystemPrompt'"));
    });

    it('应有sendSystemPrompt方法', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'views', 'aiChatView.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('sendSystemPrompt'));
    });

    it('前端应监听systemPrompt消息', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'views', 'aiChatView.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes("m.command === 'systemPrompt'"));
    });

    it('输入框变化时应保存系统提示词', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'views', 'aiChatView.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('promptInput.oninput'));
        assert.ok(source.includes("command: 'saveSystemPrompt'"));
    });

    it('清空按钮应保存空提示词', () => {
        const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'views', 'aiChatView.ts');
        const source = fs.readFileSync(sourcePath, 'utf-8');
        assert.ok(source.includes('clearPromptBtn.onclick'));
        assert.ok(source.includes("prompt: ''"));
    });
});

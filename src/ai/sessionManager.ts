import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ChatSession, AIMessage } from '../types';

export class SessionManager {
    private sessions: Map<string, ChatSession> = new Map();
    private currentSessionId: string | null = null;
    private storagePath: string;
    private onSessionsChangeEmitter = new vscode.EventEmitter<ChatSession[]>();
    
    readonly onSessionsChange = this.onSessionsChangeEmitter.event;

    constructor(context: vscode.ExtensionContext) {
        this.storagePath = this.getWorkspaceStoragePath(context);
        this.ensureStorageDir();
        this.loadSessions();
    }

    private getWorkspaceStoragePath(context: vscode.ExtensionContext): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            return path.join(workspacePath, '.autotest', 'chat-sessions');
        }
        return path.join(context.globalStorageUri.fsPath, 'chat-sessions');
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

    updateSession(sessionId: string, updates: Partial<ChatSession>): ChatSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        Object.assign(session, updates, { updatedAt: Date.now() });
        this.saveSession(session);
        this.emitChange();
        
        return session;
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

    getSystemPrompt(): string {
        try {
            const filePath = path.join(this.storagePath, '..', 'system-prompt.json');
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                return data.prompt || '';
            }
        } catch {
            // ignore
        }
        return '';
    }

    saveSystemPrompt(prompt: string): void {
        try {
            const filePath = path.join(this.storagePath, '..', 'system-prompt.json');
            fs.writeFileSync(filePath, JSON.stringify({ prompt }, null, 2), 'utf-8');
        } catch {
            // ignore
        }
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    private emitChange(): void {
        this.onSessionsChangeEmitter.fire(this.getAllSessions());
    }

    dispose(): void {
        this.onSessionsChangeEmitter.dispose();
    }
}

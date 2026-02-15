import { getConfig } from '../config';
import { AIMessage, AIResponse, ChatSession } from '../types';
import { QWenProvider, OpenAIProvider, AIProvider } from './providers';
import { SessionManager } from './sessionManager';

export class AIChat {
    private provider: AIProvider;
    private sessionManager: SessionManager;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        this.provider = this.createProvider();
    }

    private createProvider(): AIProvider {
        const config = getConfig();
        const aiConfig = config.ai;

        if (aiConfig.provider === 'qwen') {
            return new QWenProvider(aiConfig.qwen);
        } else {
            return new OpenAIProvider(aiConfig.openai);
        }
    }

    setProvider(provider: 'qwen' | 'openai'): void {
        this.provider = this.createProvider();
    }

    getCurrentSession(): ChatSession | null {
        return this.sessionManager.getCurrentSession();
    }

    setCurrentSession(sessionId: string): ChatSession | null {
        return this.sessionManager.setCurrentSession(sessionId);
    }

    getAllSessions(): ChatSession[] {
        return this.sessionManager.getAllSessions();
    }

    createNewSession(): ChatSession {
        return this.sessionManager.createSession();
    }

    deleteSession(sessionId: string): boolean {
        return this.sessionManager.deleteSession(sessionId);
    }

    clearCurrentSession(): ChatSession | null {
        const session = this.getCurrentSession();
        if (session) {
            return this.sessionManager.clearSession(session.id);
        }
        return null;
    }

    async sendMessage(userMessage: string): Promise<AIResponse> {
        const config = getConfig();
        
        if (!config.ai) {
            return { content: '', error: '请先配置 AI 服务' };
        }

        if (config.ai.provider === 'qwen' && !config.ai.qwen?.apiKey) {
            return { content: '', error: '请配置 QWen API Key' };
        }

        if (config.ai.provider === 'openai' && !config.ai.openai?.apiKey) {
            return { content: '', error: '请配置 OpenAI API Key' };
        }

        let session = this.getCurrentSession();
        if (!session) {
            session = this.createNewSession();
        }

        this.sessionManager.addMessage(session.id, { role: 'user', content: userMessage });

        const response = await this.provider.send(session.messages);

        if (response.content && !response.error) {
            this.sessionManager.addMessage(session.id, { role: 'assistant', content: response.content });
        }

        return response;
    }

    async sendMessageStream(
        userMessage: string, 
        onChunk: (chunk: string) => void
    ): Promise<AIResponse> {
        const config = getConfig();
        
        if (!config.ai) {
            return { content: '', error: '请先配置 AI 服务' };
        }

        if (config.ai.provider === 'qwen' && !config.ai.qwen?.apiKey) {
            return { content: '', error: '请配置 QWen API Key' };
        }

        if (config.ai.provider === 'openai' && !config.ai.openai?.apiKey) {
            return { content: '', error: '请配置 OpenAI API Key' };
        }

        let session = this.getCurrentSession();
        if (!session) {
            session = this.createNewSession();
        }

        this.sessionManager.addMessage(session.id, { role: 'user', content: userMessage });

        const response = await this.provider.sendStream(session.messages, onChunk);

        if (response.content && !response.error) {
            this.sessionManager.addMessage(session.id, { role: 'assistant', content: response.content });
        }

        return response;
    }
}

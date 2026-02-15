import { getConfig } from '../config';
import { AIMessage, AIResponse, ChatSession } from '../types';
import { QWenProvider, OpenAIProvider, AIProvider } from './providers';
import { SessionManager } from './sessionManager';
import { log, logError } from '../utils/logger';

export class AIChat {
    private provider: AIProvider;
    private sessionManager: SessionManager;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        this.provider = this.createProvider();
        log('[AIChat] 初始化完成');
    }

    private createProvider(): AIProvider {
        const config = getConfig();
        const aiConfig = config.ai;

        log(`[AIChat] 创建 Provider, provider: ${aiConfig.provider}`);
        
        if (aiConfig.provider === 'qwen') {
            log(`[AIChat] QWen API Key 长度: ${aiConfig.qwen?.apiKey?.length || 0}`);
            return new QWenProvider(aiConfig.qwen);
        } else {
            log(`[AIChat] OpenAI API Key 长度: ${aiConfig.openai?.apiKey?.length || 0}`);
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
        
        log(`[AIChat] sendMessage 开始, 消息长度: ${userMessage.length}`);
        
        if (!config.ai) {
            logError('[AIChat] AI 配置不存在');
            return { content: '', error: '请先配置 AI 服务' };
        }

        if (config.ai.provider === 'qwen' && !config.ai.qwen?.apiKey) {
            logError('[AIChat] QWen API Key 未配置');
            return { content: '', error: '请配置 QWen API Key' };
        }

        if (config.ai.provider === 'openai' && !config.ai.openai?.apiKey) {
            logError('[AIChat] OpenAI API Key 未配置');
            return { content: '', error: '请配置 OpenAI API Key' };
        }

        let session = this.getCurrentSession();
        if (!session) {
            log('[AIChat] 创建新会话');
            session = this.createNewSession();
        }

        this.sessionManager.addMessage(session.id, { role: 'user', content: userMessage });
        log(`[AIChat] 当前会话消息数: ${session.messages.length + 1}`);

        const response = await this.provider.send(session.messages);

        if (response.content && !response.error) {
            this.sessionManager.addMessage(session.id, { role: 'assistant', content: response.content });
            log('[AIChat] 消息已保存到会话');
        }

        return response;
    }

    async sendMessageStream(
        userMessage: string, 
        onChunk: (chunk: string) => void
    ): Promise<AIResponse> {
        const config = getConfig();
        
        log(`[AIChat] sendMessageStream 开始, 消息长度: ${userMessage.length}`);
        
        if (!config.ai) {
            logError('[AIChat] AI 配置不存在');
            return { content: '', error: '请先配置 AI 服务' };
        }

        if (config.ai.provider === 'qwen' && !config.ai.qwen?.apiKey) {
            logError('[AIChat] QWen API Key 未配置');
            return { content: '', error: '请配置 QWen API Key' };
        }

        if (config.ai.provider === 'openai' && !config.ai.openai?.apiKey) {
            logError('[AIChat] OpenAI API Key 未配置');
            return { content: '', error: '请配置 OpenAI API Key' };
        }

        let session = this.getCurrentSession();
        if (!session) {
            log('[AIChat] 创建新会话');
            session = this.createNewSession();
        }

        this.sessionManager.addMessage(session.id, { role: 'user', content: userMessage });
        log(`[AIChat] 当前会话消息数: ${session.messages.length + 1}`);

        log('[AIChat] 调用 provider.sendStream');
        const response = await this.provider.sendStream(session.messages, onChunk);
        log(`[AIChat] sendStream 返回, 内容长度: ${response.content?.length || 0}, 错误: ${response.error || '无'}`);

        if (response.content && !response.error) {
            this.sessionManager.addMessage(session.id, { role: 'assistant', content: response.content });
            log('[AIChat] 消息已保存到会话');
        }

        return response;
    }
}

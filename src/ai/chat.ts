import { getConfig } from '../config';
import { AIMessage, AIResponse, ChatSession, AIModelConfig } from '../types';
import { createProvider, AIProvider } from './providers';
import { SessionManager } from './sessionManager';

export class AIChat {
    private provider: AIProvider | null = null;
    private sessionManager: SessionManager;
    private currentModelName: string | null = null;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        this.initProvider();
    }

    private initProvider(): void {
        const config = getConfig();
        const aiConfig = config.ai;
        
        if (!aiConfig || !aiConfig.models || aiConfig.models.length === 0) {
            this.provider = null;
            this.currentModelName = null;
            return;
        }

        const modelName = aiConfig.defaultModel || aiConfig.models[0].name;
        this.setModel(modelName);
    }

    setModel(modelName: string): boolean {
        const config = getConfig();
        const aiConfig = config.ai;
        
        if (!aiConfig || !aiConfig.models) {
            return false;
        }

        const modelConfig = aiConfig.models.find(m => m.name === modelName);
        if (!modelConfig) {
            return false;
        }

        this.provider = createProvider(modelConfig, aiConfig.proxy);
        this.currentModelName = modelName;
        return true;
    }

    getCurrentModel(): string | null {
        return this.currentModelName;
    }

    getAvailableModels(): AIModelConfig[] {
        const config = getConfig();
        return config.ai?.models || [];
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
        
        if (!config.ai || !config.ai.models || config.ai.models.length === 0) {
            return { content: '', error: '请先配置 AI 模型' };
        }

        if (!this.provider) {
            this.initProvider();
            if (!this.provider) {
                return { content: '', error: 'AI 提供者初始化失败' };
            }
        }

        const modelConfig = config.ai.models.find(m => m.name === this.currentModelName);
        if (!modelConfig || !modelConfig.apiKey) {
            return { content: '', error: `请配置模型 "${this.currentModelName}" 的 API Key` };
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
        systemPrompt?: string,
        onChunk?: (chunk: string) => void
    ): Promise<AIResponse> {
        const config = getConfig();
        
        if (!config.ai || !config.ai.models || config.ai.models.length === 0) {
            return { content: '', error: '请先配置 AI 模型' };
        }

        if (!this.provider) {
            this.initProvider();
            if (!this.provider) {
                return { content: '', error: 'AI 提供者初始化失败' };
            }
        }

        const modelConfig = config.ai.models.find(m => m.name === this.currentModelName);
        if (!modelConfig || !modelConfig.apiKey) {
            return { content: '', error: `请配置模型 "${this.currentModelName}" 的 API Key` };
        }

        let session = this.getCurrentSession();
        if (!session) {
            session = this.createNewSession();
        }

        if (systemPrompt && systemPrompt.trim()) {
            const existingSystemMsg = session.messages.find(m => m.role === 'system');
            if (existingSystemMsg) {
                this.sessionManager.updateMessage(session.id, existingSystemMsg, { content: systemPrompt });
            } else {
                this.sessionManager.insertMessage(session.id, 0, { role: 'system', content: systemPrompt });
            }
        }

        this.sessionManager.addMessage(session.id, { role: 'user', content: userMessage });

        const response = await this.provider.sendStream(session.messages, onChunk || (() => {}));

        if (response.content && !response.error) {
            this.sessionManager.addMessage(session.id, { role: 'assistant', content: response.content });
        }

        return response;
    }
}

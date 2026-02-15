import { getConfig } from '../config';
import { AIMessage, AIResponse } from '../types';
import { QWenProvider, OpenAIProvider, AIProvider } from './providers';

export class AIChat {
    private messages: AIMessage[] = [];
    private provider: AIProvider;

    constructor() {
        const config = getConfig();
        const aiConfig = config.ai;

        if (aiConfig.provider === 'qwen') {
            this.provider = new QWenProvider(aiConfig.qwen);
        } else {
            this.provider = new OpenAIProvider(aiConfig.openai);
        }
    }

    setProvider(provider: 'qwen' | 'openai'): void {
        const config = getConfig();
        const aiConfig = config.ai;

        if (provider === 'qwen') {
            this.provider = new QWenProvider(aiConfig.qwen);
        } else {
            this.provider = new OpenAIProvider(aiConfig.openai);
        }
    }

    addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
        this.messages.push({ role, content });
    }

    clearMessages(): void {
        this.messages = [];
    }

    getMessages(): AIMessage[] {
        return [...this.messages];
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

        this.addMessage('user', userMessage);

        const response = await this.provider.send(this.messages);

        if (response.content && !response.error) {
            this.addMessage('assistant', response.content);
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

        this.addMessage('user', userMessage);

        const response = await this.provider.sendStream(this.messages, onChunk);

        if (response.content && !response.error) {
            this.addMessage('assistant', response.content);
        }

        return response;
    }
}

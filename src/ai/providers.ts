import axios from 'axios';
import { getConfig } from '../config';
import { AIMessage, AIResponse, QWenConfig, OpenAIConfig } from '../types';

export interface AIProvider {
    send(messages: AIMessage[]): Promise<AIResponse>;
    sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse>;
}

export class QWenProvider implements AIProvider {
    private config: QWenConfig;

    constructor(config: QWenConfig) {
        this.config = config;
    }

    async send(messages: AIMessage[]): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        const model = this.config.model || 'qwen-turbo';

        try {
            const response = await axios.post(apiUrl, {
                model: model,
                input: { messages: messages.map(m => ({ role: m.role, content: m.content })) },
                parameters: { result_format: 'message' }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            const content = response.data?.output?.choices?.[0]?.message?.content || '';
            return { content: content || 'AI 未返回有效响应' };
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }

    async sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        const model = this.config.model || 'qwen-turbo';

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-DashScope-SSE': 'enable'
                },
                body: JSON.stringify({
                    model: model,
                    input: { messages: messages.map(m => ({ role: m.role, content: m.content })) },
                    parameters: { 
                        result_format: 'message',
                        incremental_output: true
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { message?: string };
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('无法获取响应流');
            }

            const decoder = new TextDecoder();
            let fullContent = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const data = line.slice(5).trim();
                        if (data === '[DONE]') continue;
                        
                        try {
                            const json = JSON.parse(data);
                            const content = json?.output?.choices?.[0]?.message?.content || '';
                            if (content && content.length > fullContent.length) {
                                const chunk = content.slice(fullContent.length);
                                fullContent = content;
                                onChunk(chunk);
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                }
            }

            return { content: fullContent || 'AI 未返回有效响应' };
        } catch (error: any) {
            const errorMsg = error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }
}

export class OpenAIProvider implements AIProvider {
    private config: OpenAIConfig;

    constructor(config: OpenAIConfig) {
        this.config = config;
    }

    async send(messages: AIMessage[]): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 'https://api.openai.com/v1/chat/completions';
        const model = this.config.model || 'gpt-3.5-turbo';

        try {
            const response = await axios.post(apiUrl, {
                model: model,
                messages: messages.map(m => ({ role: m.role, content: m.content }))
            }, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            const content = response.data?.choices?.[0]?.message?.content || '';
            return { content: content || 'AI 未返回有效响应' };
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }

    async sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 'https://api.openai.com/v1/chat/completions';
        const model = this.config.model || 'gpt-3.5-turbo';

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                    stream: true
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('无法获取响应流');
            }

            const decoder = new TextDecoder();
            let fullContent = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const data = line.slice(5).trim();
                        if (data === '[DONE]') continue;
                        
                        try {
                            const json = JSON.parse(data);
                            const delta = json?.choices?.[0]?.delta?.content || '';
                            if (delta) {
                                fullContent += delta;
                                onChunk(delta);
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                }
            }

            return { content: fullContent || 'AI 未返回有效响应' };
        } catch (error: any) {
            const errorMsg = error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }
}

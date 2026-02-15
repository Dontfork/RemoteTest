import axios from 'axios';
import { AIMessage, AIResponse, QWenConfig, OpenAIConfig } from '../types';
import { logAI } from '../utils/logger';

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

            const rawContent = response.data?.output?.choices?.[0]?.message?.content;
            const content = rawContent !== undefined && rawContent !== null ? String(rawContent) : '';
            if (content) {
                logAI(content);
            }
            return { content: content || 'AI 未返回有效响应' };
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }

    async sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse> {
        try {
            const streamResponse = await this.tryStream(messages, onChunk);
            return streamResponse;
        } catch (streamError: any) {
            const response = await this.send(messages);
            if (response.content && !response.error) {
                onChunk(response.content);
            }
            return response;
        }
    }

    private async tryStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        const model = this.config.model || 'qwen-turbo';

        const response = await axios({
            method: 'POST',
            url: apiUrl,
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'X-DashScope-SSE': 'enable'
            },
            data: {
                model: model,
                input: { messages: messages.map(m => ({ role: m.role, content: m.content })) },
                parameters: { 
                    result_format: 'message',
                    incremental_output: true
                }
            },
            responseType: 'stream',
            timeout: 120000
        });

        return new Promise((resolve, reject) => {
            let fullContent = '';
            let buffer = '';
            let hasData = false;

            response.data.on('data', (chunk: Buffer) => {
                hasData = true;
                const chunkStr = chunk.toString('utf-8');
                buffer += chunkStr;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        const data = line.slice(5).trim();
                        if (data === '[DONE]') continue;
                        
                        try {
                            const json = JSON.parse(data);
                            const content = json?.output?.choices?.[0]?.message?.content;
                            if (content !== undefined && content !== null) {
                                const contentStr = String(content);
                                if (contentStr.length > fullContent.length) {
                                    const chunkText = contentStr.slice(fullContent.length);
                                    fullContent = contentStr;
                                    onChunk(chunkText);
                                } else if (contentStr && !fullContent) {
                                    fullContent = contentStr;
                                    onChunk(contentStr);
                                }
                            }
                        } catch (parseErr) {
                            // 忽略解析错误
                        }
                    }
                }
            });

            response.data.on('end', () => {
                if (fullContent) {
                    logAI(fullContent);
                    resolve({ content: fullContent });
                } else if (!hasData) {
                    reject(new Error('流式响应无数据'));
                } else {
                    resolve({ content: fullContent || 'AI 未返回有效响应' });
                }
            });

            response.data.on('error', (err: Error) => {
                reject(err);
            });
        });
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
            if (content) {
                logAI(content);
            }
            return { content: content || 'AI 未返回有效响应' };
        } catch (error: any) {
            const errorMsg = error.response?.data?.error?.message || error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }

    async sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse> {
        try {
            const streamResponse = await this.tryStream(messages, onChunk);
            return streamResponse;
        } catch (streamError: any) {
            const response = await this.send(messages);
            if (response.content && !response.error) {
                onChunk(response.content);
            }
            return response;
        }
    }

    private async tryStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 'https://api.openai.com/v1/chat/completions';
        const model = this.config.model || 'gpt-3.5-turbo';

        const response = await axios({
            method: 'POST',
            url: apiUrl,
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            data: {
                model: model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                stream: true
            },
            responseType: 'stream',
            timeout: 120000
        });

        return new Promise((resolve, reject) => {
            let fullContent = '';
            let buffer = '';
            let hasData = false;

            response.data.on('data', (chunk: Buffer) => {
                hasData = true;
                buffer += chunk.toString('utf-8');
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
            });

            response.data.on('end', () => {
                if (fullContent) {
                    logAI(fullContent);
                    resolve({ content: fullContent });
                } else if (!hasData) {
                    reject(new Error('流式响应无数据'));
                } else {
                    resolve({ content: fullContent || 'AI 未返回有效响应' });
                }
            });

            response.data.on('error', (err: Error) => {
                reject(err);
            });
        });
    }
}

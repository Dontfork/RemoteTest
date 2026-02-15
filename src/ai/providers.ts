import axios from 'axios';
import { AIMessage, AIResponse, QWenConfig, OpenAIConfig } from '../types';
import { log, logError } from '../utils/logger';

export interface AIProvider {
    send(messages: AIMessage[]): Promise<AIResponse>;
    sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse>;
}

export class QWenProvider implements AIProvider {
    private config: QWenConfig;

    constructor(config: QWenConfig) {
        this.config = config;
        log(`[QWen] Provider 创建, model: ${config.model || 'qwen-turbo'}`);
    }

    async send(messages: AIMessage[]): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        const model = this.config.model || 'qwen-turbo';

        log(`[QWen] 发送请求到: ${apiUrl}`);
        log(`[QWen] 消息数量: ${messages.length}`);

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

            log(`[QWen] 响应状态: ${response.status}`);
            const content = response.data?.output?.choices?.[0]?.message?.content || '';
            log(`[QWen] 响应内容长度: ${content.length}`);
            return { content: content || 'AI 未返回有效响应' };
        } catch (error: any) {
            logError('[QWen] 请求失败', error.message);
            const errorMsg = error.response?.data?.message || error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }

    async sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse> {
        log('[QWen] sendStream 开始');
        try {
            const streamResponse = await this.tryStream(messages, onChunk);
            log(`[QWen] sendStream 成功, 内容长度: ${streamResponse.content?.length || 0}`);
            return streamResponse;
        } catch (streamError: any) {
            logError('[QWen] 流式请求失败，回退到非流式', streamError.message);
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

        log(`[QWen] 流式请求到: ${apiUrl}`);

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

        log('[QWen] 流式连接已建立');

        return new Promise((resolve, reject) => {
            let fullContent = '';
            let buffer = '';
            let hasData = false;
            let chunkCount = 0;

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
                            const content = json?.output?.choices?.[0]?.message?.content || '';
                            if (content && content.length > fullContent.length) {
                                const chunkText = content.slice(fullContent.length);
                                fullContent = content;
                                onChunk(chunkText);
                                chunkCount++;
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                }
            });

            response.data.on('end', () => {
                log(`[QWen] 流式结束, 接收到 ${chunkCount} 个数据块, 总长度: ${fullContent.length}`);
                if (fullContent) {
                    resolve({ content: fullContent });
                } else if (!hasData) {
                    reject(new Error('流式响应无数据'));
                } else {
                    resolve({ content: fullContent || 'AI 未返回有效响应' });
                }
            });

            response.data.on('error', (err: Error) => {
                logError('[QWen] 流式响应错误', err.message);
                reject(err);
            });
        });
    }
}

export class OpenAIProvider implements AIProvider {
    private config: OpenAIConfig;

    constructor(config: OpenAIConfig) {
        this.config = config;
        log(`[OpenAI] Provider 创建, model: ${config.model || 'gpt-3.5-turbo'}`);
    }

    async send(messages: AIMessage[]): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 'https://api.openai.com/v1/chat/completions';
        const model = this.config.model || 'gpt-3.5-turbo';

        log(`[OpenAI] 发送请求到: ${apiUrl}`);

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

            log(`[OpenAI] 响应状态: ${response.status}`);
            const content = response.data?.choices?.[0]?.message?.content || '';
            return { content: content || 'AI 未返回有效响应' };
        } catch (error: any) {
            logError('[OpenAI] 请求失败', error.message);
            const errorMsg = error.response?.data?.error?.message || error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }

    async sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse> {
        log('[OpenAI] sendStream 开始');
        try {
            const streamResponse = await this.tryStream(messages, onChunk);
            log(`[OpenAI] sendStream 成功, 内容长度: ${streamResponse.content?.length || 0}`);
            return streamResponse;
        } catch (streamError: any) {
            logError('[OpenAI] 流式请求失败，回退到非流式', streamError.message);
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

        log(`[OpenAI] 流式请求到: ${apiUrl}`);

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

        log('[OpenAI] 流式连接已建立');

        return new Promise((resolve, reject) => {
            let fullContent = '';
            let buffer = '';
            let hasData = false;
            let chunkCount = 0;

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
                                chunkCount++;
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                }
            });

            response.data.on('end', () => {
                log(`[OpenAI] 流式结束, 接收到 ${chunkCount} 个数据块, 总长度: ${fullContent.length}`);
                if (fullContent) {
                    resolve({ content: fullContent });
                } else if (!hasData) {
                    reject(new Error('流式响应无数据'));
                } else {
                    resolve({ content: fullContent || 'AI 未返回有效响应' });
                }
            });

            response.data.on('error', (err: Error) => {
                logError('[OpenAI] 流式响应错误', err.message);
                reject(err);
            });
        });
    }
}

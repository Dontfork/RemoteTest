import axios from 'axios';
import { AIMessage, AIResponse, AIModelConfig, AIConfig } from '../types';

export interface AIProvider {
    send(messages: AIMessage[]): Promise<AIResponse>;
    sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse>;
}

const QWEN_MODELS = ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext', 'qwen-long'];
const OPENAI_MODELS = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'];

function isQwenModel(modelName: string): boolean {
    const lowerName = modelName.toLowerCase();
    return QWEN_MODELS.some(m => lowerName.includes(m)) || 
           lowerName.includes('qwen');
}

function isOpenAIModel(modelName: string): boolean {
    const lowerName = modelName.toLowerCase();
    return OPENAI_MODELS.some(m => lowerName.includes(m)) || 
           lowerName.includes('gpt');
}

function getDefaultApiUrl(modelName: string): string {
    if (isQwenModel(modelName)) {
        return 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    }
    return 'https://api.openai.com/v1/chat/completions';
}

export class AIProviderImpl implements AIProvider {
    private config: AIModelConfig;
    private globalProxy?: string;

    constructor(config: AIModelConfig, globalProxy?: string) {
        this.config = config;
        this.globalProxy = globalProxy;
    }

    async send(messages: AIMessage[]): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || getDefaultApiUrl(this.config.name);
        const isQwen = isQwenModel(this.config.name);
        const proxy = this.globalProxy;

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }

            let requestBody: any;
            
            if (isQwen) {
                headers['Accept'] = 'application/json';
                requestBody = {
                    model: this.config.name,
                    input: { messages: messages.map(m => ({ role: m.role, content: m.content })) },
                    parameters: { result_format: 'message' }
                };
            } else {
                requestBody = {
                    model: this.config.name,
                    messages: messages.map(m => ({ role: m.role, content: m.content }))
                };
            }

            const axiosConfig: any = {
                headers,
                timeout: 60000
            };

            if (proxy) {
                axiosConfig.proxy = {
                    host: proxy.split(':')[0],
                    port: parseInt(proxy.split(':')[1] || '8080', 10)
                };
            }

            const response = await axios.post(apiUrl, requestBody, axiosConfig);

            let content: string;
            if (isQwen) {
                const rawContent = response.data?.output?.choices?.[0]?.message?.content;
                content = rawContent !== undefined && rawContent !== null ? String(rawContent) : '';
            } else {
                content = response.data?.choices?.[0]?.message?.content || '';
            }
            
            return { content: content || 'AI 未返回有效响应' };
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || 
                            error.response?.data?.error?.message || 
                            error.message || '请求失败';
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
        const apiUrl = this.config.apiUrl || getDefaultApiUrl(this.config.name);
        const isQwen = isQwenModel(this.config.name);
        const proxy = this.globalProxy;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        };

        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        let requestBody: any;
        
        if (isQwen) {
            headers['X-DashScope-SSE'] = 'enable';
            requestBody = {
                model: this.config.name,
                input: { messages: messages.map(m => ({ role: m.role, content: m.content })) },
                parameters: { 
                    result_format: 'message',
                    incremental_output: true
                }
            };
        } else {
            requestBody = {
                model: this.config.name,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                stream: true
            };
        }

        const axiosConfig: any = {
            method: 'POST',
            url: apiUrl,
            headers,
            data: requestBody,
            responseType: 'stream',
            timeout: 120000
        };

        if (proxy) {
            axiosConfig.proxy = {
                host: proxy.split(':')[0],
                port: parseInt(proxy.split(':')[1] || '8080', 10)
            };
        }

        const response = await axios(axiosConfig);

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
                            let content: string;
                            
                            if (isQwen) {
                                content = json?.output?.choices?.[0]?.message?.content || '';
                            } else {
                                content = json?.choices?.[0]?.delta?.content || '';
                            }
                            
                            if (content) {
                                fullContent += content;
                                onChunk(content);
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                }
            });

            response.data.on('end', () => {
                if (fullContent) {
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

export function createProvider(config: AIModelConfig, globalProxy?: string): AIProvider {
    return new AIProviderImpl(config, globalProxy);
}

export { isQwenModel, isOpenAIModel };

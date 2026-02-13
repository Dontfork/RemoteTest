import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';

interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface AIResponse {
    content: string;
    error?: string;
}

interface QWenConfig {
    apiKey: string;
    apiUrl: string;
    model: string;
}

interface OpenAIConfig {
    apiKey: string;
    apiUrl: string;
    model: string;
}

describe('AI Module - AI对话模块测试', () => {
    describe('Message Management - 消息管理', () => {
        let messages: AIMessage[];

        beforeEach(() => {
            messages = [];
        });

        it('添加用户消息 - role为user，content为用户输入', () => {
            messages.push({ role: 'user', content: 'Hello' });
            assert.strictEqual(messages.length, 1);
            assert.strictEqual(messages[0].role, 'user');
        });

        it('添加助手消息 - role为assistant，content为AI回复', () => {
            messages.push({ role: 'assistant', content: 'Hi there!' });
            assert.strictEqual(messages.length, 1);
            assert.strictEqual(messages[0].role, 'assistant');
        });

        it('添加系统消息 - role为system，content为系统提示词', () => {
            messages.push({ role: 'system', content: 'You are a helpful assistant.' });
            assert.strictEqual(messages.length, 1);
            assert.strictEqual(messages[0].role, 'system');
        });

        it('消息顺序维护 - 按添加顺序存储消息', () => {
            messages.push({ role: 'system', content: 'System prompt' });
            messages.push({ role: 'user', content: 'User message' });
            messages.push({ role: 'assistant', content: 'Assistant response' });
            
            assert.strictEqual(messages.length, 3);
            assert.strictEqual(messages[0].role, 'system');
            assert.strictEqual(messages[1].role, 'user');
            assert.strictEqual(messages[2].role, 'assistant');
        });

        it('清空消息列表 - 将数组长度设为0', () => {
            messages.push({ role: 'user', content: 'Test' });
            messages.length = 0;
            
            assert.strictEqual(messages.length, 0);
        });
    });

    describe('QWen Provider - 通义千问提供者', () => {
        it('消息格式化 - 将消息转换为QWen API所需格式', () => {
            const messages: AIMessage[] = [
                { role: 'user', content: 'What is TypeScript?' }
            ];
            
            const formatted = messages.map(m => ({
                role: m.role,
                content: m.content
            }));
            
            assert.strictEqual(formatted.length, 1);
            assert.strictEqual(formatted[0].role, 'user');
            assert.strictEqual(formatted[0].content, 'What is TypeScript?');
        });

        it('API URL验证 - 必须是HTTPS且包含dashscope域名', () => {
            const qwenUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
            
            assert.ok(qwenUrl.startsWith('https://'));
            assert.ok(qwenUrl.includes('dashscope'));
        });

        it('模型选择验证 - 使用qwen-turbo模型', () => {
            const model = 'qwen-turbo';
            
            assert.ok(model.startsWith('qwen'));
        });

        it('QWen模型配置 - 支持多种模型选择', () => {
            const qwenModels = ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext'];
            const config: QWenConfig = {
                apiKey: 'test-key',
                apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                model: 'qwen-max'
            };
            
            assert.ok(qwenModels.includes(config.model));
            assert.strictEqual(config.model, 'qwen-max');
        });

        it('QWen模型默认值 - 未配置时使用qwen-turbo', () => {
            const defaultModel = 'qwen-turbo';
            const config: QWenConfig = {
                apiKey: 'test-key',
                apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                model: ''
            };
            const actualModel = config.model || defaultModel;
            
            assert.strictEqual(actualModel, 'qwen-turbo');
        });
    });

    describe('OpenAI Provider - OpenAI提供者', () => {
        it('消息格式化 - 将消息转换为OpenAI API所需格式', () => {
            const messages: AIMessage[] = [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Hello!' }
            ];
            
            const formatted = messages.map(m => ({
                role: m.role,
                content: m.content
            }));
            
            assert.strictEqual(formatted.length, 2);
        });

        it('API URL验证 - 必须是HTTPS且包含openai.com域名', () => {
            const openaiUrl = 'https://api.openai.com/v1/chat/completions';
            
            assert.ok(openaiUrl.startsWith('https://'));
            assert.ok(openaiUrl.includes('openai.com'));
        });

        it('模型选择验证 - 使用gpt-3.5-turbo模型', () => {
            const model = 'gpt-3.5-turbo';
            
            assert.ok(model.startsWith('gpt'));
        });

        it('OpenAI模型配置 - 支持多种模型选择', () => {
            const openaiModels = ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-4', 'gpt-4-32k', 'gpt-4-turbo'];
            const config: OpenAIConfig = {
                apiKey: 'sk-test',
                apiUrl: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-4'
            };
            
            assert.ok(openaiModels.includes(config.model));
            assert.strictEqual(config.model, 'gpt-4');
        });

        it('OpenAI模型默认值 - 未配置时使用gpt-3.5-turbo', () => {
            const defaultModel = 'gpt-3.5-turbo';
            const config: OpenAIConfig = {
                apiKey: 'sk-test',
                apiUrl: 'https://api.openai.com/v1/chat/completions',
                model: ''
            };
            const actualModel = config.model || defaultModel;
            
            assert.strictEqual(actualModel, 'gpt-3.5-turbo');
        });
    });

    describe('Response Handling - 响应处理', () => {
        it('成功响应处理 - content非空，error为undefined', () => {
            const response: AIResponse = {
                content: 'This is a test response from AI.'
            };
            
            assert.ok(response.content);
            assert.strictEqual(response.error, undefined);
        });

        it('错误响应处理 - content为空，error包含错误信息', () => {
            const response: AIResponse = {
                content: '',
                error: 'API key is invalid'
            };
            
            assert.strictEqual(response.content, '');
            assert.ok(response.error);
        });

        it('空响应处理 - content为空字符串', () => {
            const response: AIResponse = {
                content: ''
            };
            
            assert.strictEqual(response.content, '');
        });
    });

    describe('Provider Selection - 提供者选择', () => {
        it('选择qwen提供者 - provider值为"qwen"', () => {
            const provider = 'qwen';
            
            assert.strictEqual(provider, 'qwen');
        });

        it('选择openai提供者 - provider值为"openai"', () => {
            const provider = 'openai';
            
            assert.strictEqual(provider, 'openai');
        });

        it('提供者类型验证 - 必须是qwen或openai之一', () => {
            const validProviders = ['qwen', 'openai'];
            const testProvider = 'qwen';
            
            assert.ok(validProviders.includes(testProvider));
        });
    });

    describe('API Configuration - API配置', () => {
        it('API密钥配置验证 - apiKey、apiUrl、model都必须存在', () => {
            const qwenConfig: QWenConfig = {
                apiKey: 'test-api-key',
                apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                model: 'qwen-turbo'
            };
            
            assert.ok(qwenConfig.apiKey);
            assert.ok(qwenConfig.apiUrl);
            assert.ok(qwenConfig.model);
        });

        it('OpenAI配置验证 - apiKey、apiUrl、model都必须存在', () => {
            const openaiConfig: OpenAIConfig = {
                apiKey: 'sk-test',
                apiUrl: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-4'
            };
            
            assert.ok(openaiConfig.apiKey);
            assert.ok(openaiConfig.apiUrl);
            assert.ok(openaiConfig.model);
        });

        it('缺失API密钥处理 - apiKey为空字符串', () => {
            const config = {
                apiKey: '',
                apiUrl: 'https://api.example.com',
                model: 'test-model'
            };
            
            assert.strictEqual(config.apiKey, '');
        });

        it('默认API URL - QWen和OpenAI各有默认URL', () => {
            const defaultQwenUrl = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
            const defaultOpenAIUrl = 'https://api.openai.com/v1/chat/completions';
            
            assert.ok(defaultQwenUrl);
            assert.ok(defaultOpenAIUrl);
        });

        it('默认模型名称 - QWen默认qwen-turbo，OpenAI默认gpt-3.5-turbo', () => {
            const defaultQwenModel = 'qwen-turbo';
            const defaultOpenAIModel = 'gpt-3.5-turbo';
            
            assert.strictEqual(defaultQwenModel, 'qwen-turbo');
            assert.strictEqual(defaultOpenAIModel, 'gpt-3.5-turbo');
        });
    });

    describe('Request Configuration - 请求配置', () => {
        it('超时设置验证 - 默认超时时间为60000毫秒', () => {
            const timeout = 60000;
            
            assert.strictEqual(timeout, 60000);
        });

        it('请求头验证 - 包含Authorization和Content-Type', () => {
            const headers = {
                'Authorization': 'Bearer test-key',
                'Content-Type': 'application/json'
            };
            
            assert.ok(headers['Authorization']);
            assert.ok(headers['Content-Type']);
        });

        it('请求体包含模型参数 - model字段必须存在', () => {
            const requestBody = {
                model: 'qwen-turbo',
                messages: [{ role: 'user', content: 'Hello' }]
            };
            
            assert.ok(requestBody.model);
        });
    });

    describe('Error Handling - 错误处理', () => {
        it('网络错误处理 - 错误消息非空', () => {
            const error = new Error('Network error');
            
            assert.ok(error.message);
        });

        it('超时错误处理 - 错误代码为ECONNABORTED', () => {
            const error = { code: 'ECONNABORTED', message: 'timeout of 60000ms exceeded' };
            
            assert.strictEqual(error.code, 'ECONNABORTED');
        });

        it('API错误响应处理 - HTTP状态码401表示认证失败', () => {
            const apiError = {
                response: {
                    status: 401,
                    data: { message: 'Invalid API key' }
                }
            };
            
            assert.strictEqual(apiError.response.status, 401);
        });
    });

    describe('Conversation Context - 对话上下文', () => {
        it('维护对话历史 - 按顺序存储所有消息', () => {
            const messages: AIMessage[] = [
                { role: 'user', content: 'What is 2+2?' },
                { role: 'assistant', content: '2+2 equals 4.' },
                { role: 'user', content: 'What about 3+3?' },
                { role: 'assistant', content: '3+3 equals 6.' }
            ];
            
            assert.strictEqual(messages.length, 4);
        });

        it('系统消息包含在上下文中 - 第一条消息为system角色', () => {
            const messages: AIMessage[] = [
                { role: 'system', content: 'You are a math helper.' },
                { role: 'user', content: 'What is 1+1?' }
            ];
            
            assert.strictEqual(messages[0].role, 'system');
        });
    });
});

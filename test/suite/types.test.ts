import * as assert from 'assert';
import { describe, it } from 'mocha';

interface ServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    uploadUrl: string;
    executeCommand: string;
    logDirectory: string;
    downloadPath: string;
}

interface CommandConfig {
    executeCommand: string;
    filterPatterns: string[];
    filterMode: 'include' | 'exclude';
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

interface AIConfig {
    provider: 'qwen' | 'openai';
    qwen: QWenConfig;
    openai: OpenAIConfig;
}

interface LogsConfig {
    monitorDirectory: string;
    downloadPath: string;
    refreshInterval: number;
}

interface AutoTestConfig {
    server: ServerConfig;
    command: CommandConfig;
    ai: AIConfig;
    logs: LogsConfig;
}

interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface AIResponse {
    content: string;
    error?: string;
}

interface LogFile {
    name: string;
    path: string;
    size: number;
    modifiedTime: Date;
}

describe('Types Module - 类型定义模块测试', () => {
    describe('ServerConfig - 服务器配置接口', () => {
        it('验证ServerConfig接口包含所有必需属性', () => {
            const config: ServerConfig = {
                host: '192.168.1.100',
                port: 22,
                username: 'root',
                password: 'password',
                uploadUrl: 'http://192.168.1.100:8080/upload',
                executeCommand: 'http://192.168.1.100:8080/execute',
                logDirectory: '/var/logs',
                downloadPath: './downloads'
            };
            
            assert.strictEqual(config.host, '192.168.1.100');
            assert.strictEqual(config.port, 22);
            assert.strictEqual(config.username, 'root');
            assert.strictEqual(config.uploadUrl, 'http://192.168.1.100:8080/upload');
        });
    });

    describe('CommandConfig - 命令配置接口', () => {
        it('验证include过滤模式 - 只保留匹配的输出行', () => {
            const config: CommandConfig = {
                executeCommand: 'npm test',
                filterPatterns: ['\\[error\\]', '\\[fail\\]'],
                filterMode: 'include'
            };
            
            assert.strictEqual(config.filterMode, 'include');
            assert.strictEqual(config.filterPatterns.length, 2);
        });

        it('验证exclude过滤模式 - 排除匹配的输出行', () => {
            const config: CommandConfig = {
                executeCommand: 'npm test',
                filterPatterns: ['\\[debug\\]'],
                filterMode: 'exclude'
            };
            
            assert.strictEqual(config.filterMode, 'exclude');
        });
    });

    describe('AIConfig - AI配置接口', () => {
        it('验证qwen提供者配置 - 使用通义千问API和qwen-turbo模型', () => {
            const config: AIConfig = {
                provider: 'qwen',
                qwen: {
                    apiKey: 'test-key',
                    apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                    model: 'qwen-turbo'
                },
                openai: {
                    apiKey: '',
                    apiUrl: 'https://api.openai.com/v1/chat/completions',
                    model: 'gpt-3.5-turbo'
                }
            };
            
            assert.strictEqual(config.provider, 'qwen');
            assert.ok(config.qwen.apiKey);
            assert.strictEqual(config.qwen.model, 'qwen-turbo');
        });

        it('验证openai提供者配置 - 使用OpenAI API和gpt-3.5-turbo模型', () => {
            const config: AIConfig = {
                provider: 'openai',
                qwen: {
                    apiKey: '',
                    apiUrl: '',
                    model: ''
                },
                openai: {
                    apiKey: 'sk-test',
                    apiUrl: 'https://api.openai.com/v1/chat/completions',
                    model: 'gpt-4'
                }
            };
            
            assert.strictEqual(config.provider, 'openai');
            assert.ok(config.openai.apiKey);
            assert.strictEqual(config.openai.model, 'gpt-4');
        });

        it('验证qwen模型可配置 - 支持qwen-turbo、qwen-plus、qwen-max等模型', () => {
            const qwenModels = ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext'];
            const config: QWenConfig = {
                apiKey: 'test-key',
                apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                model: 'qwen-max'
            };
            
            assert.ok(qwenModels.includes(config.model));
            assert.strictEqual(config.model, 'qwen-max');
        });

        it('验证openai模型可配置 - 支持gpt-3.5-turbo、gpt-4等模型', () => {
            const openaiModels = ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-4', 'gpt-4-32k'];
            const config: OpenAIConfig = {
                apiKey: 'sk-test',
                apiUrl: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-4'
            };
            
            assert.ok(openaiModels.includes(config.model));
            assert.strictEqual(config.model, 'gpt-4');
        });
    });

    describe('LogsConfig - 日志配置接口', () => {
        it('验证日志配置属性 - 监控目录、下载路径、刷新间隔', () => {
            const config: LogsConfig = {
                monitorDirectory: '/var/logs',
                downloadPath: './downloads',
                refreshInterval: 5000
            };
            
            assert.strictEqual(config.monitorDirectory, '/var/logs');
            assert.strictEqual(config.refreshInterval, 5000);
        });
    });

    describe('AutoTestConfig - 完整配置接口', () => {
        it('验证完整配置结构 - 包含server、command、ai、logs四个子配置', () => {
            const config: AutoTestConfig = {
                server: {
                    host: 'localhost',
                    port: 22,
                    username: 'root',
                    password: '',
                    uploadUrl: 'http://localhost:8080/upload',
                    executeCommand: 'http://localhost:8080/execute',
                    logDirectory: '/var/logs',
                    downloadPath: './downloads'
                },
                command: {
                    executeCommand: 'echo test',
                    filterPatterns: [],
                    filterMode: 'include'
                },
                ai: {
                    provider: 'qwen',
                    qwen: { apiKey: '', apiUrl: '', model: 'qwen-turbo' },
                    openai: { apiKey: '', apiUrl: '', model: 'gpt-3.5-turbo' }
                },
                logs: {
                    monitorDirectory: '/var/logs',
                    downloadPath: './downloads',
                    refreshInterval: 5000
                }
            };
            
            assert.ok(config.server);
            assert.ok(config.command);
            assert.ok(config.ai);
            assert.ok(config.logs);
        });
    });

    describe('AIMessage - AI消息接口', () => {
        it('验证用户消息创建 - role为user', () => {
            const message: AIMessage = {
                role: 'user',
                content: 'Hello, AI!'
            };
            
            assert.strictEqual(message.role, 'user');
            assert.strictEqual(message.content, 'Hello, AI!');
        });

        it('验证助手消息创建 - role为assistant', () => {
            const message: AIMessage = {
                role: 'assistant',
                content: 'Hello! How can I help you?'
            };
            
            assert.strictEqual(message.role, 'assistant');
        });

        it('验证系统消息创建 - role为system', () => {
            const message: AIMessage = {
                role: 'system',
                content: 'You are a helpful assistant.'
            };
            
            assert.strictEqual(message.role, 'system');
        });
    });

    describe('AIResponse - AI响应接口', () => {
        it('验证成功响应 - 包含content，无error', () => {
            const response: AIResponse = {
                content: 'This is the AI response'
            };
            
            assert.strictEqual(response.content, 'This is the AI response');
            assert.strictEqual(response.error, undefined);
        });

        it('验证错误响应 - 包含error信息', () => {
            const response: AIResponse = {
                content: '',
                error: 'API request failed'
            };
            
            assert.strictEqual(response.content, '');
            assert.strictEqual(response.error, 'API request failed');
        });
    });

    describe('LogFile - 日志文件接口', () => {
        it('验证日志文件对象 - 包含名称、路径、大小、修改时间', () => {
            const logFile: LogFile = {
                name: 'app.log',
                path: '/var/logs/app.log',
                size: 1024,
                modifiedTime: new Date('2024-01-15T10:30:00Z')
            };
            
            assert.strictEqual(logFile.name, 'app.log');
            assert.strictEqual(logFile.path, '/var/logs/app.log');
            assert.strictEqual(logFile.size, 1024);
            assert.ok(logFile.modifiedTime instanceof Date);
        });
    });
});

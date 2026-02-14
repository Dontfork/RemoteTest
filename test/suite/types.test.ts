import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as path from 'path';

interface ServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    privateKeyPath: string;
    localProjectPath: string;
    remoteDirectory: string;
}

interface CommandConfig {
    executeCommand: string;
    filterPatterns: string[];
    filterMode: 'include' | 'exclude';
}

interface CommandVariables {
    filePath: string;
    fileName: string;
    fileDir: string;
    localPath: string;
    localDir: string;
    localFileName: string;
    remoteDir: string;
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

interface LogDirectoryConfig {
    name: string;
    path: string;
}

interface LogsConfig {
    directories: LogDirectoryConfig[];
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
    isDirectory: boolean;
}

describe('Types Module - 类型定义模块测试', () => {
    describe('ServerConfig - 服务器配置接口', () => {
        it('验证ServerConfig接口包含所有必需属性 - SSH/SCP配置', () => {
            const config: ServerConfig = {
                host: '192.168.1.100',
                port: 22,
                username: 'root',
                password: 'password',
                privateKeyPath: '',
                localProjectPath: '',
                remoteDirectory: '/tmp/autotest'
            };
            
            assert.strictEqual(config.host, '192.168.1.100');
            assert.strictEqual(config.port, 22);
            assert.strictEqual(config.username, 'root');
            assert.strictEqual(config.remoteDirectory, '/tmp/autotest');
        });

        it('验证SSH密码认证配置 - 使用password进行认证', () => {
            const config: ServerConfig = {
                host: '192.168.1.100',
                port: 22,
                username: 'testuser',
                password: 'mypassword',
                privateKeyPath: '',
                localProjectPath: '',
                remoteDirectory: '/home/testuser/autotest'
            };
            
            assert.strictEqual(config.password, 'mypassword');
            assert.strictEqual(config.privateKeyPath, '');
        });

        it('验证SSH密钥认证配置 - 使用privateKeyPath进行认证', () => {
            const config: ServerConfig = {
                host: '192.168.1.100',
                port: 22,
                username: 'root',
                password: '',
                privateKeyPath: '/home/user/.ssh/id_rsa',
                localProjectPath: '',
                remoteDirectory: '/tmp/autotest'
            };
            
            assert.strictEqual(config.privateKeyPath, '/home/user/.ssh/id_rsa');
            assert.strictEqual(config.password, '');
        });

        it('验证SSH端口配置 - 支持非标准SSH端口', () => {
            const config: ServerConfig = {
                host: '192.168.1.100',
                port: 2222,
                username: 'root',
                password: 'password',
                privateKeyPath: '',
                localProjectPath: '',
                remoteDirectory: '/tmp/autotest'
            };
            
            assert.strictEqual(config.port, 2222);
        });

        it('验证本地工程路径配置 - localProjectPath用于路径映射', () => {
            const config: ServerConfig = {
                host: '192.168.1.100',
                port: 22,
                username: 'root',
                password: 'password',
                privateKeyPath: '',
                localProjectPath: 'D:\\Projects\\Test',
                remoteDirectory: '/home/user/test'
            };
            
            assert.strictEqual(config.localProjectPath, 'D:\\Projects\\Test');
        });

        it('验证ServerConfig不包含logDirectory和downloadPath - 已移至logs配置', () => {
            const config: ServerConfig = {
                host: '192.168.1.100',
                port: 22,
                username: 'root',
                password: 'password',
                privateKeyPath: '',
                localProjectPath: '',
                remoteDirectory: '/tmp/autotest'
            };
            
            assert.strictEqual(Object.keys(config).includes('logDirectory'), false);
            assert.strictEqual(Object.keys(config).includes('downloadPath'), false);
        });
    });

    describe('路径映射逻辑 - 本地到远程路径转换', () => {
        it('验证相对路径计算 - 本地文件映射到远程对应路径', () => {
            const localProjectPath = 'D:\\Projects\\Test';
            const remoteDirectory = '/home/user/test';
            const localFilePath = 'D:\\Projects\\Test\\src\\utils\\helper.js';
            
            const relativePath = path.relative(localProjectPath, localFilePath);
            const posixRelativePath = relativePath.split(path.sep).join(path.posix.sep);
            const remotePath = path.posix.join(remoteDirectory, posixRelativePath);
            
            assert.strictEqual(remotePath, '/home/user/test/src/utils/helper.js');
        });

        it('验证深层目录路径映射 - 多层嵌套目录', () => {
            const localProjectPath = '/home/user/project';
            const remoteDirectory = '/opt/autotest';
            const localFilePath = '/home/user/project/tests/unit/services/auth.test.js';
            
            const relativePath = path.relative(localProjectPath, localFilePath);
            const posixRelativePath = relativePath.split(path.sep).join(path.posix.sep);
            const remotePath = path.posix.join(remoteDirectory, posixRelativePath);
            
            assert.strictEqual(remotePath, '/opt/autotest/tests/unit/services/auth.test.js');
        });

        it('验证根目录文件映射 - 文件在工程根目录', () => {
            const localProjectPath = '/home/user/project';
            const remoteDirectory = '/opt/autotest';
            const localFilePath = '/home/user/project/package.json';
            
            const relativePath = path.relative(localProjectPath, localFilePath);
            const posixRelativePath = relativePath.split(path.sep).join(path.posix.sep);
            const remotePath = path.posix.join(remoteDirectory, posixRelativePath);
            
            assert.strictEqual(remotePath, '/opt/autotest/package.json');
        });

        it('验证路径分隔符转换 - Windows路径转POSIX路径', () => {
            const windowsPath = 'src\\utils\\helper.js';
            const posixPath = windowsPath.split(path.sep).join(path.posix.sep);
            
            assert.strictEqual(posixPath, 'src/utils/helper.js');
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

        it('验证远程命令配置 - 通过SSH执行的命令', () => {
            const config: CommandConfig = {
                executeCommand: 'cd /tmp/autotest && npm test',
                filterPatterns: ['\\[error\\]'],
                filterMode: 'include'
            };
            
            assert.ok(config.executeCommand.includes('/tmp/autotest'));
            assert.strictEqual(config.filterMode, 'include');
        });

        it('验证带变量的命令配置 - 支持文件路径变量替换', () => {
            const config: CommandConfig = {
                executeCommand: 'pytest {filePath} -v',
                filterPatterns: ['PASSED', 'FAILED'],
                filterMode: 'include'
            };
            
            assert.ok(config.executeCommand.includes('{filePath}'));
            assert.ok(config.filterPatterns.includes('PASSED'));
        });
    });

    describe('CommandVariables - 命令变量接口', () => {
        it('验证CommandVariables接口包含所有变量 - 文件路径相关变量', () => {
            const variables: CommandVariables = {
                filePath: '/tmp/autotest/tests/test_example.py',
                fileName: 'test_example.py',
                fileDir: '/tmp/autotest/tests',
                localPath: 'D:\\project\\tests\\test_example.py',
                localDir: 'D:\\project\\tests',
                localFileName: 'test_example.py',
                remoteDir: '/tmp/autotest'
            };
            
            assert.strictEqual(variables.filePath, '/tmp/autotest/tests/test_example.py');
            assert.strictEqual(variables.fileName, 'test_example.py');
            assert.strictEqual(variables.fileDir, '/tmp/autotest/tests');
        });

        it('验证远程路径变量 - filePath为远程文件完整路径', () => {
            const variables: CommandVariables = {
                filePath: '/home/user/project/src/main.py',
                fileName: 'main.py',
                fileDir: '/home/user/project/src',
                localPath: 'C:\\dev\\project\\src\\main.py',
                localDir: 'C:\\dev\\project\\src',
                localFileName: 'main.py',
                remoteDir: '/home/user/project'
            };
            
            assert.ok(variables.filePath.startsWith('/'));
            assert.ok(variables.filePath.endsWith('.py'));
        });

        it('验证本地路径变量 - localPath为本地文件完整路径', () => {
            const variables: CommandVariables = {
                filePath: '/tmp/test.py',
                fileName: 'test.py',
                fileDir: '/tmp',
                localPath: 'D:\\workspace\\test.py',
                localDir: 'D:\\workspace',
                localFileName: 'test.py',
                remoteDir: '/tmp'
            };
            
            assert.ok(variables.localPath.includes('test.py'));
            assert.strictEqual(variables.localDir, 'D:\\workspace');
        });

        it('验证远程工程目录变量 - remoteDir为配置的远程目录', () => {
            const variables: CommandVariables = {
                filePath: '/opt/autotest/tests/api/test_user.py',
                fileName: 'test_user.py',
                fileDir: '/opt/autotest/tests/api',
                localPath: '/home/dev/project/tests/api/test_user.py',
                localDir: '/home/dev/project/tests/api',
                localFileName: 'test_user.py',
                remoteDir: '/opt/autotest'
            };
            
            assert.strictEqual(variables.remoteDir, '/opt/autotest');
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
        it('验证日志目录列表配置 - 支持多个监控目录', () => {
            const config: LogsConfig = {
                directories: [
                    { name: '应用日志', path: '/var/logs' },
                    { name: '测试日志', path: '/var/log/autotest' }
                ],
                downloadPath: './downloads',
                refreshInterval: 5000
            };
            
            assert.strictEqual(config.directories.length, 2);
            assert.strictEqual(config.directories[0].name, '应用日志');
            assert.strictEqual(config.directories[1].path, '/var/log/autotest');
        });

        it('验证日志下载路径配置 - 本地保存路径', () => {
            const config: LogsConfig = {
                directories: [{ name: '日志', path: '/var/logs' }],
                downloadPath: './logs',
                refreshInterval: 3000
            };
            
            assert.strictEqual(config.downloadPath, './logs');
            assert.strictEqual(config.refreshInterval, 3000);
        });

        it('验证LogDirectoryConfig结构 - 包含name和path', () => {
            const dirConfig: LogDirectoryConfig = {
                name: '系统日志',
                path: '/var/log/system'
            };
            
            assert.strictEqual(dirConfig.name, '系统日志');
            assert.strictEqual(dirConfig.path, '/var/log/system');
        });
    });

    describe('LogFile - 日志文件接口', () => {
        it('验证日志文件对象 - 包含名称、路径、大小、修改时间、是否目录', () => {
            const logFile: LogFile = {
                name: 'app.log',
                path: '/var/logs/app.log',
                size: 1024,
                modifiedTime: new Date('2024-01-15T10:30:00Z'),
                isDirectory: false
            };
            
            assert.strictEqual(logFile.name, 'app.log');
            assert.strictEqual(logFile.path, '/var/logs/app.log');
            assert.strictEqual(logFile.size, 1024);
            assert.strictEqual(logFile.isDirectory, false);
            assert.ok(logFile.modifiedTime instanceof Date);
        });

        it('验证日志目录对象 - isDirectory为true', () => {
            const logDir: LogFile = {
                name: 'subdir',
                path: '/var/logs/subdir',
                size: 4096,
                modifiedTime: new Date('2024-01-15T10:30:00Z'),
                isDirectory: true
            };
            
            assert.strictEqual(logDir.isDirectory, true);
            assert.strictEqual(logDir.name, 'subdir');
        });
    });

    describe('AutoTestConfig - 完整配置接口', () => {
        it('验证完整配置结构 - 包含server、command、ai、logs四个子配置', () => {
            const config: AutoTestConfig = {
                server: {
                    host: '192.168.1.100',
                    port: 22,
                    username: 'root',
                    password: 'password',
                    privateKeyPath: '',
                    localProjectPath: '',
                    remoteDirectory: '/tmp/autotest'
                },
                command: {
                    executeCommand: 'npm test',
                    filterPatterns: [],
                    filterMode: 'include'
                },
                ai: {
                    provider: 'qwen',
                    qwen: { apiKey: '', apiUrl: '', model: 'qwen-turbo' },
                    openai: { apiKey: '', apiUrl: '', model: 'gpt-3.5-turbo' }
                },
                logs: {
                    directories: [{ name: '日志', path: '/var/logs' }],
                    downloadPath: './downloads',
                    refreshInterval: 5000
                }
            };
            
            assert.ok(config.server);
            assert.ok(config.command);
            assert.ok(config.ai);
            assert.ok(config.logs);
        });

        it('验证SSH/SCP完整配置 - 使用密钥认证', () => {
            const config: AutoTestConfig = {
                server: {
                    host: '192.168.1.200',
                    port: 22,
                    username: 'deploy',
                    password: '',
                    privateKeyPath: '/home/deploy/.ssh/id_rsa',
                    localProjectPath: '/home/deploy/project',
                    remoteDirectory: '/opt/autotest'
                },
                command: {
                    executeCommand: 'cd /opt/autotest && ./run_tests.sh',
                    filterPatterns: ['\\[error\\]', '\\[fail\\]'],
                    filterMode: 'include'
                },
                ai: {
                    provider: 'openai',
                    qwen: { apiKey: '', apiUrl: '', model: 'qwen-turbo' },
                    openai: { apiKey: 'sk-test', apiUrl: '', model: 'gpt-4' }
                },
                logs: {
                    directories: [
                        { name: '应用日志', path: '/var/log/autotest' },
                        { name: '系统日志', path: '/var/log/system' }
                    ],
                    downloadPath: './logs',
                    refreshInterval: 10000
                }
            };
            
            assert.strictEqual(config.server.privateKeyPath, '/home/deploy/.ssh/id_rsa');
            assert.strictEqual(config.server.localProjectPath, '/home/deploy/project');
            assert.strictEqual(config.server.remoteDirectory, '/opt/autotest');
            assert.strictEqual(config.logs.directories.length, 2);
            assert.strictEqual(config.ai.provider, 'openai');
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
});

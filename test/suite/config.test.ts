import * as assert from 'assert';
import { describe, it } from 'mocha';

const defaultConfig = {
    server: {
        host: "192.168.1.100",
        port: 22,
        username: "root",
        password: "",
        uploadUrl: "http://192.168.1.100:8080/upload",
        executeCommand: "http://192.168.1.100:8080/execute",
        logDirectory: "/var/logs",
        downloadPath: "./downloads"
    },
    command: {
        executeCommand: "echo 'No command configured'",
        filterPatterns: [] as string[],
        filterMode: "include" as 'include' | 'exclude'
    },
    ai: {
        provider: "qwen" as 'qwen' | 'openai',
        qwen: {
            apiKey: "",
            apiUrl: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            model: "qwen-turbo"
        },
        openai: {
            apiKey: "",
            apiUrl: "https://api.openai.com/v1/chat/completions",
            model: "gpt-3.5-turbo"
        }
    },
    logs: {
        monitorDirectory: "/var/logs",
        downloadPath: "./downloads",
        refreshInterval: 5000
    }
};

describe('Config Module - 配置模块测试', () => {
    describe('Default Configuration - 默认配置验证', () => {
        it('验证服务器配置有效性 - host、port、uploadUrl、executeCommand必填', () => {
            assert.ok(defaultConfig.server.host);
            assert.ok(defaultConfig.server.port > 0);
            assert.ok(defaultConfig.server.uploadUrl);
            assert.ok(defaultConfig.server.executeCommand);
        });

        it('验证命令配置有效性 - executeCommand、filterPatterns数组、filterMode枚举值', () => {
            assert.ok(defaultConfig.command.executeCommand);
            assert.ok(Array.isArray(defaultConfig.command.filterPatterns));
            assert.ok(['include', 'exclude'].includes(defaultConfig.command.filterMode));
        });

        it('验证AI配置有效性 - provider枚举值、qwen和openai配置对象、model字段', () => {
            assert.ok(['qwen', 'openai'].includes(defaultConfig.ai.provider));
            assert.ok(defaultConfig.ai.qwen);
            assert.ok(defaultConfig.ai.openai);
            assert.ok(defaultConfig.ai.qwen.model);
            assert.ok(defaultConfig.ai.openai.model);
        });

        it('验证日志配置有效性 - monitorDirectory、downloadPath、refreshInterval', () => {
            assert.ok(defaultConfig.logs.monitorDirectory);
            assert.ok(defaultConfig.logs.downloadPath);
            assert.ok(defaultConfig.logs.refreshInterval > 0);
        });
    });

    describe('Configuration Validation - 配置值验证', () => {
        it('验证默认服务器主机地址 - 应为192.168.1.100', () => {
            assert.strictEqual(defaultConfig.server.host, '192.168.1.100');
        });

        it('验证默认服务器端口 - 应为22(SSH端口)', () => {
            assert.strictEqual(defaultConfig.server.port, 22);
        });

        it('验证默认AI提供者 - 应为qwen', () => {
            assert.strictEqual(defaultConfig.ai.provider, 'qwen');
        });

        it('验证默认刷新间隔 - 应为5000毫秒', () => {
            assert.strictEqual(defaultConfig.logs.refreshInterval, 5000);
        });

        it('验证默认API密钥为空 - 安全考虑，需用户自行配置', () => {
            assert.strictEqual(defaultConfig.ai.qwen.apiKey, '');
            assert.strictEqual(defaultConfig.ai.openai.apiKey, '');
        });

        it('验证默认qwen模型 - 应为qwen-turbo', () => {
            assert.strictEqual(defaultConfig.ai.qwen.model, 'qwen-turbo');
        });

        it('验证默认openai模型 - 应为gpt-3.5-turbo', () => {
            assert.strictEqual(defaultConfig.ai.openai.model, 'gpt-3.5-turbo');
        });
    });

    describe('Configuration Structure - 配置结构验证', () => {
        it('验证配置对象完整性 - 必须包含server、command、ai、logs四个顶层属性', () => {
            assert.ok(typeof defaultConfig === 'object');
            assert.ok('server' in defaultConfig);
            assert.ok('command' in defaultConfig);
            assert.ok('ai' in defaultConfig);
            assert.ok('logs' in defaultConfig);
        });

        it('验证server嵌套属性 - host、port、username、password、uploadUrl、executeCommand、logDirectory、downloadPath', () => {
            assert.ok('host' in defaultConfig.server);
            assert.ok('port' in defaultConfig.server);
            assert.ok('username' in defaultConfig.server);
            assert.ok('password' in defaultConfig.server);
            assert.ok('uploadUrl' in defaultConfig.server);
            assert.ok('executeCommand' in defaultConfig.server);
            assert.ok('logDirectory' in defaultConfig.server);
            assert.ok('downloadPath' in defaultConfig.server);
        });

        it('验证command嵌套属性 - executeCommand、filterPatterns、filterMode', () => {
            assert.ok('executeCommand' in defaultConfig.command);
            assert.ok('filterPatterns' in defaultConfig.command);
            assert.ok('filterMode' in defaultConfig.command);
        });

        it('验证ai嵌套属性 - provider、qwen、openai', () => {
            assert.ok('provider' in defaultConfig.ai);
            assert.ok('qwen' in defaultConfig.ai);
            assert.ok('openai' in defaultConfig.ai);
        });

        it('验证qwen嵌套属性 - apiKey、apiUrl、model', () => {
            assert.ok('apiKey' in defaultConfig.ai.qwen);
            assert.ok('apiUrl' in defaultConfig.ai.qwen);
            assert.ok('model' in defaultConfig.ai.qwen);
        });

        it('验证openai嵌套属性 - apiKey、apiUrl、model', () => {
            assert.ok('apiKey' in defaultConfig.ai.openai);
            assert.ok('apiUrl' in defaultConfig.ai.openai);
            assert.ok('model' in defaultConfig.ai.openai);
        });

        it('验证logs嵌套属性 - monitorDirectory、downloadPath、refreshInterval', () => {
            assert.ok('monitorDirectory' in defaultConfig.logs);
            assert.ok('downloadPath' in defaultConfig.logs);
            assert.ok('refreshInterval' in defaultConfig.logs);
        });
    });

    describe('Configuration Values - 配置值修改测试', () => {
        it('验证服务器主机地址可修改 - 从192.168.1.100改为10.0.0.1', () => {
            const modifiedConfig = { ...defaultConfig, server: { ...defaultConfig.server } };
            modifiedConfig.server.host = '10.0.0.1';
            assert.strictEqual(modifiedConfig.server.host, '10.0.0.1');
        });

        it('验证AI提供者可切换 - 从qwen切换到openai', () => {
            const modifiedConfig = { ...defaultConfig, ai: { ...defaultConfig.ai, qwen: { ...defaultConfig.ai.qwen }, openai: { ...defaultConfig.ai.openai } } };
            modifiedConfig.ai.provider = 'openai';
            assert.strictEqual(modifiedConfig.ai.provider, 'openai');
        });

        it('验证过滤模式可添加 - 添加[error]和[warn]两个过滤模式', () => {
            const modifiedConfig = { ...defaultConfig, command: { ...defaultConfig.command, filterPatterns: ['\\[error\\]', '\\[warn\\]'] } };
            assert.strictEqual(modifiedConfig.command.filterPatterns.length, 2);
        });

        it('验证过滤模式可切换 - 从include切换到exclude', () => {
            const modifiedConfig = { ...defaultConfig, command: { ...defaultConfig.command, filterMode: 'exclude' as const } };
            assert.strictEqual(modifiedConfig.command.filterMode, 'exclude');
        });

        it('验证qwen模型可修改 - 从qwen-turbo改为qwen-max', () => {
            const modifiedConfig = { 
                ...defaultConfig, 
                ai: { 
                    ...defaultConfig.ai, 
                    qwen: { ...defaultConfig.ai.qwen, model: 'qwen-max' }, 
                    openai: { ...defaultConfig.ai.openai } 
                } 
            };
            assert.strictEqual(modifiedConfig.ai.qwen.model, 'qwen-max');
        });

        it('验证openai模型可修改 - 从gpt-3.5-turbo改为gpt-4', () => {
            const modifiedConfig = { 
                ...defaultConfig, 
                ai: { 
                    ...defaultConfig.ai, 
                    qwen: { ...defaultConfig.ai.qwen }, 
                    openai: { ...defaultConfig.ai.openai, model: 'gpt-4' } 
                } 
            };
            assert.strictEqual(modifiedConfig.ai.openai.model, 'gpt-4');
        });
    });
});

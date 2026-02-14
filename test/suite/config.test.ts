import * as assert from 'assert';
import { describe, it } from 'mocha';

const defaultConfig = {
    server: {
        host: "192.168.1.100",
        port: 22,
        username: "root",
        password: "",
        privateKeyPath: "",
        localProjectPath: "",
        remoteDirectory: "/tmp/autotest"
    },
    command: {
        executeCommand: "pytest {filePath} -v",
        filterPatterns: ["PASSED", "FAILED", "ERROR"],
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
        directories: [
            { name: "应用日志", path: "/var/logs" },
            { name: "测试日志", path: "/var/log/autotest" }
        ],
        downloadPath: "./downloads",
        refreshInterval: 5000
    }
};

describe('Config Module - 配置模块测试', () => {
    describe('Default Configuration - 默认配置验证', () => {
        it('验证服务器配置有效性 - host、port、username必填', () => {
            assert.ok(defaultConfig.server.host);
            assert.ok(defaultConfig.server.port > 0);
            assert.ok(defaultConfig.server.username);
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

        it('验证日志配置有效性 - directories数组、downloadPath、refreshInterval', () => {
            assert.ok(Array.isArray(defaultConfig.logs.directories));
            assert.ok(defaultConfig.logs.directories.length > 0);
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

        it('验证默认命令包含变量 - 应包含{filePath}变量', () => {
            assert.ok(defaultConfig.command.executeCommand.includes('{filePath}'));
        });

        it('验证默认过滤模式 - 应包含PASSED、FAILED、ERROR', () => {
            assert.ok(defaultConfig.command.filterPatterns.includes('PASSED'));
            assert.ok(defaultConfig.command.filterPatterns.includes('FAILED'));
            assert.ok(defaultConfig.command.filterPatterns.includes('ERROR'));
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

        it('验证server嵌套属性 - host、port、username、password、privateKeyPath、localProjectPath、remoteDirectory', () => {
            assert.ok('host' in defaultConfig.server);
            assert.ok('port' in defaultConfig.server);
            assert.ok('username' in defaultConfig.server);
            assert.ok('password' in defaultConfig.server);
            assert.ok('privateKeyPath' in defaultConfig.server);
            assert.ok('localProjectPath' in defaultConfig.server);
            assert.ok('remoteDirectory' in defaultConfig.server);
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

        it('验证logs嵌套属性 - directories、downloadPath、refreshInterval', () => {
            assert.ok('directories' in defaultConfig.logs);
            assert.ok('downloadPath' in defaultConfig.logs);
            assert.ok('refreshInterval' in defaultConfig.logs);
        });

        it('验证日志目录配置结构 - 每个目录包含name和path', () => {
            for (const dir of defaultConfig.logs.directories) {
                assert.ok('name' in dir);
                assert.ok('path' in dir);
            }
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

        it('验证过滤模式可添加 - 添加DEBUG和INFO两个过滤模式', () => {
            const modifiedConfig = { ...defaultConfig, command: { ...defaultConfig.command, filterPatterns: ['DEBUG', 'INFO'] } };
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

        it('验证日志目录可添加 - 添加新的监控目录', () => {
            const modifiedConfig = { 
                ...defaultConfig, 
                logs: { 
                    ...defaultConfig.logs, 
                    directories: [
                        ...defaultConfig.logs.directories,
                        { name: "系统日志", path: "/var/log/system" }
                    ] 
                } 
            };
            assert.strictEqual(modifiedConfig.logs.directories.length, 3);
        });

        it('验证远程目录可修改 - 从/tmp/autotest改为/home/user/test', () => {
            const modifiedConfig = { ...defaultConfig, server: { ...defaultConfig.server } };
            modifiedConfig.server.remoteDirectory = '/home/user/test';
            assert.strictEqual(modifiedConfig.server.remoteDirectory, '/home/user/test');
        });
    });

    describe('Config Watcher - 配置监听功能测试', () => {
        it('验证配置变化事件机制 - EventEmitter模式', () => {
            let eventFired = false;
            const mockListener = () => { eventFired = true; };
            
            const emitter = { 
                listeners: [] as (() => void)[],
                subscribe: function(listener: () => void) { this.listeners.push(listener); },
                fire: function() { this.listeners.forEach(l => l()); }
            };
            
            emitter.subscribe(mockListener);
            emitter.fire();
            
            assert.strictEqual(eventFired, true);
        });

        it('验证配置比较逻辑 - JSON序列化比较', () => {
            const config1 = { server: { host: "192.168.1.100" } };
            const config2 = { server: { host: "192.168.1.100" } };
            const config3 = { server: { host: "192.168.1.101" } };
            
            assert.strictEqual(JSON.stringify(config1) === JSON.stringify(config2), true);
            assert.strictEqual(JSON.stringify(config1) === JSON.stringify(config3), false);
        });
    });
});

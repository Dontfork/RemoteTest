import * as assert from 'assert';
import { describe, it } from 'mocha';
import { validateConfig, fillMissingFields, ConfigValidationResult, MissingField } from '../../src/config/validator';

describe('Config Validator Module - 配置验证模块测试', () => {
    
    describe('必填字段验证 - Required Fields Validation', () => {
        
        it('验证空配置文件 - 缺少projects数组', () => {
            const config: any = {};
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.strictEqual(result.errors.length, 1);
            assert.ok(result.errors[0].includes('projects'));
        });

        it('验证空projects数组 - 正确但给出警告', () => {
            const config: any = { projects: [] };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, true);
            assert.ok(result.warnings.some((w: string) => w.includes('projects') && w.includes('空')));
        });

        it('验证工程缺少name字段', () => {
            const config: any = {
                projects: [{
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('name')));
            assert.ok(result.missingFields.some((m: MissingField) => m.field === 'name'));
        });

        it('验证工程缺少localPath字段', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('localPath')));
        });

        it('验证工程缺少server配置', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project'
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('server')));
        });

        it('验证server缺少host字段', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('host')));
        });

        it('验证server缺少username字段', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('username')));
        });

        it('验证server缺少remoteDirectory字段', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('remoteDirectory')));
        });
    });

    describe('认证方式验证 - Authentication Validation', () => {
        
        it('验证未配置认证方式 - 应给出警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: '',
                        privateKeyPath: '',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('认证方式')));
        });

        it('验证配置了password认证 - 无警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'mypassword',
                        privateKeyPath: '',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(!result.warnings.some((w: string) => w.includes('认证方式')));
        });

        it('验证配置了privateKeyPath认证 - 无警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: '',
                        privateKeyPath: '/path/to/key',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(!result.warnings.some((w: string) => w.includes('认证方式')));
        });
    });

    describe('AI配置验证 - AI Config Validation', () => {
        
        it('验证缺少ai配置 - 应给出警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('ai')));
        });

        it('验证qwen缺少apiKey - 应给出警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }],
                ai: {
                    provider: 'qwen',
                    qwen: { apiKey: '' },
                    openai: { apiKey: '' }
                }
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('QWen') && w.includes('apiKey')));
        });

        it('验证openai缺少apiKey - 应给出警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }],
                ai: {
                    provider: 'openai',
                    qwen: { apiKey: '' },
                    openai: { apiKey: '' }
                }
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('OpenAI') && w.includes('apiKey')));
        });
    });

    describe('命令和日志配置验证 - Commands and Logs Validation', () => {
        
        it('验证未配置commands - 应给出警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('命令')));
        });

        it('验证未配置logs - 应给出警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    },
                    commands: [{ name: 'test', executeCommand: 'pytest' }]
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('日志')));
        });
    });

    describe('完整配置验证 - Complete Config Validation', () => {
        
        it('验证完整正确的配置 - 无错误无警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        privateKeyPath: '',
                        remoteDirectory: '/home/user'
                    },
                    commands: [{ name: 'test', executeCommand: 'pytest' }],
                    logs: {
                        directories: [{ name: 'app', path: '/var/log' }],
                        downloadPath: '/tmp/logs'
                    }
                }],
                ai: {
                    provider: 'qwen',
                    qwen: { apiKey: 'test-key' },
                    openai: { apiKey: '' }
                },
                refreshInterval: 5000
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.errors.length, 0);
        });
    });

    describe('缺失字段填充 - Fill Missing Fields', () => {
        
        it('填充缺失的name字段 - 通过validateConfig获取missingFields', () => {
            const config: any = {
                projects: [{
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            const filled = fillMissingFields(config, result.missingFields);
            
            assert.strictEqual(filled.projects[0].name, '未命名工程');
        });

        it('填充缺失的server配置 - 通过validateConfig获取missingFields', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project'
                }]
            };
            const result = validateConfig(config);
            const filled = fillMissingFields(config, result.missingFields);
            
            assert.ok(filled.projects[0].server);
            assert.strictEqual(filled.projects[0].server.port, 22);
        });

        it('填充缺失的ai配置', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const missingFields: MissingField[] = [];
            
            const filled = fillMissingFields(config, missingFields);
            
            assert.ok(filled.ai);
            assert.strictEqual(filled.ai.provider, 'qwen');
        });

        it('填充缺失的refreshInterval', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const missingFields: MissingField[] = [];
            
            const filled = fillMissingFields(config, missingFields);
            
            assert.strictEqual(filled.refreshInterval, 0);
        });

        it('填充缺失的commands', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const missingFields: MissingField[] = [];
            
            const filled = fillMissingFields(config, missingFields);
            
            assert.ok(filled.projects[0].commands);
            assert.strictEqual(filled.projects[0].commands.length, 1);
            assert.strictEqual(filled.projects[0].commands[0].name, '默认命令');
        });

        it('填充缺失的logs配置', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const missingFields: MissingField[] = [];
            
            const filled = fillMissingFields(config, missingFields);
            
            assert.ok(filled.projects[0].logs);
            assert.ok(filled.projects[0].logs.directories);
            assert.strictEqual(filled.projects[0].logs.directories.length, 0);
        });

        it('填充缺失的enabled字段', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const missingFields: MissingField[] = [];
            
            const filled = fillMissingFields(config, missingFields);
            
            assert.strictEqual(filled.projects[0].enabled, true);
        });
    });

    describe('多工程配置验证 - Multiple Projects Validation', () => {
        
        it('验证多个工程的配置', () => {
            const config: any = {
                projects: [
                    {
                        name: 'Project1',
                        localPath: '/path/to/project1',
                        server: {
                            host: '192.168.1.1',
                            port: 22,
                            username: 'user1',
                            password: 'pass1',
                            remoteDirectory: '/home/user1'
                        }
                    },
                    {
                        name: 'Project2',
                        localPath: '/path/to/project2',
                        server: {
                            host: '192.168.1.2',
                            port: 22,
                            username: 'user2',
                            password: 'pass2',
                            remoteDirectory: '/home/user2'
                        }
                    }
                ]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, true);
        });

        it('验证多个工程中部分缺少必填字段', () => {
            const config: any = {
                projects: [
                    {
                        name: 'Project1',
                        localPath: '/path/to/project1',
                        server: {
                            host: '192.168.1.1',
                            port: 22,
                            username: 'user1',
                            password: 'pass1',
                            remoteDirectory: '/home/user1'
                        }
                    },
                    {
                        localPath: '/path/to/project2'
                    }
                ]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('工程 2') && e.includes('name')));
        });
    });

    describe('无效配置内容验证 - Invalid Content Validation', () => {
        
        it('验证无效的refreshInterval类型 - 应报错', () => {
            const config: any = {
                refreshInterval: 'invalid',
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('refreshInterval') && e.includes('数字类型')));
        });

        it('验证负数的refreshInterval - 应报错', () => {
            const config: any = {
                refreshInterval: -100,
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('refreshInterval') && e.includes('负数')));
        });

        it('验证无效的端口号 - 应报错', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 99999,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('port') && e.includes('有效的端口号')));
        });

        it('验证非数字的端口号 - 应报错', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: '22',
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('port')));
        });

        it('验证无效的AI provider - 应报错', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }],
                ai: {
                    provider: 'invalid_provider'
                }
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('provider') && e.includes('qwen') && e.includes('openai')));
        });

        it('验证无效的URL格式 - 应警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }],
                ai: {
                    provider: 'qwen',
                    qwen: {
                        apiKey: 'test-key',
                        apiUrl: 'not-a-valid-url'
                    }
                }
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('apiUrl') && w.includes('有效的 URL')));
        });

        it('验证命令缺少executeCommand - 应报错', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    },
                    commands: [
                        { name: 'TestCmd' }
                    ]
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('executeCommand')));
        });

        it('验证命令的runnable类型错误 - 应报错', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    },
                    commands: [
                        { name: 'TestCmd', executeCommand: 'echo test', runnable: 'yes' }
                    ]
                }]
            };
            const result = validateConfig(config);
            
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some((e: string) => e.includes('runnable') && e.includes('布尔值')));
        });

        it('验证无效的IP地址格式 - 应警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '999.999.999.999',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('host') && w.includes('有效的 IP')));
        });

        it('验证enabled字段类型错误 - 应警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    },
                    enabled: 'yes'
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('enabled') && w.includes('布尔值')));
        });

        it('验证includePatterns类型错误 - 应警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    },
                    commands: [{
                        name: 'TestCmd',
                        executeCommand: 'echo test',
                        includePatterns: 'not-an-array'
                    }]
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('includePatterns') && w.includes('数组')));
        });

        it('验证日志目录缺少path字段 - 应警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    },
                    logs: {
                        directories: [
                            { name: 'TestLog' }
                        ]
                    }
                }]
            };
            const result = validateConfig(config);
            
            assert.ok(result.warnings.some((w: string) => w.includes('日志目录') && w.includes('path')));
        });

        it('验证未知字段检测 - 应警告', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user',
                        unknownField: 'value'
                    },
                    commands: [{
                        name: 'TestCmd',
                        executeCommand: 'echo test',
                        unknownCmdField: 'value'
                    }],
                    unknownProjectField: 'value'
                }],
                unknownRootField: 'value'
            };
            const result = validateConfig(config);
            
            assert.ok(result.unknownKeys.length > 0);
            assert.ok(result.unknownKeys.some((k: string) => k.includes('unknownRootField')));
            assert.ok(result.unknownKeys.some((k: string) => k.includes('unknownProjectField')));
            assert.ok(result.unknownKeys.some((k: string) => k.includes('unknownField')));
            assert.ok(result.unknownKeys.some((k: string) => k.includes('unknownCmdField')));
            assert.ok(result.warnings.some((w: string) => w.includes('未知字段')));
        });
    });
});

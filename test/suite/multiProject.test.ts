import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as path from 'path';

interface ServerConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    privateKeyPath: string;
    remoteDirectory: string;
}

interface CommandConfig {
    name: string;
    executeCommand: string;
    filterPatterns: string[];
    filterMode: 'include' | 'exclude';
}

interface ProjectLogsConfig {
    directories: { name: string; path: string; }[];
    downloadPath: string;
}

interface ProjectConfig {
    name: string;
    localPath: string;
    enabled: boolean;
    server: ServerConfig;
    commands: CommandConfig[];
    logs?: ProjectLogsConfig;
}

interface AIConfig {
    provider: 'qwen' | 'openai';
    qwen: {
        apiKey: string;
        apiUrl: string;
        model: string;
    };
    openai: {
        apiKey: string;
        apiUrl: string;
        model: string;
    };
}

interface RemoteTestConfig {
    projects: ProjectConfig[];
    ai: AIConfig;
    refreshInterval?: number;
}

function normalizePath(p: string): string {
    return p.replace(/\\/g, '/').toLowerCase();
}

function checkPathConflict(projects: ProjectConfig[]): { hasConflict: boolean; conflicts: string[] } {
    const conflicts: string[] = [];
    const enabledProjects: ProjectConfig[] = [];
    
    for (const project of projects) {
        if (!project.localPath) {
            continue;
        }
        
        const normalizedPath = normalizePath(project.localPath);
        
        for (const existing of enabledProjects) {
            const existingPath = normalizePath(existing.localPath);
            
            if (normalizedPath.startsWith(existingPath + '/') || 
                existingPath.startsWith(normalizedPath + '/')) {
                conflicts.push(`工程 "${project.name}" (${project.localPath}) 与工程 "${existing.name}" (${existing.localPath}) 存在路径包含关系`);
                project.enabled = false;
                break;
            }
        }
        
        if (project.enabled !== false) {
            enabledProjects.push(project);
        }
    }
    
    return { hasConflict: conflicts.length > 0, conflicts };
}

function matchProject(localFilePath: string, projects: ProjectConfig[]): ProjectConfig | null {
    const normalizedFilePath = normalizePath(localFilePath);
    
    const enabledProjects = projects.filter(p => p.enabled !== false);
    
    let bestMatch: ProjectConfig | null = null;
    let bestMatchLength = 0;
    
    for (const project of enabledProjects) {
        if (!project.localPath) {
            continue;
        }
        
        const normalizedProjectPath = normalizePath(project.localPath);
        
        if (normalizedFilePath.startsWith(normalizedProjectPath + '/') || 
            normalizedFilePath === normalizedProjectPath) {
            if (normalizedProjectPath.length > bestMatchLength) {
                bestMatch = project;
                bestMatchLength = normalizedProjectPath.length;
            }
        }
    }
    
    return bestMatch;
}

describe('Multi-Project Configuration - 多工程配置测试', () => {
    describe('ProjectConfig - 工程配置接口', () => {
        it('验证ProjectConfig接口包含所有必需属性', () => {
            const project: ProjectConfig = {
                name: '项目A',
                localPath: 'D:\\projectA',
                enabled: true,
                server: {
                    host: '192.168.1.100',
                    port: 22,
                    username: 'root',
                    password: '',
                    privateKeyPath: '',
                    remoteDirectory: '/tmp/projectA'
                },
                commands: [
                    {
                        name: '运行测试',
                        executeCommand: 'pytest {filePath} -v',
                        filterPatterns: ['ERROR', 'FAILED'],
                        filterMode: 'include'
                    }
                ]
            };
            
            assert.strictEqual(project.name, '项目A');
            assert.strictEqual(project.localPath, 'D:\\projectA');
            assert.strictEqual(project.enabled, true);
            assert.ok(project.server);
            assert.ok(Array.isArray(project.commands));
        });

        it('验证多命令配置 - 支持多个命令选择', () => {
            const project: ProjectConfig = {
                name: '项目B',
                localPath: '/home/user/projectB',
                enabled: true,
                server: {
                    host: '192.168.1.200',
                    port: 22,
                    username: 'test',
                    password: 'password',
                    privateKeyPath: '',
                    remoteDirectory: '/home/test/projectB'
                },
                commands: [
                    {
                        name: '运行测试',
                        executeCommand: 'pytest {filePath} -v',
                        filterPatterns: ['ERROR'],
                        filterMode: 'include'
                    },
                    {
                        name: '运行覆盖率',
                        executeCommand: 'pytest {filePath} --cov',
                        filterPatterns: ['ERROR'],
                        filterMode: 'include'
                    }
                ]
            };
            
            assert.strictEqual(project.commands.length, 2);
            assert.strictEqual(project.commands[0].name, '运行测试');
            assert.strictEqual(project.commands[1].name, '运行覆盖率');
        });
    });

    describe('RemoteTestConfig - 多工程配置结构', () => {
        it('验证多工程配置结构 - 包含projects数组', () => {
            const config: RemoteTestConfig = {
                projects: [
                    {
                        name: '项目A',
                        localPath: 'D:\\projectA',
                        enabled: true,
                        server: {
                            host: '192.168.1.100',
                            port: 22,
                            username: 'root',
                            password: '',
                            privateKeyPath: '',
                            remoteDirectory: '/tmp/projectA'
                        },
                        commands: [
                            {
                                name: '运行测试',
                                executeCommand: 'pytest {filePath}',
                                filterPatterns: [],
                                filterMode: 'include'
                            }
                        ]
                    },
                    {
                        name: '项目B',
                        localPath: 'D:\\projectB',
                        enabled: true,
                        server: {
                            host: '192.168.1.200',
                            port: 22,
                            username: 'test',
                            password: '',
                            privateKeyPath: '',
                            remoteDirectory: '/tmp/projectB'
                        },
                        commands: [
                            {
                                name: '执行用例',
                                executeCommand: 'python {filePath}',
                                filterPatterns: [],
                                filterMode: 'include'
                            }
                        ]
                    }
                ],
                ai: {
                    provider: 'qwen',
                    qwen: { apiKey: '', apiUrl: '', model: 'qwen-turbo' },
                    openai: { apiKey: '', apiUrl: '', model: 'gpt-3.5-turbo' }
                },
                refreshInterval: 5000
            };
            
            assert.ok(Array.isArray(config.projects));
            assert.strictEqual(config.projects.length, 2);
            assert.strictEqual(config.projects[0].name, '项目A');
            assert.strictEqual(config.projects[1].name, '项目B');
            assert.strictEqual(config.refreshInterval, 5000);
        });
    });

    describe('Path Normalization - 路径规范化', () => {
        it('验证Windows路径规范化 - 反斜杠转正斜杠并转小写', () => {
            const windowsPath = 'D:\\project\\tests\\test.py';
            const normalized = normalizePath(windowsPath);
            
            assert.strictEqual(normalized, 'd:/project/tests/test.py');
            assert.ok(!normalized.includes('\\'));
        });

        it('验证POSIX路径规范化 - 保持不变', () => {
            const posixPath = '/home/user/project/test.py';
            const normalized = normalizePath(posixPath);
            
            assert.strictEqual(normalized, posixPath);
        });
    });

    describe('Path Matching - 路径匹配', () => {
        const projects: ProjectConfig[] = [
            {
                name: '项目A',
                localPath: 'D:\\projectA',
                enabled: true,
                server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectA' },
                commands: [{ name: '测试', executeCommand: 'pytest', filterPatterns: [], filterMode: 'include' }]
            },
            {
                name: '项目B',
                localPath: 'D:\\projectB',
                enabled: true,
                server: { host: '192.168.1.200', port: 22, username: 'test', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectB' },
                commands: [{ name: '测试', executeCommand: 'python', filterPatterns: [], filterMode: 'include' }]
            }
        ];

        it('验证路径匹配成功 - 匹配项目A', () => {
            const filePath = 'D:\\projectA\\tests\\test_example.py';
            const matched = matchProject(filePath, projects);
            
            assert.ok(matched);
            assert.strictEqual(matched.name, '项目A');
        });

        it('验证路径匹配成功 - 匹配项目B', () => {
            const filePath = 'D:\\projectB\\src\\main.py';
            const matched = matchProject(filePath, projects);
            
            assert.ok(matched);
            assert.strictEqual(matched.name, '项目B');
        });

        it('验证路径匹配失败 - 不匹配任何项目', () => {
            const filePath = 'D:\\otherProject\\test.py';
            const matched = matchProject(filePath, projects);
            
            assert.strictEqual(matched, null);
        });

        it('验证最长路径匹配 - 嵌套路径选择更精确的匹配', () => {
            const nestedProjects: ProjectConfig[] = [
                {
                    name: '父项目',
                    localPath: 'D:\\project',
                    enabled: true,
                    server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/project' },
                    commands: [{ name: '测试', executeCommand: 'pytest', filterPatterns: [], filterMode: 'include' }]
                },
                {
                    name: '子项目',
                    localPath: 'D:\\project\\subproject',
                    enabled: true,
                    server: { host: '192.168.1.200', port: 22, username: 'test', password: '', privateKeyPath: '', remoteDirectory: '/tmp/subproject' },
                    commands: [{ name: '测试', executeCommand: 'python', filterPatterns: [], filterMode: 'include' }]
                }
            ];
            
            const filePath = 'D:\\project\\subproject\\test.py';
            const matched = matchProject(filePath, nestedProjects);
            
            assert.ok(matched);
            assert.strictEqual(matched.name, '子项目');
        });

        it('验证禁用工程不参与匹配', () => {
            const disabledProjects: ProjectConfig[] = [
                {
                    name: '禁用项目',
                    localPath: 'D:\\projectA',
                    enabled: false,
                    server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectA' },
                    commands: [{ name: '测试', executeCommand: 'pytest', filterPatterns: [], filterMode: 'include' }]
                },
                {
                    name: '启用项目',
                    localPath: 'D:\\projectB',
                    enabled: true,
                    server: { host: '192.168.1.200', port: 22, username: 'test', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectB' },
                    commands: [{ name: '测试', executeCommand: 'python', filterPatterns: [], filterMode: 'include' }]
                }
            ];
            
            const filePath = 'D:\\projectA\\test.py';
            const matched = matchProject(filePath, disabledProjects);
            
            assert.strictEqual(matched, null);
        });
    });

    describe('Path Conflict Detection - 路径冲突检测', () => {
        it('验证无冲突配置 - 独立路径', () => {
            const projects: ProjectConfig[] = [
                {
                    name: '项目A',
                    localPath: 'D:\\projectA',
                    enabled: true,
                    server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectA' },
                    commands: []
                },
                {
                    name: '项目B',
                    localPath: 'D:\\projectB',
                    enabled: true,
                    server: { host: '192.168.1.200', port: 22, username: 'test', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectB' },
                    commands: []
                }
            ];
            
            const result = checkPathConflict(projects);
            
            assert.strictEqual(result.hasConflict, false);
            assert.strictEqual(result.conflicts.length, 0);
        });

        it('验证冲突检测 - 包含关系路径', () => {
            const projects: ProjectConfig[] = [
                {
                    name: '父项目',
                    localPath: 'D:\\project',
                    enabled: true,
                    server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/project' },
                    commands: []
                },
                {
                    name: '子项目',
                    localPath: 'D:\\project\\subproject',
                    enabled: true,
                    server: { host: '192.168.1.200', port: 22, username: 'test', password: '', privateKeyPath: '', remoteDirectory: '/tmp/subproject' },
                    commands: []
                }
            ];
            
            const result = checkPathConflict(projects);
            
            assert.strictEqual(result.hasConflict, true);
            assert.strictEqual(result.conflicts.length, 1);
            assert.ok(result.conflicts[0].includes('存在路径包含关系'));
        });

        it('验证冲突自动禁用 - 子项目被禁用', () => {
            const projects: ProjectConfig[] = [
                {
                    name: '父项目',
                    localPath: 'D:\\project',
                    enabled: true,
                    server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/project' },
                    commands: []
                },
                {
                    name: '子项目',
                    localPath: 'D:\\project\\subproject',
                    enabled: true,
                    server: { host: '192.168.1.200', port: 22, username: 'test', password: '', privateKeyPath: '', remoteDirectory: '/tmp/subproject' },
                    commands: []
                }
            ];
            
            checkPathConflict(projects);
            
            assert.strictEqual(projects[0].enabled, true);
            assert.strictEqual(projects[1].enabled, false);
        });

        it('验证POSIX路径冲突检测', () => {
            const projects: ProjectConfig[] = [
                {
                    name: '父项目',
                    localPath: '/home/user/project',
                    enabled: true,
                    server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/project' },
                    commands: []
                },
                {
                    name: '子项目',
                    localPath: '/home/user/project/subproject',
                    enabled: true,
                    server: { host: '192.168.1.200', port: 22, username: 'test', password: '', privateKeyPath: '', remoteDirectory: '/tmp/subproject' },
                    commands: []
                }
            ];
            
            const result = checkPathConflict(projects);
            
            assert.strictEqual(result.hasConflict, true);
        });
    });

    describe('Command Selection - 命令选择', () => {
        it('验证单命令配置 - 直接返回该命令', () => {
            const project: ProjectConfig = {
                name: '项目A',
                localPath: 'D:\\projectA',
                enabled: true,
                server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectA' },
                commands: [
                    {
                        name: '运行测试',
                        executeCommand: 'pytest {filePath} -v',
                        filterPatterns: ['ERROR'],
                        filterMode: 'include'
                    }
                ]
            };
            
            assert.strictEqual(project.commands.length, 1);
            assert.strictEqual(project.commands[0].name, '运行测试');
        });

        it('验证多命令配置 - 需要用户选择', () => {
            const project: ProjectConfig = {
                name: '项目B',
                localPath: 'D:\\projectB',
                enabled: true,
                server: { host: '192.168.1.200', port: 22, username: 'test', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectB' },
                commands: [
                    {
                        name: '运行测试',
                        executeCommand: 'pytest {filePath} -v',
                        filterPatterns: ['ERROR'],
                        filterMode: 'include'
                    },
                    {
                        name: '运行覆盖率',
                        executeCommand: 'pytest {filePath} --cov',
                        filterPatterns: ['ERROR'],
                        filterMode: 'include'
                    },
                    {
                        name: '运行性能测试',
                        executeCommand: 'pytest {filePath} --benchmark',
                        filterPatterns: ['ERROR'],
                        filterMode: 'include'
                    }
                ]
            };
            
            assert.strictEqual(project.commands.length, 3);
        });
    });

    describe('ServerConfig per Project - 每个工程独立服务器配置', () => {
        it('验证不同工程使用不同服务器', () => {
            const config: RemoteTestConfig = {
                projects: [
                    {
                        name: '开发环境',
                        localPath: 'D:\\dev',
                        enabled: true,
                        server: {
                            host: '192.168.1.100',
                            port: 22,
                            username: 'dev',
                            password: 'devpass',
                            privateKeyPath: '',
                            remoteDirectory: '/opt/dev'
                        },
                        commands: []
                    },
                    {
                        name: '测试环境',
                        localPath: 'D:\\test',
                        enabled: true,
                        server: {
                            host: '192.168.1.200',
                            port: 2222,
                            username: 'test',
                            password: '',
                            privateKeyPath: '/home/test/.ssh/id_rsa',
                            remoteDirectory: '/opt/test'
                        },
                        commands: []
                    }
                ],
                ai: {
                    provider: 'qwen',
                    qwen: { apiKey: '', apiUrl: '', model: 'qwen-turbo' },
                    openai: { apiKey: '', apiUrl: '', model: 'gpt-3.5-turbo' }
                },
                refreshInterval: 5000
            };
            
            assert.strictEqual(config.projects[0].server.host, '192.168.1.100');
            assert.strictEqual(config.projects[1].server.host, '192.168.1.200');
            assert.strictEqual(config.projects[0].server.username, 'dev');
            assert.strictEqual(config.projects[1].server.username, 'test');
            assert.strictEqual(config.projects[0].server.port, 22);
            assert.strictEqual(config.projects[1].server.port, 2222);
            assert.strictEqual(config.refreshInterval, 5000);
        });
    });

    describe('Case-Insensitive Path Matching - 大小写不敏感路径匹配', () => {
        it('验证Windows盘符大小写不敏感匹配 - 小写d匹配大写D', () => {
            const projects: ProjectConfig[] = [
                {
                    name: '项目A',
                    localPath: 'D:\\projectA',
                    enabled: true,
                    server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectA' },
                    commands: [{ name: '测试', executeCommand: 'pytest', filterPatterns: [], filterMode: 'include' }]
                }
            ];
            
            const filePath = 'd:\\projectA\\test.py';
            const matched = matchProject(filePath, projects);
            
            assert.ok(matched);
            assert.strictEqual(matched.name, '项目A');
        });

        it('验证Windows盘符大小写不敏感匹配 - 大写D匹配小写d', () => {
            const projects: ProjectConfig[] = [
                {
                    name: '项目B',
                    localPath: 'd:\\projectB',
                    enabled: true,
                    server: { host: '192.168.1.200', port: 22, username: 'test', password: '', privateKeyPath: '', remoteDirectory: '/tmp/projectB' },
                    commands: [{ name: '测试', executeCommand: 'python', filterPatterns: [], filterMode: 'include' }]
                }
            ];
            
            const filePath = 'D:\\projectB\\test.py';
            const matched = matchProject(filePath, projects);
            
            assert.ok(matched);
            assert.strictEqual(matched.name, '项目B');
        });

        it('验证路径包含空格时的大小写匹配', () => {
            const projects: ProjectConfig[] = [
                {
                    name: '测试项目',
                    localPath: 'D:\\code\\python\\AAAAAA',
                    enabled: true,
                    server: { host: '192.168.1.100', port: 22, username: 'root', password: '', privateKeyPath: '', remoteDirectory: '/tmp/test' },
                    commands: [{ name: '测试', executeCommand: 'pytest', filterPatterns: [], filterMode: 'include' }]
                }
            ];
            
            const filePath = 'd:\\code\\python\\AAAAAA\\ttt copy.txt';
            const matched = matchProject(filePath, projects);
            
            assert.ok(matched);
            assert.strictEqual(matched.name, '测试项目');
        });
    });
});

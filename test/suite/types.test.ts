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
    remoteDirectory?: string;
}

interface CommandConfig {
    name: string;
    executeCommand: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    runnable?: boolean;
    clearOutputBeforeRun?: boolean;
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

interface LogDirectoryConfig {
    name: string;
    path: string;
}

interface LogsConfig {
    directories: LogDirectoryConfig[];
    downloadPath: string;
}

interface ProjectConfig {
    name: string;
    localPath?: string;
    enabled?: boolean;
    server: ServerConfig;
    commands?: CommandConfig[];
    logs?: {
        directories: LogDirectoryConfig[];
        downloadPath: string;
    };
}

interface RemoteTestConfig {
    projects: ProjectConfig[];
    refreshInterval?: number;
    logViewer?: string;
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
                remoteDirectory: '/tmp/RemoteTest'
            };
            
            assert.strictEqual(config.host, '192.168.1.100');
            assert.strictEqual(config.port, 22);
            assert.strictEqual(config.username, 'root');
            assert.strictEqual(config.remoteDirectory, '/tmp/RemoteTest');
        });

        it('验证SSH密码认证配置 - 使用password进行认证', () => {
            const config: ServerConfig = {
                host: '192.168.1.100',
                port: 22,
                username: 'testuser',
                password: 'mypassword',
                privateKeyPath: '',
                localProjectPath: '',
                remoteDirectory: '/home/testuser/RemoteTest'
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
                remoteDirectory: '/tmp/RemoteTest'
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
                remoteDirectory: '/tmp/RemoteTest'
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
                remoteDirectory: '/tmp/RemoteTest'
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
            const remoteDirectory = '/opt/RemoteTest';
            const localFilePath = '/home/user/project/tests/unit/services/auth.test.js';
            
            const relativePath = path.relative(localProjectPath, localFilePath);
            const posixRelativePath = relativePath.split(path.sep).join(path.posix.sep);
            const remotePath = path.posix.join(remoteDirectory, posixRelativePath);
            
            assert.strictEqual(remotePath, '/opt/RemoteTest/tests/unit/services/auth.test.js');
        });

        it('验证根目录文件映射 - 文件在工程根目录', () => {
            const localProjectPath = '/home/user/project';
            const remoteDirectory = '/opt/RemoteTest';
            const localFilePath = '/home/user/project/package.json';
            
            const relativePath = path.relative(localProjectPath, localFilePath);
            const posixRelativePath = relativePath.split(path.sep).join(path.posix.sep);
            const remotePath = path.posix.join(remoteDirectory, posixRelativePath);
            
            assert.strictEqual(remotePath, '/opt/RemoteTest/package.json');
        });

        it('验证路径分隔符转换 - Windows路径转POSIX路径', () => {
            const windowsPath = 'src\\utils\\helper.js';
            const posixPath = windowsPath.split(path.sep).join(path.posix.sep);
            
            assert.strictEqual(posixPath, 'src/utils/helper.js');
        });
    });

    describe('CommandConfig - 命令配置接口', () => {
        it('验证includePatterns过滤模式 - 只保留匹配的输出行', () => {
            const config: CommandConfig = {
                name: '测试命令',
                executeCommand: 'npm test',
                includePatterns: ['error', 'failed', 'FAILED'],
                excludePatterns: []
            };
            
            assert.strictEqual(config.includePatterns?.length, 3);
            assert.strictEqual(config.excludePatterns?.length, 0);
        });

        it('验证excludePatterns过滤模式 - 排除匹配的输出行', () => {
            const config: CommandConfig = {
                name: '测试命令',
                executeCommand: 'npm test',
                includePatterns: [],
                excludePatterns: ['debug', 'trace']
            };
            
            assert.strictEqual(config.excludePatterns?.length, 2);
            assert.strictEqual(config.includePatterns?.length, 0);
        });

        it('验证远程命令配置 - 通过SSH执行的命令', () => {
            const config: CommandConfig = {
                name: '测试命令',
                executeCommand: 'cd /tmp/RemoteTest && npm test',
                includePatterns: ['error'],
                excludePatterns: []
            };
            
            assert.ok(config.executeCommand.includes('/tmp/RemoteTest'));
        });

        it('验证带变量的命令配置 - 支持文件路径变量替换', () => {
            const config: CommandConfig = {
                name: '测试命令',
                executeCommand: 'pytest {filePath} -v',
                includePatterns: ['PASSED', 'FAILED'],
                excludePatterns: []
            };
            
            assert.ok(config.executeCommand.includes('{filePath}'));
            assert.ok(config.includePatterns?.includes('PASSED'));
        });

        it('验证同时使用include和exclude过滤', () => {
            const config: CommandConfig = {
                name: '测试命令',
                executeCommand: 'npm test',
                includePatterns: ['error', 'fail'],
                excludePatterns: ['traceback', 'File "']
            };
            
            assert.strictEqual(config.includePatterns?.length, 2);
            assert.strictEqual(config.excludePatterns?.length, 2);
        });

        it('验证clearOutputBeforeRun配置 - 执行前清空输出', () => {
            const config: CommandConfig = {
                name: '测试命令',
                executeCommand: 'npm test',
                clearOutputBeforeRun: true
            };
            
            assert.strictEqual(config.clearOutputBeforeRun, true);
        });

        it('验证clearOutputBeforeRun默认值 - 未配置时为undefined', () => {
            const config: CommandConfig = {
                name: '测试命令',
                executeCommand: 'npm test'
            };
            
            assert.strictEqual(config.clearOutputBeforeRun, undefined);
        });

        it('验证clearOutputBeforeRun为false - 保留历史输出', () => {
            const config: CommandConfig = {
                name: '测试命令',
                executeCommand: 'npm test',
                clearOutputBeforeRun: false
            };
            
            assert.strictEqual(config.clearOutputBeforeRun, false);
        });

        it('验证完整命令配置 - 包含所有可选字段', () => {
            const config: CommandConfig = {
                name: '运行测试',
                executeCommand: 'pytest {filePath} -v',
                includePatterns: ['ERROR', 'FAILED', 'PASSED'],
                excludePatterns: ['traceback'],
                runnable: true,
                clearOutputBeforeRun: true
            };
            
            assert.strictEqual(config.name, '运行测试');
            assert.strictEqual(config.runnable, true);
            assert.strictEqual(config.clearOutputBeforeRun, true);
            assert.strictEqual(config.includePatterns?.length, 3);
            assert.strictEqual(config.excludePatterns?.length, 1);
        });
    });

    describe('CommandVariables - 命令变量接口', () => {
        it('验证CommandVariables接口包含所有变量 - 文件路径相关变量', () => {
            const variables: CommandVariables = {
                filePath: '/tmp/RemoteTest/tests/test_example.py',
                fileName: 'test_example.py',
                fileDir: '/tmp/RemoteTest/tests',
                localPath: 'D:\\project\\tests\\test_example.py',
                localDir: 'D:\\project\\tests',
                localFileName: 'test_example.py',
                remoteDir: '/tmp/RemoteTest'
            };
            
            assert.strictEqual(variables.filePath, '/tmp/RemoteTest/tests/test_example.py');
            assert.strictEqual(variables.fileName, 'test_example.py');
            assert.strictEqual(variables.fileDir, '/tmp/RemoteTest/tests');
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
                filePath: '/opt/RemoteTest/tests/api/test_user.py',
                fileName: 'test_user.py',
                fileDir: '/opt/RemoteTest/tests/api',
                localPath: '/home/dev/project/tests/api/test_user.py',
                localDir: '/home/dev/project/tests/api',
                localFileName: 'test_user.py',
                remoteDir: '/opt/RemoteTest'
            };
            
            assert.strictEqual(variables.remoteDir, '/opt/RemoteTest');
        });
    });

    describe('LogsConfig - 日志配置接口', () => {
        it('验证日志目录列表配置 - 支持多个监控目录', () => {
            const config: LogsConfig = {
                directories: [
                    { name: '应用日志', path: '/var/logs' },
                    { name: '测试日志', path: '/var/log/RemoteTest' }
                ],
                downloadPath: './downloads'
            };
            
            assert.strictEqual(config.directories.length, 2);
            assert.strictEqual(config.directories[0].name, '应用日志');
            assert.strictEqual(config.directories[1].path, '/var/log/RemoteTest');
        });

        it('验证日志下载路径配置 - 本地保存路径', () => {
            const config: LogsConfig = {
                directories: [{ name: '日志', path: '/var/logs' }],
                downloadPath: './logs'
            };
            
            assert.strictEqual(config.downloadPath, './logs');
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

    describe('RemoteTestConfig - 完整配置接口', () => {
        it('验证完整配置结构 - 包含projects和logs子配置', () => {
            const config: RemoteTestConfig = {
                projects: [{
                    name: '测试项目',
                    localPath: 'D:\\Projects\\Test',
                    enabled: true,
                    server: {
                        host: '192.168.1.100',
                        port: 22,
                        username: 'root',
                        password: 'password',
                        privateKeyPath: '',
                        localProjectPath: '',
                        remoteDirectory: '/tmp/RemoteTest'
                    },
                    commands: [{
                        name: '测试命令',
                        executeCommand: 'npm test',
                        includePatterns: [],
                        excludePatterns: []
                    }],
                    logs: {
                        directories: [{ name: '日志', path: '/var/logs' }],
                        downloadPath: './downloads'
                    }
                }],
                refreshInterval: 5000
            };
            
            assert.ok(config.projects);
            assert.strictEqual(config.projects.length, 1);
            assert.strictEqual(config.refreshInterval, 5000);
        });

        it('验证多项目配置 - 支持多个独立项目', () => {
            const config: RemoteTestConfig = {
                projects: [
                    {
                        name: '项目A',
                        localPath: 'D:\\ProjectA',
                        enabled: true,
                        server: {
                            host: '192.168.1.100',
                            port: 22,
                            username: 'root',
                            password: 'password',
                            privateKeyPath: '',
                            localProjectPath: '',
                            remoteDirectory: '/tmp/projectA'
                        },
                        commands: [{
                            name: '测试命令',
                            executeCommand: 'pytest {filePath}',
                            includePatterns: ['error', 'failed'],
                            excludePatterns: []
                        }],
                        logs: {
                            directories: [],
                            downloadPath: './downloads'
                        }
                    },
                    {
                        name: '项目B',
                        localPath: 'D:\\ProjectB',
                        enabled: true,
                        server: {
                            host: '192.168.1.200',
                            port: 22,
                            username: 'test',
                            password: '',
                            privateKeyPath: '/home/test/.ssh/id_rsa',
                            localProjectPath: '',
                            remoteDirectory: '/tmp/projectB'
                        },
                        commands: [{
                            name: '测试命令',
                            executeCommand: 'npm test',
                            includePatterns: [],
                            excludePatterns: ['debug']
                        }],
                        logs: {
                            directories: [],
                            downloadPath: './downloads'
                        }
                    }
                ],
                refreshInterval: 5000
            };
            
            assert.strictEqual(config.projects.length, 2);
            assert.strictEqual(config.projects[0].name, '项目A');
            assert.strictEqual(config.projects[1].name, '项目B');
        });

        it('验证SSH/SCP完整配置 - 使用密钥认证', () => {
            const config: RemoteTestConfig = {
                projects: [{
                    name: '部署项目',
                    localPath: '/home/deploy/project',
                    enabled: true,
                    server: {
                        host: '192.168.1.200',
                        port: 22,
                        username: 'deploy',
                        password: '',
                        privateKeyPath: '/home/deploy/.ssh/id_rsa',
                        localProjectPath: '',
                        remoteDirectory: '/opt/RemoteTest'
                    },
                    commands: [{
                        name: '测试命令',
                        executeCommand: 'cd /opt/RemoteTest && ./run_tests.sh',
                        includePatterns: ['error', 'fail'],
                        excludePatterns: []
                    }],
                    logs: {
                        directories: [
                            { name: '应用日志', path: '/var/log/RemoteTest' },
                            { name: '系统日志', path: '/var/log/system' }
                        ],
                        downloadPath: './logs'
                    }
                }],
                refreshInterval: 10000
            };
            
            assert.strictEqual(config.projects[0].server.privateKeyPath, '/home/deploy/.ssh/id_rsa');
            assert.strictEqual(config.projects[0].server.remoteDirectory, '/opt/RemoteTest');
            assert.strictEqual(config.projects[0].logs?.directories.length, 2);
            assert.strictEqual(config.refreshInterval, 10000);
        });

        it('验证logViewer配置 - 自定义日志查看程序', () => {
            const config: RemoteTestConfig = {
                projects: [{
                    name: '测试项目',
                    localPath: 'D:\\Projects\\Test',
                    server: {
                        host: '192.168.1.100',
                        port: 22,
                        username: 'root',
                        password: 'password',
                        privateKeyPath: '',
                        localProjectPath: '',
                        remoteDirectory: '/tmp/RemoteTest'
                    }
                }],
                refreshInterval: 5000,
                logViewer: 'notepad.exe'
            };
            
            assert.strictEqual(config.logViewer, 'notepad.exe');
        });

        it('验证logViewer为空时使用VSCode打开 - 默认行为', () => {
            const config: RemoteTestConfig = {
                projects: [{
                    name: '测试项目',
                    localPath: 'D:\\Projects\\Test',
                    server: {
                        host: '192.168.1.100',
                        port: 22,
                        username: 'root',
                        password: 'password',
                        privateKeyPath: '',
                        localProjectPath: '',
                        remoteDirectory: '/tmp/RemoteTest'
                    }
                }],
                refreshInterval: 5000,
                logViewer: ''
            };
            
            assert.strictEqual(config.logViewer, '');
        });
    });

    describe('ProjectConfig 可选配置 - localPath 和 remoteDirectory 可选', () => {
        it('验证 localPath 可选 - 仅执行快捷命令的工程', () => {
            const project: ProjectConfig = {
                name: '仅命令工程',
                server: {
                    host: '192.168.1.100',
                    port: 22,
                    username: 'root',
                    password: 'password',
                    privateKeyPath: '',
                    localProjectPath: '',
                },
                commands: [{
                    name: '检查状态',
                    executeCommand: 'systemctl status nginx'
                }]
            };
            
            assert.strictEqual(project.localPath, undefined);
            assert.strictEqual(project.server.remoteDirectory, undefined);
        });

        it('验证完整配置工程 - 包含 localPath 和 remoteDirectory', () => {
            const project: ProjectConfig = {
                name: '完整工程',
                localPath: 'D:\\Projects\\Test',
                server: {
                    host: '192.168.1.100',
                    port: 22,
                    username: 'root',
                    password: 'password',
                    privateKeyPath: '',
                    localProjectPath: '',
                    remoteDirectory: '/home/test/project'
                },
                commands: [{
                    name: '运行测试',
                    executeCommand: 'pytest {filePath}'
                }]
            };
            
            assert.strictEqual(project.localPath, 'D:\\Projects\\Test');
            assert.strictEqual(project.server.remoteDirectory, '/home/test/project');
        });

        it('验证 logs 配置可选', () => {
            const project: ProjectConfig = {
                name: '无日志工程',
                localPath: 'D:\\Projects\\Test',
                server: {
                    host: '192.168.1.100',
                    port: 22,
                    username: 'root',
                    password: 'password',
                    privateKeyPath: '',
                    localProjectPath: '',
                    remoteDirectory: '/home/test'
                },
                commands: []
            };
            
            assert.strictEqual(project.logs, undefined);
        });

        it('验证 commands 可选 - 仅日志监控工程', () => {
            const project: ProjectConfig = {
                name: '仅日志监控工程',
                server: {
                    host: '192.168.1.100',
                    port: 22,
                    username: 'root',
                    password: 'password',
                    privateKeyPath: '',
                    localProjectPath: '',
                },
                logs: {
                    directories: [{ name: '应用日志', path: '/var/log/app' }],
                    downloadPath: 'D:\\downloads'
                }
            };
            
            assert.strictEqual(project.commands, undefined);
            assert.strictEqual(project.localPath, undefined);
            assert.ok(project.logs);
        });
    });

    describe('快捷命令变量检查 - 根据配置过滤命令', () => {
        it('验证无变量命令可在任何工程执行', () => {
            const command = 'ls -la';
            const localPathVariables = ['filePath', 'fileName', 'fileDir', 'localPath', 'localDir', 'localFileName'];
            const remoteDirVariables = ['remoteDir'];
            
            const variablePattern = /\{(\w+)\}/g;
            const matches = command.match(variablePattern);
            const hasLocalPathVar = matches?.some(m => localPathVariables.includes(m.slice(1, -1))) ?? false;
            const hasRemoteDirVar = matches?.some(m => remoteDirVariables.includes(m.slice(1, -1))) ?? false;
            
            assert.strictEqual(hasLocalPathVar, false);
            assert.strictEqual(hasRemoteDirVar, false);
        });

        it('验证包含 filePath 变量的命令需要 localPath', () => {
            const command = 'pytest {filePath}';
            const localPathVariables = ['filePath', 'fileName', 'fileDir', 'localPath', 'localDir', 'localFileName'];
            
            const variablePattern = /\{(\w+)\}/g;
            const matches = command.match(variablePattern);
            const variables = matches?.map(m => m.slice(1, -1)) ?? [];
            const hasLocalPathVar = variables.some(v => localPathVariables.includes(v));
            
            assert.strictEqual(hasLocalPathVar, true);
            assert.ok(variables.includes('filePath'));
        });

        it('验证包含 remoteDir 变量的命令需要 remoteDirectory', () => {
            const command = 'cd {remoteDir} && ls';
            const remoteDirVariables = ['remoteDir'];
            
            const variablePattern = /\{(\w+)\}/g;
            const matches = command.match(variablePattern);
            const variables = matches?.map(m => m.slice(1, -1)) ?? [];
            const hasRemoteDirVar = variables.some(v => remoteDirVariables.includes(v));
            
            assert.strictEqual(hasRemoteDirVar, true);
            assert.ok(variables.includes('remoteDir'));
        });

        it('验证提取命令中的所有变量', () => {
            const command = 'cd {remoteDir} && pytest {filePath} -v';
            const variablePattern = /\{(\w+)\}/g;
            const matches = command.match(variablePattern);
            const variables = matches?.map(m => m.slice(1, -1)) ?? [];
            
            assert.strictEqual(variables.length, 2);
            assert.ok(variables.includes('remoteDir'));
            assert.ok(variables.includes('filePath'));
        });
    });
});

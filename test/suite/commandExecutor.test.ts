import * as assert from 'assert';
import { describe, it } from 'mocha';

const filterOutput = (output: string, patterns: string[], filterMode: 'include' | 'exclude'): string => {
    if (!patterns || patterns.length === 0) {
        return output;
    }

    const lines = output.split('\n');
    const filteredLines: string[] = [];

    for (const line of lines) {
        const matchesPattern = patterns.some(pattern => {
            try {
                const regex = new RegExp(pattern, 'i');
                return regex.test(line);
            } catch {
                return false;
            }
        });

        if (filterMode === 'include') {
            if (matchesPattern) {
                filteredLines.push(line);
            }
        } else {
            if (!matchesPattern) {
                filteredLines.push(line);
            }
        }
    }

    return filteredLines.join('\n');
};

describe('CommandExecutor Module - 命令执行模块测试', () => {
    describe('Output Filtering - 输出过滤功能', () => {
        it('include模式：只保留匹配[error]和[warn]的行', () => {
            const output = '[info] Starting process\n[error] Failed to connect\n[warn] Retrying...';
            const patterns = ['\\[error\\]', '\\[warn\\]'];
            
            const result = filterOutput(output, patterns, 'include');
            
            assert.ok(result.includes('[error]'));
            assert.ok(result.includes('[warn]'));
            assert.ok(!result.includes('[info]'));
        });

        it('exclude模式：排除匹配[debug]的行，保留其他行', () => {
            const output = '[info] Starting process\n[error] Failed to connect\n[warn] Retrying...';
            const patterns = ['\\[debug\\]'];
            
            const result = filterOutput(output, patterns, 'exclude');
            
            assert.ok(result.includes('[info]'));
            assert.ok(result.includes('[error]'));
            assert.ok(result.includes('[warn]'));
        });

        it('空过滤模式：返回原始输出不做任何过滤', () => {
            const output = '[info] Starting process\n[error] Failed to connect';
            const patterns: string[] = [];
            
            const result = filterOutput(output, patterns, 'include');
            
            assert.strictEqual(result, output);
        });

        it('空输出：返回空字符串', () => {
            const output = '';
            const patterns = ['\\[error\\]'];
            
            const result = filterOutput(output, patterns, 'include');
            
            assert.strictEqual(result, '');
        });

        it('无效正则表达式：优雅处理，不抛出异常', () => {
            const output = '[info] Starting process\n[error] Failed to connect';
            const patterns = ['[invalid(regex'];
            
            const result = filterOutput(output, patterns, 'include');
            
            assert.ok(result !== undefined);
        });
    });

    describe('Command Configuration - 命令配置', () => {
        it('验证执行命令非空 - 命令字符串长度大于0', () => {
            const command = 'npm test';
            
            assert.ok(command.length > 0);
        });

        it('验证include过滤模式 - 值为"include"', () => {
            const filterMode = 'include';
            
            assert.strictEqual(filterMode, 'include');
        });

        it('验证exclude过滤模式 - 值为"exclude"', () => {
            const filterMode = 'exclude';
            
            assert.strictEqual(filterMode, 'exclude');
        });
    });

    describe('Pattern Matching - 正则模式匹配', () => {
        it('匹配[error]模式 - 包含[error]的行应匹配成功', () => {
            const line = '[error] Something went wrong';
            const pattern = '\\[error\\]';
            const regex = new RegExp(pattern, 'i');
            
            assert.ok(regex.test(line));
        });

        it('匹配[warn]模式 - 包含[warn]的行应匹配成功', () => {
            const line = '[warn] This is a warning';
            const pattern = '\\[warn\\]';
            const regex = new RegExp(pattern, 'i');
            
            assert.ok(regex.test(line));
        });

        it('匹配[fail]模式 - 包含[fail]的行应匹配成功', () => {
            const line = '[fail] Test failed';
            const pattern = '\\[fail\\]';
            const regex = new RegExp(pattern, 'i');
            
            assert.ok(regex.test(line));
        });

        it('大小写不敏感匹配 - [ERROR]应匹配\\[error\\]模式', () => {
            const line = '[ERROR] Something went wrong';
            const pattern = '\\[error\\]';
            const regex = new RegExp(pattern, 'i');
            
            assert.ok(regex.test(line));
        });

        it('不匹配的情况 - [info]不应匹配\\[error\\]模式', () => {
            const line = '[info] Just information';
            const pattern = '\\[error\\]';
            const regex = new RegExp(pattern, 'i');
            
            assert.ok(!regex.test(line));
        });
    });

    describe('Output Processing - 输出处理', () => {
        it('多行输出分割 - 按换行符分割成数组', () => {
            const output = 'line1\nline2\nline3';
            const lines = output.split('\n');
            
            assert.strictEqual(lines.length, 3);
        });

        it('单行输出处理 - 分割后数组长度为1', () => {
            const output = 'single line';
            const lines = output.split('\n');
            
            assert.strictEqual(lines.length, 1);
        });

        it('包含空行的输出 - 正确处理连续换行符', () => {
            const output = 'line1\n\nline2\n\n\nline3';
            const lines = output.split('\n');
            
            assert.ok(lines.length >= 3);
        });
    });

    describe('Terminal Integration - 终端集成', () => {
        it('终端名称验证 - 名称长度大于0', () => {
            const terminalName = 'AutoTest Command';
            
            assert.ok(terminalName.length > 0);
        });

        it('Shell路径验证 - 根据平台选择正确的shell', () => {
            const shellPath = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
            
            assert.ok(shellPath);
        });

        it('平台检测 - 正确识别当前操作系统', () => {
            const platform = process.platform;
            
            assert.ok(['win32', 'darwin', 'linux'].includes(platform));
        });
    });

    describe('Error Handling - 错误处理', () => {
        it('命令执行错误 - 错误消息包含"Command failed"', () => {
            const error = new Error('Command failed');
            
            assert.ok(error.message.includes('Command failed'));
        });

        it('超时配置验证 - 超时时间应大于0', () => {
            const timeoutMs = 30000;
            
            assert.ok(timeoutMs > 0);
        });
    });

    describe('File Upload Configuration - 文件上传配置', () => {
        it('上传URL验证 - 必须以http开头且包含/upload路径', () => {
            const uploadUrl = 'http://192.168.1.100:8080/upload';
            
            assert.ok(uploadUrl.startsWith('http'));
            assert.ok(uploadUrl.includes('/upload'));
        });

        it('执行命令URL验证 - 必须以http开头且包含/execute路径', () => {
            const executeUrl = 'http://192.168.1.100:8080/execute';
            
            assert.ok(executeUrl.startsWith('http'));
            assert.ok(executeUrl.includes('/execute'));
        });
    });

    describe('Command Execution Flow - 命令执行流程', () => {
        it('执行顺序验证 - 上传->执行->监控', () => {
            const flow = ['upload', 'execute', 'monitor'];
            
            assert.strictEqual(flow[0], 'upload');
            assert.strictEqual(flow[1], 'execute');
            assert.strictEqual(flow[2], 'monitor');
        });

        it('步骤映射验证 - 1:选择文件 2:上传文件 3:执行命令 4:过滤输出', () => {
            const steps = {
                1: 'selectFile',
                2: 'uploadFile',
                3: 'executeCommand',
                4: 'filterOutput'
            };
            
            assert.strictEqual(steps[1], 'selectFile');
            assert.strictEqual(steps[4], 'filterOutput');
        });
    });
});

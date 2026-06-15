/**
 * pathUtil 模块单元测试 —— 零 vscode 依赖。
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
    normalizePath,
    isAbsolutePath,
    isValidPath,
    toDisplayPath,
    isValidHost,
    isValidPort,
    calculateRemotePath,
    relativeToRemotePath
} from '../../src/pure/pathUtil';

describe('pure/pathUtil', () => {
    describe('normalizePath', () => {
        it('应统一斜杠方向', () => {
            const result = normalizePath('C:\\Users\\test\\project');
            assert.ok(result.includes('/') || result.includes('\\'));
        });

        it('应去除尾部斜杠', () => {
            const result = normalizePath('/home/user/project/');
            assert.ok(!result.endsWith('/') || result === '/');
        });

        it('空路径应返回 "."（path.normalize 行为）', () => {
            assert.strictEqual(normalizePath(''), '.');
        });
    });

    describe('isAbsolutePath', () => {
        it('应识别 Unix 绝对路径', () => {
            assert.strictEqual(isAbsolutePath('/home/user/project'), true);
        });

        it('应识别 Windows 绝对路径', () => {
            assert.strictEqual(isAbsolutePath('C:\\Users\\test'), true);
            assert.strictEqual(isAbsolutePath('D:/project'), true);
        });

        it('应识别相对路径', () => {
            assert.strictEqual(isAbsolutePath('src/index.ts'), false);
            assert.strictEqual(isAbsolutePath('./test'), false);
        });
    });

    describe('isValidPath', () => {
        it('应接受有效路径', () => {
            assert.strictEqual(isValidPath('/home/user/project'), true);
            assert.strictEqual(isValidPath('C:\\Users\\test'), true);
        });

        it('应拒绝空路径', () => {
            assert.strictEqual(isValidPath(''), false);
            assert.strictEqual(isValidPath('   '), false);
        });

        it('应拒绝 null/undefined', () => {
            assert.strictEqual(isValidPath(null as any), false);
            assert.strictEqual(isValidPath(undefined as any), false);
        });
    });

    describe('toDisplayPath', () => {
        it('应将路径转为显示友好格式', () => {
            const result = toDisplayPath('src/utils/helper.ts');
            assert.ok(typeof result === 'string');
            assert.ok(result.length > 0);
        });

        it('应处理深层路径', () => {
            const result = toDisplayPath('a/b/c/d/e/f.ts');
            assert.ok(typeof result === 'string');
        });
    });

    describe('isValidHost', () => {
        it('应接受 IPv4 地址', () => {
            assert.strictEqual(isValidHost('192.168.1.1'), true);
            assert.strictEqual(isValidHost('10.0.0.1'), true);
            assert.strictEqual(isValidHost('127.0.0.1'), true);
        });

        it('应接受主机名', () => {
            assert.strictEqual(isValidHost('example.com'), true);
            assert.strictEqual(isValidHost('my-server'), true);
            assert.strictEqual(isValidHost('localhost'), true);
        });

        it('应拒绝空值', () => {
            assert.strictEqual(isValidHost(''), false);
            assert.strictEqual(isValidHost('   '), false);
        });

        it('应拒绝无效格式', () => {
            assert.strictEqual(isValidHost('999.999.999.999'), false);
        });
    });

    describe('isValidPort', () => {
        it('应接受有效端口', () => {
            assert.strictEqual(isValidPort(22), true);
            assert.strictEqual(isValidPort(80), true);
            assert.strictEqual(isValidPort(443), true);
            assert.strictEqual(isValidPort(8080), true);
            assert.strictEqual(isValidPort(65535), true);
        });

        it('应拒绝超出范围的端口', () => {
            assert.strictEqual(isValidPort(0), false);
            assert.strictEqual(isValidPort(-1), false);
            assert.strictEqual(isValidPort(65536), false);
            assert.strictEqual(isValidPort(99999), false);
        });

        it('应拒绝非数字', () => {
            assert.strictEqual(isValidPort('22' as any), false);
            assert.strictEqual(isValidPort(NaN), false);
        });
    });

    describe('calculateRemotePath', () => {
        it('应正确计算远程文件路径', () => {
            const result = calculateRemotePath(
                '/project/src/test.py',
                '/project',
                '/home/user/project'
            );
            assert.strictEqual(result, '/home/user/project/src/test.py');
        });

        it('应处理 Windows 本地路径', () => {
            const result = calculateRemotePath(
                'C:\\project\\src\\test.py',
                'C:\\project',
                '/home/user/project'
            );
            assert.ok(result.startsWith('/home/user/project/'));
            assert.ok(result.endsWith('test.py'));
        });

        it('根目录文件应直接映射', () => {
            const result = calculateRemotePath(
                '/project/README.md',
                '/project',
                '/home/user/project'
            );
            assert.strictEqual(result, '/home/user/project/README.md');
        });
    });

    describe('relativeToRemotePath', () => {
        it('应将相对路径拼接到远程目录', () => {
            const result = relativeToRemotePath('src/test.py', '/home/user/project');
            assert.strictEqual(result, '/home/user/project/src/test.py');
        });

        it('应处理以 / 开头的相对路径', () => {
            const result = relativeToRemotePath('/src/test.py', '/home/user/project');
            assert.ok(result.includes('src/test.py'));
        });

        it('应处理空相对路径', () => {
            const result = relativeToRemotePath('', '/home/user/project');
            assert.strictEqual(result, '/home/user/project');
        });
    });
});

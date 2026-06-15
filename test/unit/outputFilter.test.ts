/**
 * outputFilter 模块单元测试 —— 零 vscode 依赖。
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
    stripAnsiEscapeCodes,
    matchPattern,
    filterCommandOutput,
    getLogLevel
} from '../../src/pure/outputFilter';

describe('pure/outputFilter', () => {
    describe('stripAnsiEscapeCodes', () => {
        it('应去除 ANSI 颜色码', () => {
            const input = '\u001b[31mError\u001b[0m: something failed';
            const result = stripAnsiEscapeCodes(input);
            assert.strictEqual(result, 'Error: something failed');
        });

        it('应去除多段 ANSI 码', () => {
            const input = '\u001b[1m\u001b[32mOK\u001b[0m \u001b[33mWARN\u001b[0m';
            const result = stripAnsiEscapeCodes(input);
            assert.strictEqual(result, 'OK WARN');
        });

        it('纯文本应保持不变', () => {
            const input = 'Hello World';
            assert.strictEqual(stripAnsiEscapeCodes(input), 'Hello World');
        });

        it('空字符串应返回空字符串', () => {
            assert.strictEqual(stripAnsiEscapeCodes(''), '');
        });

        it('应处理其他 ANSI 序列（只匹配颜色码）', () => {
            // stripAnsiEscapeCodes 只匹配 \x1b[...m 和 [...m 格式
            const input = 'line1\r\nline2';
            const result = stripAnsiEscapeCodes(input);
            assert.ok(!result.includes('\x1b['));
        });
    });

    describe('matchPattern', () => {
        it('简单字符串匹配（大小写不敏感）', () => {
            assert.strictEqual(matchPattern('This is an error message', 'error'), true);
            assert.strictEqual(matchPattern('Test FAILED', 'failed'), true);
            assert.strictEqual(matchPattern('No issues found', 'error'), false);
        });

        it('正则表达式匹配', () => {
            assert.strictEqual(matchPattern('[ERROR] Something went wrong', '\\[ERROR\\]'), true);
            assert.strictEqual(matchPattern('Test case passed', 'PASSED|FAILED'), true);
            assert.strictEqual(matchPattern('Running tests', 'PASSED|FAILED'), false);
        });

        it('无效正则表达式回退到字符串匹配', () => {
            assert.strictEqual(matchPattern('Test [invalid', '[invalid'), true);
        });
    });

    describe('filterCommandOutput', () => {
        const sampleOutput = `Running tests...
[INFO] Starting test suite
[ERROR] Connection failed
[DEBUG] Loading config
[INFO] Test 1 passed
[ERROR] Test 2 failed
[DEBUG] Cleaning up
All tests completed`;

        it('无过滤规则时返回原始输出', () => {
            const result = filterCommandOutput(sampleOutput, [], []);
            assert.strictEqual(result, sampleOutput);
        });

        it('includePatterns - 只保留匹配的行', () => {
            const result = filterCommandOutput(sampleOutput, ['ERROR'], []);
            const lines = result.split('\n').filter(l => l.trim());
            assert.strictEqual(lines.length, 2);
            assert.ok(lines.every(l => l.includes('[ERROR]')));
        });

        it('excludePatterns - 排除匹配的行', () => {
            const result = filterCommandOutput(sampleOutput, [], ['DEBUG']);
            const lines = result.split('\n').filter(l => l.trim());
            assert.ok(lines.every(l => !l.includes('[DEBUG]')));
        });

        it('同时使用 include 和 exclude', () => {
            const result = filterCommandOutput(sampleOutput, ['ERROR', 'INFO'], ['Test 2']);
            const lines = result.split('\n').filter(l => l.trim());
            assert.ok(lines.some(l => l.includes('[INFO]')));
            assert.ok(lines.some(l => l.includes('[ERROR] Connection')));
            assert.ok(!lines.some(l => l.includes('Test 2')));
        });

        it('空输出应返回空字符串', () => {
            assert.strictEqual(filterCommandOutput('', [], []), '');
        });
    });

    describe('getLogLevel', () => {
        it('识别 ERROR 级别', () => {
            assert.strictEqual(getLogLevel('[ERROR] something'), 'error');
            assert.strictEqual(getLogLevel('error: crash'), 'error');
            assert.strictEqual(getLogLevel('Task failed'), 'error');
        });

        it('识别 WARN 级别', () => {
            assert.strictEqual(getLogLevel('[WARN] something'), 'warn');
            assert.strictEqual(getLogLevel('WARNING: deprecated'), 'warn');
        });

        it('识别 INFO 级别', () => {
            assert.strictEqual(getLogLevel('[INFO] something'), 'info');
        });

        it('默认返回 info', () => {
            assert.strictEqual(getLogLevel('normal line'), 'info');
        });
    });
});

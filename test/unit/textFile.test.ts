/**
 * textFile 模块单元测试 —— 零 vscode 依赖。
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
    isTextFile,
    convertCrlfToLf,
    normalizeExtension,
    DEFAULT_TEXT_FILE_EXTENSIONS,
    DEFAULT_TEXT_FILE_NAMES
} from '../../src/pure/textFile';

describe('pure/textFile', () => {
    describe('normalizeExtension', () => {
        it('应规范化扩展名（加前缀点号）', () => {
            assert.strictEqual(normalizeExtension('py'), '.py');
            assert.strictEqual(normalizeExtension('.py'), '.py');
            assert.strictEqual(normalizeExtension('TS'), '.ts');
        });

        it('空字符串应返回 "."（空串被加上点前缀）', () => {
            assert.strictEqual(normalizeExtension(''), '.');
        });
    });

    describe('isTextFile', () => {
        it('应识别常见文本扩展名', () => {
            assert.strictEqual(isTextFile('test.py'), true);
            assert.strictEqual(isTextFile('app.js'), true);
            assert.strictEqual(isTextFile('style.css'), true);
            assert.strictEqual(isTextFile('README.md'), true);
            assert.strictEqual(isTextFile('config.json'), true);
            assert.strictEqual(isTextFile('data.xml'), true);
            assert.strictEqual(isTextFile('script.sh'), true);
        });

        it('应识别特殊文件名（大小写不敏感）', () => {
            assert.strictEqual(isTextFile('Makefile'), true);
            assert.strictEqual(isTextFile('Dockerfile'), true);
            assert.strictEqual(isTextFile('.gitignore'), true);
        });

        it('应识别二进制文件为非文本', () => {
            assert.strictEqual(isTextFile('image.png'), false);
            assert.strictEqual(isTextFile('archive.zip'), false);
            assert.strictEqual(isTextFile('video.mp4'), false);
            assert.strictEqual(isTextFile('data.bin'), false);
        });

        it('自定义扩展名应覆盖默认列表', () => {
            // .xyz 默认不在列表中
            assert.strictEqual(isTextFile('file.xyz', ['.xyz']), true);
        });

        it('应处理大小写不敏感', () => {
            assert.strictEqual(isTextFile('test.PY'), true);
            assert.strictEqual(isTextFile('app.JS'), true);
        });

        it('无扩展名非特殊文件名应判定为非文本', () => {
            assert.strictEqual(isTextFile('randomfile'), false);
        });
    });

    describe('convertCrlfToLf', () => {
        it('应将 CRLF 转换为 LF', () => {
            const input = Buffer.from('line1\r\nline2\r\nline3', 'utf8');
            const result = convertCrlfToLf(input).toString('utf8');
            assert.strictEqual(result, 'line1\nline2\nline3');
        });

        it('纯 LF 文本应保持不变', () => {
            const input = Buffer.from('line1\nline2\nline3', 'utf8');
            const result = convertCrlfToLf(input).toString('utf8');
            assert.strictEqual(result, 'line1\nline2\nline3');
        });

        it('混合换行符应只替换 CRLF', () => {
            const input = Buffer.from('line1\r\nline2\nline3\r\nline4', 'utf8');
            const result = convertCrlfToLf(input).toString('utf8');
            assert.strictEqual(result, 'line1\nline2\nline3\nline4');
        });

        it('空 Buffer 应返回空 Buffer', () => {
            const result = convertCrlfToLf(Buffer.from('', 'utf8'));
            assert.strictEqual(result.toString('utf8'), '');
        });

        it('无换行符的文本应保持不变', () => {
            const input = Buffer.from('hello world', 'utf8');
            const result = convertCrlfToLf(input).toString('utf8');
            assert.strictEqual(result, 'hello world');
        });
    });

    describe('DEFAULT_TEXT_FILE_EXTENSIONS', () => {
        it('应包含常见扩展名', () => {
            assert.ok(DEFAULT_TEXT_FILE_EXTENSIONS.includes('.py'));
            assert.ok(DEFAULT_TEXT_FILE_EXTENSIONS.includes('.js'));
            assert.ok(DEFAULT_TEXT_FILE_EXTENSIONS.includes('.ts'));
            assert.ok(DEFAULT_TEXT_FILE_EXTENSIONS.includes('.json'));
            assert.ok(DEFAULT_TEXT_FILE_EXTENSIONS.includes('.md'));
        });

        it('所有扩展名应以点号开头', () => {
            for (const ext of DEFAULT_TEXT_FILE_EXTENSIONS) {
                assert.ok(ext.startsWith('.'), `Extension "${ext}" should start with "."`);
            }
        });
    });

    describe('DEFAULT_TEXT_FILE_NAMES', () => {
        it('应包含常见特殊文件名（小写）', () => {
            assert.ok(DEFAULT_TEXT_FILE_NAMES.includes('makefile'));
            assert.ok(DEFAULT_TEXT_FILE_NAMES.includes('dockerfile'));
        });
    });
});

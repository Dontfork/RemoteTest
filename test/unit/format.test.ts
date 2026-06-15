/**
 * format 模块单元测试 —— 零 vscode 依赖。
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { formatSize, formatDate } from '../../src/pure/format';

describe('pure/format', () => {
    describe('formatSize', () => {
        it('应格式化字节', () => {
            const result = formatSize(500);
            assert.ok(result.includes('B') || result.includes('500'));
        });

        it('应格式化 KB', () => {
            const result = formatSize(1024);
            assert.ok(result.includes('K') || result.includes('k'));
        });

        it('应格式化 MB', () => {
            const result = formatSize(1024 * 1024);
            assert.ok(result.includes('M') || result.includes('m'));
        });

        it('应格式化 GB', () => {
            const result = formatSize(1024 * 1024 * 1024);
            assert.ok(result.includes('G') || result.includes('g'));
        });

        it('应处理 0 字节', () => {
            const result = formatSize(0);
            assert.ok(result.includes('0') || result.includes('B'));
        });

        it('应处理负值', () => {
            // 负值不应该崩溃
            const result = formatSize(-1);
            assert.ok(typeof result === 'string');
        });
    });

    describe('formatDate', () => {
        it('应格式化 Date 对象', () => {
            const date = new Date('2024-01-15T10:30:00');
            const result = formatDate(date);
            assert.ok(typeof result === 'string');
            assert.ok(result.length > 0);
        });

        it('应格式化时间戳', () => {
            const date = new Date('2024-06-15T14:00:00');
            const result = formatDate(date);
            assert.ok(typeof result === 'string');
            assert.ok(result.length > 0);
        });

        it('应处理当前时间', () => {
            const result = formatDate(new Date());
            assert.ok(typeof result === 'string');
        });
    });
});

/**
 * errors 模块单元测试 —— 零 vscode 依赖，可被普通 mocha 直接加载。
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { formatError, fullErrorMessage } from '../../src/pure/errors';

describe('pure/errors', () => {
    describe('formatError', () => {
        it('应处理 Error 对象', () => {
            const result = formatError(new Error('something broke'));
            assert.strictEqual(result, 'something broke');
        });

        it('应处理字符串', () => {
            const result = formatError('plain string error');
            assert.strictEqual(result, 'plain string error');
        });

        it('应处理数字', () => {
            const result = formatError(42);
            assert.strictEqual(result, '42');
        });

        it('应处理 null', () => {
            const result = formatError(null);
            assert.strictEqual(result, 'null');
        });

        it('应处理 undefined（JSON.stringify(undefined) 返回 undefined）', () => {
            const result = formatError(undefined);
            // JSON.stringify(undefined) returns undefined (not a string),
            // so formatError returns undefined; if the catch runs, returns "undefined"
            assert.ok(result === undefined || result === 'undefined');
        });

        it('应处理带 code 的 Error', () => {
            const err: any = new Error('ECONNREFUSED');
            err.code = 'ECONNREFUSED';
            const result = formatError(err);
            assert.ok(result.includes('ECONNREFUSED'));
        });

        it('应处理嵌套 cause', () => {
            const cause = new Error('root cause');
            const err: any = new Error('wrapper');
            err.cause = cause;
            const result = formatError(err);
            assert.ok(result.includes('wrapper'));
            assert.ok(result.includes('root cause'));
        });

        it('应处理普通对象', () => {
            const result = formatError({ message: 'obj error' });
            assert.ok(result.includes('obj error'));
        });
    });

    describe('fullErrorMessage', () => {
        it('应包含错误消息和堆栈', () => {
            const result = fullErrorMessage(new Error('test'));
            assert.ok(result.includes('test'));
            assert.ok(result.includes('--- 堆栈 ---'));
        });

        it('应处理自定义错误类型', () => {
            class CustomError extends Error {
                constructor(msg: string) {
                    super(msg);
                    this.name = 'CustomError';
                }
            }
            const result = fullErrorMessage(new CustomError('custom'));
            assert.ok(result.includes('custom'));
            assert.ok(result.includes('--- 堆栈 ---'));
        });

        it('非 Error 类型应委托给 formatError', () => {
            const result = fullErrorMessage('string error');
            assert.strictEqual(result, 'string error');
        });
    });
});

/**
 * CommandLock 单元测试 —— 零 vscode 依赖。
 */
import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import { CommandLock } from '../../src/services/CommandLock';

describe('services/CommandLock', () => {
    let lock: CommandLock;

    beforeEach(() => {
        lock = new CommandLock();
    });

    describe('初始状态', () => {
        it('应处于未锁定状态', () => {
            assert.strictEqual(lock.isExecuting(), false);
        });
    });

    describe('tryAcquire', () => {
        it('应成功获取锁', () => {
            assert.strictEqual(lock.tryAcquire(), true);
            assert.strictEqual(lock.isExecuting(), true);
        });

        it('重复获取应返回 false', () => {
            lock.tryAcquire();
            assert.strictEqual(lock.tryAcquire(), false);
        });
    });

    describe('release', () => {
        it('释放后应可再次获取', () => {
            lock.tryAcquire();
            lock.release();
            assert.strictEqual(lock.isExecuting(), false);
            assert.strictEqual(lock.tryAcquire(), true);
        });

        it('未锁定时释放不应报错', () => {
            lock.release(); // should not throw
            assert.strictEqual(lock.isExecuting(), false);
        });
    });

    describe('reset', () => {
        it('应强制重置为未锁定状态', () => {
            lock.tryAcquire();
            lock.reset();
            assert.strictEqual(lock.isExecuting(), false);
            assert.strictEqual(lock.tryAcquire(), true);
        });
    });

    describe('并发场景模拟', () => {
        it('获取 → 释放 → 再获取', () => {
            assert.strictEqual(lock.tryAcquire(), true);
            lock.release();
            assert.strictEqual(lock.tryAcquire(), true);
            lock.release();
            assert.strictEqual(lock.isExecuting(), false);
        });

        it('获取 → 再获取失败 → 释放 → 再获取成功', () => {
            assert.strictEqual(lock.tryAcquire(), true);
            assert.strictEqual(lock.tryAcquire(), false);
            lock.release();
            assert.strictEqual(lock.tryAcquire(), true);
        });
    });
});

/**
 * 命令执行锁（实例级，替代 sshClient.ts 的全局 isCommandExecuting）。
 *
 * 设计意图：全局锁无法在测试中重置，实例锁可以随服务一起创建/销毁。
 */
export class CommandLock {
    private locked: boolean = false;

    /** 当前是否有命令正在执行。 */
    isExecuting(): boolean {
        return this.locked;
    }

    /** 尝试获取锁，成功返回 true，已有命令执行中返回 false。 */
    tryAcquire(): boolean {
        if (this.locked) {
            return false;
        }
        this.locked = true;
        return true;
    }

    /** 释放锁。 */
    release(): void {
        this.locked = false;
    }

    /** 重置锁状态（仅测试使用）。 */
    reset(): void {
        this.locked = false;
    }
}

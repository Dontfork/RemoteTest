/**
 * 错误格式化（纯逻辑，不依赖 vscode）
 *
 * 从 core/sshClient.ts 抽出，便于单元测试。
 */

/**
 * 将任意错误对象格式化为可读字符串。
 *
 * 优先取 Error.message，并附带 cause；字符串直接返回；其余类型尝试 JSON 序列化。
 *
 * @example
 * formatError(new Error('boom'));           // 'boom'
 * formatError('plain string');              // 'plain string'
 */
export function formatError(error: unknown): string {
    if (error instanceof Error) {
        let msg = error.message || error.toString();
        const cause = (error as any).cause;
        if (cause instanceof Error) {
            msg += ` (原因: ${cause.message})`;
        }
        return msg;
    }
    if (typeof error === 'string') {
        return error;
    }
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

/**
 * 格式化错误的完整信息（包含堆栈）。
 */
export function fullErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        const parts: string[] = [error.message || error.toString()];
        if (error.stack) {
            parts.push(`\n--- 堆栈 ---\n${error.stack}`);
        }
        return parts.join('');
    }
    return formatError(error);
}

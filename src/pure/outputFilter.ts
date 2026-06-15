/**
 * 命令输出过滤（纯逻辑，不依赖 vscode）
 *
 * 从 utils/outputFilter.ts 抽出。
 */

/** 去除 ANSI 转义序列与形如 `[0;31m` 的残留终端控制符。 */
export function stripAnsiEscapeCodes(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m|\[\d+(?:;\d+)*m/g, '');
}

/**
 * 判断文本是否匹配某个模式。
 *
 * 模式按正则解析（大小写不敏感）；若正则非法，回退为子串包含匹配（同样大小写不敏感）。
 */
export function matchPattern(text: string, pattern: string): boolean {
    try {
        return new RegExp(pattern, 'i').test(text);
    } catch {
        return text.toLowerCase().includes(pattern.toLowerCase());
    }
}

/**
 * 按行过滤命令输出：保留命中 includePatterns（为空则全部保留）且不命中 excludePatterns 的行。
 */
export function filterCommandOutput(
    output: string,
    includePatterns: string[] = [],
    excludePatterns: string[] = []
): string {
    if (!includePatterns.length && !excludePatterns.length) {
        return output;
    }

    const lines = output.split('\n');
    return lines.filter(line => {
        const matchesInclude = includePatterns.length === 0 ||
            includePatterns.some(p => matchPattern(line, p));
        const matchesExclude = excludePatterns.length > 0 &&
            excludePatterns.some(p => matchPattern(line, p));
        return matchesInclude && !matchesExclude;
    }).join('\n');
}

/**
 * 根据行内容推断日志级别（用于彩色输出通道）。
 */
export function getLogLevel(line: string): 'info' | 'warn' | 'error' | 'trace' {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('[error]') || lowerLine.includes('[err]') ||
        lowerLine.includes('error:') || lowerLine.includes('exception') ||
        lowerLine.includes('failed') || lowerLine.includes('failure')) {
        return 'error';
    }
    if (lowerLine.includes('[warn]') || lowerLine.includes('[warning]') ||
        lowerLine.includes('warn:') || lowerLine.includes('warning:')) {
        return 'warn';
    }
    if (lowerLine.includes('[debug]') || lowerLine.includes('[trace]')) {
        return 'trace';
    }
    return 'info';
}

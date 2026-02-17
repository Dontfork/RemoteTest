import { OutputColorRule } from '../types';
import { BUILTIN_COLOR_RULES, getColorRules } from './colorRules';

const ANSI_COLORS = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    reset: '\x1b[0m'
};

const ANSI_ESCAPE_REGEX = /\x1b\[[0-9;]*m/g;

export function stripAnsiEscapeCodes(text: string): string {
    return text.replace(ANSI_ESCAPE_REGEX, '');
}

export function matchPattern(text: string, pattern: string): boolean {
    try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(text);
    } catch {
        return text.toLowerCase().includes(pattern.toLowerCase());
    }
}

export function filterCommandOutput(
    output: string,
    includePatterns: string[] = [],
    excludePatterns: string[] = []
): string {
    if (!includePatterns.length && !excludePatterns.length) {
        return output;
    }

    const lines = output.split('\n');
    const filteredLines: string[] = [];

    for (const line of lines) {
        const matchesInclude = includePatterns.length === 0 || 
            includePatterns.some(pattern => matchPattern(line, pattern));
        
        const matchesExclude = excludePatterns.length > 0 && 
            excludePatterns.some(pattern => matchPattern(line, pattern));

        if (matchesInclude && !matchesExclude) {
            filteredLines.push(line);
        }
    }

    return filteredLines.join('\n');
}

export function applyColorRules(line: string, colorRules: OutputColorRule[] = []): string {
    const rules = getColorRules(colorRules);
    for (const rule of rules) {
        if (matchPattern(line, rule.pattern)) {
            const colorCode = ANSI_COLORS[rule.color] || ANSI_COLORS.white;
            return `${colorCode}${line}${ANSI_COLORS.reset}`;
        }
    }
    return line;
}

export { ANSI_COLORS, getColorRules, BUILTIN_COLOR_RULES };

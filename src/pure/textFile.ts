/**
 * 文本文件判定与 CRLF→LF 转换（纯逻辑，不依赖 vscode）
 *
 * 从 core/scpClient.ts 抽出。
 */
import * as path from 'path';

/** 内置的文本文件扩展名白名单。 */
export const DEFAULT_TEXT_FILE_EXTENSIONS = [
    '.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.jsx', '.tsx',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php',
    '.sh', '.bash', '.zsh', '.yml', '.yaml', '.toml', '.ini', '.conf', '.cfg',
    '.sql', '.vue', '.svelte', '.scss', '.sass', '.less', '.env', '.gitignore',
    '.dockerignore', '.editorconfig', '.eslintrc', '.prettierrc', '.babelrc',
    '.properties', '.gradle', '.m', '.swift', '.kt', '.scala', '.lua', '.pl',
    '.r', '.rmd', '.csv', '.tsv', '.log', '.awk', '.sed'
];

/** 内置的无扩展名文本文件名（或以此为前缀的文件）。 */
export const DEFAULT_TEXT_FILE_NAMES = [
    '.gitignore', '.dockerignore', '.editorconfig', '.eslintrc', '.prettierrc',
    '.babelrc', 'license', 'readme', 'changelog', 'makefile', 'dockerfile',
    'vagrantfile', 'gemfile', 'rakefile', 'procfile'
];

/** 将自定义扩展名规范化为小写且以点开头。 */
export function normalizeExtension(ext: string): string {
    const lower = ext.toLowerCase();
    return lower.startsWith('.') ? lower : '.' + lower;
}

/**
 * 判断文件是否为文本文件（上传时需要做换行符转换）。
 *
 * 判定规则：
 * 1. 扩展名命中内置白名单或 customExtensions（合并后判断）；
 * 2. 否则文件名命中 DEFAULT_TEXT_FILE_NAMES（相等或前缀匹配）。
 */
export function isTextFile(filePath: string, customExtensions?: string[]): boolean {
    const ext = path.extname(filePath).toLowerCase();

    const allExtensions = customExtensions
        ? [...DEFAULT_TEXT_FILE_EXTENSIONS, ...customExtensions.map(normalizeExtension)]
        : DEFAULT_TEXT_FILE_EXTENSIONS;

    if (allExtensions.includes(ext)) {
        return true;
    }

    const fileName = path.basename(filePath).toLowerCase();
    if (DEFAULT_TEXT_FILE_NAMES.some(name => fileName === name || fileName.startsWith(name + '.'))) {
        return true;
    }
    return false;
}

/** 将 Buffer 内容中的 CRLF 转换为 LF（仅文本文件上传时使用）。 */
export function convertCrlfToLf(content: Buffer): Buffer {
    const text = content.toString('utf8');
    const converted = text.replace(/\r\n/g, '\n');
    return Buffer.from(converted, 'utf8');
}

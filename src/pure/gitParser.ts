/**
 * Git 状态解析与重命名检测（纯逻辑，不依赖 vscode）
 *
 * 从 core/gitChangeDetector.ts 抽出，便于对 git status 行、diff-tree 状态码、
 * 文件相似度与 rename/moved 判定做单元测试。
 */
import * as path from 'path';
import { GitChangeType } from '../types';

/** 一行 `git status --porcelain` 解析出的原始变更。 */
export interface RawGitChange {
    filePath: string;
    changeType: GitChangeType;
    oldFilePath?: string;
}

/** 由 git status 的两列状态码（X/Y）推导变更类型。 */
export function determineChangeType(x: string, y: string): GitChangeType {
    if (x === 'D' || y === 'D') {
        return 'deleted';
    }
    if (x === 'A' || y === 'A' || x === '?' || y === '?') {
        return 'added';
    }
    if (x === 'R' || y === 'R') {
        return 'renamed';
    }
    return 'modified';
}

/** 解析 `git status --porcelain` 的一行。无法解析返回 null。 */
export function parseGitStatusLine(line: string): RawGitChange | null {
    if (line.length < 3) {
        return null;
    }

    const xStatus = line[0];
    const yStatus = line[1];

    let filePath: string;

    if (line[2] === ' ') {
        filePath = line.substring(3).trim();
    } else {
        filePath = line.substring(2).trim();
    }

    if (!filePath) {
        return null;
    }

    let oldFilePath: string | undefined;

    if (filePath.startsWith('"') && filePath.endsWith('"')) {
        filePath = filePath.slice(1, -1);
    }

    if (filePath.includes(' -> ')) {
        const parts = filePath.split(' -> ');
        oldFilePath = parts[0];
        filePath = parts[1];

        if (oldFilePath.startsWith('"') && oldFilePath.endsWith('"')) {
            oldFilePath = oldFilePath.slice(1, -1);
        }

        if (filePath.startsWith('"') && filePath.endsWith('"')) {
            filePath = filePath.slice(1, -1);
        }

        if (!filePath) {
            return null;
        }
    }

    const changeType = determineChangeType(xStatus, yStatus);

    return {
        filePath: filePath,
        changeType: changeType,
        oldFilePath: oldFilePath
    };
}

/** 解析 `git diff-tree --name-status` 的一行状态码。 */
export function parseDiffTreeStatus(status: string): GitChangeType {
    if (status.startsWith('A')) {
        return 'added';
    }
    if (status.startsWith('D')) {
        return 'deleted';
    }
    if (status.startsWith('R')) {
        return 'renamed';
    }
    if (status.startsWith('C')) {
        return 'added';
    }
    return 'modified';
}

/** 将多行 `git status --porcelain` 输出解析为原始变更列表。 */
export function parseGitStatusOutput(stdout: string): RawGitChange[] {
    if (!stdout || !stdout.trim()) {
        return [];
    }
    const lines = stdout.trim().split('\n');
    const changes: RawGitChange[] = [];
    for (const line of lines) {
        const parsed = parseGitStatusLine(line);
        if (parsed) {
            changes.push(parsed);
        }
    }
    return changes;
}

/** 将多行 `git diff-tree --name-status` 输出解析为 {relativePath, oldRelativePath?, type} 列表。 */
export function parseDiffTreeOutput(stdout: string): Array<{ relativePath: string; oldRelativePath?: string; type: GitChangeType }> {
    if (!stdout || !stdout.trim()) {
        return [];
    }
    const result: Array<{ relativePath: string; oldRelativePath?: string; type: GitChangeType }> = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length < 2) {
            continue;
        }

        const status = parts[0].trim();
        let filePath = parts[1].trim();
        let oldFilePath: string | undefined;

        if (filePath.startsWith('"') && filePath.endsWith('"')) {
            filePath = filePath.slice(1, -1);
        }

        if (parts.length >= 3) {
            oldFilePath = parts[1].trim();
            filePath = parts[2].trim();
            if (oldFilePath.startsWith('"') && oldFilePath.endsWith('"')) {
                oldFilePath = oldFilePath.slice(1, -1);
            }
            if (filePath.startsWith('"') && filePath.endsWith('"')) {
                filePath = filePath.slice(1, -1);
            }
        }

        const relativePath = filePath.replace(/\\/g, '/');
        result.push({
            relativePath,
            oldRelativePath: oldFilePath ? oldFilePath.replace(/\\/g, '/') : undefined,
            type: parseDiffTreeStatus(status)
        });
    }

    return result;
}

/** 用 RS (Record Separator, ASCII 30) 作为 git log 字段分隔，规避 Windows cmd null 字节截断。 */
export const COMMIT_FIELD_SEP = '\x1e';

/** 解析 `git log --format=...%x1e...` 输出为 commit 信息列表。 */
export function parseRecentCommits(stdout: string): Array<{ hash: string; shortHash: string; message: string; author: string; date: string }> {
    if (!stdout || !stdout.trim()) {
        return [];
    }
    const commits: Array<{ hash: string; shortHash: string; message: string; author: string; date: string }> = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
        const parts = line.split(COMMIT_FIELD_SEP);
        if (parts.length >= 5) {
            commits.push({
                hash: parts[0],
                shortHash: parts[1],
                message: parts[2],
                author: parts[3],
                date: parts[4]
            });
        }
    }

    return commits;
}

/**
 * 计算两段文本的相似度（基于非空行的 Jaccard 系数，取值 0~1）。
 *
 * 空集合返回 0。
 */
export function calculateSimilarity(content1: string, content2: string): number {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    const set1 = new Set(lines1.map(l => l.trim()).filter(l => l.length > 0));
    const set2 = new Set(lines2.map(l => l.trim()).filter(l => l.length > 0));

    if (set1.size === 0 || set2.size === 0) {
        return 0;
    }

    let commonLines = 0;
    for (const line of set1) {
        if (set2.has(line)) {
            commonLines++;
        }
    }

    return (2 * commonLines) / (set1.size + set2.size);
}

/**
 * 根据 old/new 相对路径判定是同目录改名（renamed）还是跨目录移动（moved）。
 */
export function classifyRename(oldRelativePath: string, newRelativePath: string): 'renamed' | 'moved' {
    const oldDir = path.dirname(oldRelativePath);
    const newDir = path.dirname(newRelativePath);
    return oldDir !== newDir ? 'moved' : 'renamed';
}

/** 用于 git log 格式的字段分隔占位符（调用 git 时使用）。 */
export const GIT_LOG_FORMAT = '%H%x1e%h%x1e%s%x1e%an%x1e%ai';

/**
 * gitParser 模块单元测试 —— 零 vscode 依赖。
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
    determineChangeType,
    parseGitStatusLine,
    parseGitStatusOutput,
    parseDiffTreeStatus,
    parseDiffTreeOutput,
    parseRecentCommits,
    calculateSimilarity,
    classifyRename,
    COMMIT_FIELD_SEP,
    GIT_LOG_FORMAT
} from '../../src/pure/gitParser';

describe('pure/gitParser', () => {
    describe('determineChangeType', () => {
        it('应识别 Added', () => {
            assert.strictEqual(determineChangeType('A', ' '), 'added');
            assert.strictEqual(determineChangeType('?', '?'), 'added');
        });

        it('应识别 Modified', () => {
            assert.strictEqual(determineChangeType('M', ' '), 'modified');
            assert.strictEqual(determineChangeType(' ', 'M'), 'modified');
        });

        it('应识别 Deleted', () => {
            assert.strictEqual(determineChangeType('D', ' '), 'deleted');
            assert.strictEqual(determineChangeType(' ', 'D'), 'deleted');
        });

        it('应识别 Renamed', () => {
            assert.strictEqual(determineChangeType('R', ' '), 'renamed');
        });

        it('应识别 Copied — C 不在显式列表中，映射为 modified', () => {
            // determineChangeType 只检查 D/A/?/R，C 不在其中
            assert.strictEqual(determineChangeType('C', ' '), 'modified');
        });

        it('未知类型应返回 modified', () => {
            assert.strictEqual(determineChangeType(' ', ' '), 'modified');
        });

        it('deleted 优先于 added', () => {
            assert.strictEqual(determineChangeType('D', 'A'), 'deleted');
        });
    });

    describe('parseGitStatusLine', () => {
        it('应解析普通修改行', () => {
            const result = parseGitStatusLine('M  src/index.ts');
            assert.ok(result);
            assert.strictEqual(result!.changeType, 'modified');
            assert.strictEqual(result!.filePath, 'src/index.ts');
        });

        it('应解析新增行', () => {
            const result = parseGitStatusLine('A  new-file.ts');
            assert.ok(result);
            assert.strictEqual(result!.changeType, 'added');
            assert.strictEqual(result!.filePath, 'new-file.ts');
        });

        it('应解析删除行', () => {
            const result = parseGitStatusLine('D  deleted-file.ts');
            assert.ok(result);
            assert.strictEqual(result!.changeType, 'deleted');
            assert.strictEqual(result!.filePath, 'deleted-file.ts');
        });

        it('应解析重命名行', () => {
            const result = parseGitStatusLine('R  old-name.ts -> new-name.ts');
            assert.ok(result);
            assert.strictEqual(result!.changeType, 'renamed');
            assert.strictEqual(result!.filePath, 'new-name.ts');
            assert.strictEqual(result!.oldFilePath, 'old-name.ts');
        });

        it('应解析未跟踪文件', () => {
            const result = parseGitStatusLine('?? untracked.ts');
            assert.ok(result);
            assert.strictEqual(result!.changeType, 'added');
            assert.strictEqual(result!.filePath, 'untracked.ts');
        });

        it('空行应返回 null', () => {
            assert.strictEqual(parseGitStatusLine(''), null);
            assert.strictEqual(parseGitStatusLine('   '), null);
        });

        it('应解析 index 和 worktree 状态组合', () => {
            const result = parseGitStatusLine('MM src/both-modified.ts');
            assert.ok(result);
            assert.strictEqual(result!.filePath, 'src/both-modified.ts');
        });
    });

    describe('parseGitStatusOutput', () => {
        it('应解析多行输出', () => {
            const output = `M  src/index.ts
A  new-file.ts
D  deleted-file.ts`;

            const results = parseGitStatusOutput(output);
            assert.strictEqual(results.length, 3);
            assert.strictEqual(results[0].changeType, 'modified');
            assert.strictEqual(results[1].changeType, 'added');
            assert.strictEqual(results[2].changeType, 'deleted');
        });

        it('应跳过空行', () => {
            const output = `M  file1.ts

A  file2.ts`;
            const results = parseGitStatusOutput(output);
            assert.strictEqual(results.length, 2);
        });

        it('空输出应返回空数组', () => {
            assert.strictEqual(parseGitStatusOutput('').length, 0);
            assert.strictEqual(parseGitStatusOutput('   ').length, 0);
        });
    });

    describe('parseDiffTreeStatus', () => {
        it('应识别 A (added)', () => {
            assert.strictEqual(parseDiffTreeStatus('A'), 'added');
        });

        it('应识别 M (modified)', () => {
            assert.strictEqual(parseDiffTreeStatus('M'), 'modified');
        });

        it('应识别 D (deleted)', () => {
            assert.strictEqual(parseDiffTreeStatus('D'), 'deleted');
        });

        it('应识别 R (renamed)', () => {
            assert.strictEqual(parseDiffTreeStatus('R'), 'renamed');
        });

        it('未知状态应返回 modified', () => {
            assert.strictEqual(parseDiffTreeStatus('T'), 'modified');
        });
    });

    describe('parseDiffTreeOutput', () => {
        it('应解析 diff-tree 输出', () => {
            const output = `M\tsrc/index.ts
A\tnew-file.ts
D\tdeleted-file.ts`;

            const results = parseDiffTreeOutput(output);
            assert.strictEqual(results.length, 3);
            assert.strictEqual(results[0].type, 'modified');
            assert.strictEqual(results[0].relativePath, 'src/index.ts');
            assert.strictEqual(results[1].type, 'added');
            assert.strictEqual(results[2].type, 'deleted');
        });

        it('应处理重命名格式', () => {
            const output = `R\tsrc/old.ts\tsrc/new.ts`;
            const results = parseDiffTreeOutput(output);
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].type, 'renamed');
            assert.strictEqual(results[0].relativePath, 'src/new.ts');
        });

        it('空输出应返回空数组', () => {
            assert.strictEqual(parseDiffTreeOutput('').length, 0);
        });
    });

    describe('parseRecentCommits', () => {
        it('应解析 git log 输出', () => {
            const sep = COMMIT_FIELD_SEP;
            const output = `abc1234567890def${sep}abc1234${sep}feat: add feature${sep}John${sep}2024-01-15 10:00
def5678901234abc${sep}def5678${sep}fix: bug fix${sep}Jane${sep}2024-01-14 09:00`;

            const results = parseRecentCommits(output);
            assert.strictEqual(results.length, 2);

            assert.strictEqual(results[0].hash, 'abc1234567890def');
            assert.strictEqual(results[0].shortHash, 'abc1234');
            assert.strictEqual(results[0].message, 'feat: add feature');
            assert.strictEqual(results[0].author, 'John');

            assert.strictEqual(results[1].shortHash, 'def5678');
            assert.strictEqual(results[1].message, 'fix: bug fix');
        });

        it('空输出应返回空数组', () => {
            assert.strictEqual(parseRecentCommits('').length, 0);
        });

        it('应跳过格式不正确的行', () => {
            const sep = COMMIT_FIELD_SEP;
            const output = `invalid-line\nabc1234${sep}msg${sep}author${sep}date${sep}fullhash`;
            const results = parseRecentCommits(output);
            assert.strictEqual(results.length, 1);
        });
    });

    describe('calculateSimilarity', () => {
        it('完全相同的内容应返回 1', () => {
            const content = 'line1\nline2\nline3\n';
            assert.strictEqual(calculateSimilarity(content, content), 1);
        });

        it('完全不同的内容应返回 0', () => {
            assert.strictEqual(calculateSimilarity('aaa', 'bbb'), 0);
        });

        it('部分相似应返回中间值', () => {
            const content1 = 'line1\nline2\nline3\nline4\n';
            const content2 = 'line1\nline2\nchanged\nline4\n';
            const sim = calculateSimilarity(content1, content2);
            assert.ok(sim > 0 && sim < 1);
        });

        it('空内容应返回 0', () => {
            assert.strictEqual(calculateSimilarity('', ''), 0);
            assert.strictEqual(calculateSimilarity('text', ''), 0);
        });
    });

    describe('classifyRename', () => {
        it('同目录重命名应返回 renamed', () => {
            assert.strictEqual(classifyRename('src/old.ts', 'src/new.ts'), 'renamed');
        });

        it('不同目录应返回 moved', () => {
            assert.strictEqual(classifyRename('src/old.ts', 'lib/old.ts'), 'moved');
        });

        it('同文件名不同路径应返回 moved', () => {
            assert.strictEqual(classifyRename('a/file.ts', 'b/c/file.ts'), 'moved');
        });
    });

    describe('常量', () => {
        it('COMMIT_FIELD_SEP 应为非空字符串', () => {
            assert.ok(typeof COMMIT_FIELD_SEP === 'string');
            assert.ok(COMMIT_FIELD_SEP.length > 0);
        });

        it('GIT_LOG_FORMAT 应包含占位符', () => {
            assert.ok(typeof GIT_LOG_FORMAT === 'string');
            assert.ok(GIT_LOG_FORMAT.includes('%') || GIT_LOG_FORMAT.includes(COMMIT_FIELD_SEP));
        });
    });
});

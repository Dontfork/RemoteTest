import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitChange, GitChangeGroup, GitChangeType, ProjectConfig, CommitInfo, CommitChangeGroup, CommitFileChange, ProjectChangeData } from '../types';
import { getProjectsWithLocalPath, getProjectCommitCount } from '../config';
import { getOutputChannelManager, UnifiedOutputChannel } from '../utils/outputChannel';
import {
    RawGitChange,
    parseGitStatusOutput,
    parseDiffTreeOutput,
    parseRecentCommits,
    calculateSimilarity,
    classifyRename,
    COMMIT_FIELD_SEP,
    GIT_LOG_FORMAT
} from '../pure/gitParser';
import { toDisplayPath } from '../pure/pathUtil';

const execAsync = promisify(exec);

export class GitChangeDetector {
    private outputChannel: UnifiedOutputChannel;

    constructor() {
        this.outputChannel = getOutputChannelManager().getRemoteTestChannel();
    }

    async getGitChanges(): Promise<GitChangeGroup[]> {
        const projects = getProjectsWithLocalPath();

        if (projects.length === 0) {
            return [];
        }

        const groups: GitChangeGroup[] = [];

        for (const project of projects) {
            if (!project.localPath) {
                continue;
            }
            
            const localPath = path.resolve(project.localPath);
            
            const isGitRepo = await this.isGitRepository(localPath);
            if (!isGitRepo) {
                continue;
            }

            const changes = await this.getProjectChanges(project, localPath);
            if (changes.length > 0) {
                groups.push({
                    projectName: project.name,
                    project: project,
                    changes: changes
                });
            }
        }

        return groups;
    }

    private async isGitRepository(dir: string): Promise<boolean> {
        try {
            await execAsync('git rev-parse --is-inside-work-tree', { 
                cwd: dir,
                env: { ...process.env, LANG: 'C.UTF-8' }
            });
            return true;
        } catch {
            return false;
        }
    }

    private async getProjectChanges(project: ProjectConfig, localPath: string): Promise<GitChange[]> {
        try {
            let statusOutput = '';
            
            try {
                const result = await execAsync(
                    'git -c core.quotepath=false status -M --porcelain -uall',
                    { 
                        cwd: localPath, 
                        maxBuffer: 1024 * 1024 * 10,
                        encoding: 'utf8',
                        env: { ...process.env, LANG: 'C.UTF-8' }
                    }
                );
                statusOutput = result.stdout;
            } catch {
                const fallbackResult = await execAsync(
                    'git -c core.quotepath=false status -M --porcelain -u',
                    { 
                        cwd: localPath, 
                        maxBuffer: 1024 * 1024 * 10,
                        encoding: 'utf8',
                        env: { ...process.env, LANG: 'C.UTF-8' }
                    }
                );
                statusOutput = fallbackResult.stdout;
            }

            if (!statusOutput.trim()) {
                return [];
            }

            const rawChanges = parseGitStatusOutput(statusOutput);

            const changes: GitChange[] = [];
            
            for (const rawChange of rawChanges) {
                const absolutePath = path.resolve(localPath, rawChange.filePath);
                
                const isDir = await this.isDirectory(absolutePath, rawChange.changeType, rawChange.filePath);
                
                if (!isDir) {
                    const relativePath = path.relative(localPath, absolutePath);
                    const displayPath = toDisplayPath(relativePath);

                    const change: GitChange = {
                        path: absolutePath,
                        relativePath: relativePath,
                        displayPath: displayPath,
                        type: rawChange.changeType,
                        project: project
                    };

                    if (rawChange.oldFilePath && rawChange.changeType === 'renamed') {
                        const oldAbsolutePath = path.resolve(localPath, rawChange.oldFilePath);
                        const oldRelativePath = path.relative(localPath, oldAbsolutePath);
                        change.oldPath = oldAbsolutePath;
                        change.oldRelativePath = oldRelativePath;
                    }

                    changes.push(change);
                }
            }

            const changesWithRenameDetection = await this.detectRenamesByContent(changes, localPath);
            
            if (changesWithRenameDetection.length > 0) {
                this.outputChannel.info(`[${project.name}] 检测到 ${changesWithRenameDetection.length} 个文件变更`);
            }

            return changesWithRenameDetection;
        } catch (error: any) {
            this.outputChannel.error(`[${project.name}] Git检测错误: ${error.message}`);
            return [];
        }
    }

    private async detectRenamesByContent(changes: GitChange[], projectPath: string): Promise<GitChange[]> {
        const deletedFiles = changes.filter(c => c.type === 'deleted');
        const addedFiles = changes.filter(c => c.type === 'added');
        const otherFiles = changes.filter(c => c.type !== 'deleted' && c.type !== 'added');

        if (deletedFiles.length === 0 || addedFiles.length === 0) {
            return changes;
        }

        const renamedPairs: { deleted: GitChange; added: GitChange; similarity: number }[] = [];
        const matchedDeleted = new Set<string>();
        const matchedAdded = new Set<string>();

        for (const deleted of deletedFiles) {
            let bestMatch: { added: GitChange; similarity: number } | null = null;

            const deletedContent = await this.getDeletedFileContent(projectPath, deleted.relativePath);
            if (!deletedContent) {
                continue;
            }

            for (const added of addedFiles) {
                if (matchedAdded.has(added.path)) {
                    continue;
                }

                const similarity = await this.calculateSimilarityByContent(deletedContent, added.path);

                if (similarity >= 0.5 && (!bestMatch || similarity > bestMatch.similarity)) {
                    bestMatch = { added, similarity };
                }
            }

            if (bestMatch) {
                renamedPairs.push({
                    deleted,
                    added: bestMatch.added,
                    similarity: bestMatch.similarity
                });
                matchedDeleted.add(deleted.path);
                matchedAdded.add(bestMatch.added.path);
            }
        }

        const result: GitChange[] = [...otherFiles];

        for (const pair of renamedPairs) {
            const renameType = classifyRename(pair.deleted.relativePath, pair.added.relativePath);

            const renamedChange: GitChange = {
                ...pair.added,
                type: renameType,
                oldPath: pair.deleted.path,
                oldRelativePath: pair.deleted.relativePath
            };
            result.push(renamedChange);
        }

        for (const deleted of deletedFiles) {
            if (!matchedDeleted.has(deleted.path)) {
                result.push(deleted);
            }
        }

        for (const added of addedFiles) {
            if (!matchedAdded.has(added.path)) {
                result.push(added);
            }
        }

        return result;
    }

    private async calculateSimilarityByContent(content1: string, filePath2: string): Promise<number> {
        try {
            const content2 = await this.getFileContent(filePath2);

            if (!content1 || !content2) {
                return 0;
            }

            return calculateSimilarity(content1, content2);
        } catch {
            return 0;
        }
    }

    private async getFileContent(filePath: string): Promise<string> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return content;
        } catch {
            return '';
        }
    }

    private async getDeletedFileContent(projectPath: string, relativePath: string): Promise<string> {
        try {
            const { stdout } = await execAsync(
                `git show :"${relativePath.replace(/\\/g, '/')}"`,
                { cwd: projectPath, encoding: 'utf8' }
            );
            return stdout;
        } catch {
            return '';
        }
    }

    private async isDirectory(absolutePath: string, changeType: GitChangeType, originalPath: string): Promise<boolean> {
        if (originalPath.endsWith('/') || originalPath.endsWith('\\')) {
            return true;
        }

        if (changeType === 'deleted') {
            return false;
        }

        try {
            const stats = await fs.promises.stat(absolutePath);
            return stats.isDirectory();
        } catch {
            const normalizedPath = originalPath.replace(/\\/g, '/');
            const lastPart = normalizedPath.split('/').pop() || '';
            const ext = path.extname(lastPart);
            
            return !(ext && ext.length > 0);
        }
    }

    async getDeletedFiles(): Promise<GitChange[]> {
        const groups = await this.getGitChanges();
        const deletedFiles: GitChange[] = [];

        for (const group of groups) {
            for (const change of group.changes) {
                if (change.type === 'deleted') {
                    deletedFiles.push(change);
                }
            }
        }

        return deletedFiles;
    }

    async hasDeletedFiles(): Promise<boolean> {
        const deletedFiles = await this.getDeletedFiles();
        return deletedFiles.length > 0;
    }

    async getProjectChangeData(): Promise<ProjectChangeData[]> {
        const projects = getProjectsWithLocalPath();
        if (projects.length === 0) {
            return [];
        }

        const results: ProjectChangeData[] = [];

        for (const project of projects) {
            if (!project.localPath) {
                continue;
            }

            const localPath = path.resolve(project.localPath);
            const isGitRepo = await this.isGitRepository(localPath);
            if (!isGitRepo) {
                continue;
            }

            const uncommittedChanges = await this.getProjectChanges(project, localPath);
            const commitCount = getProjectCommitCount(project);
            let commitGroups: CommitChangeGroup[] = [];

            if (commitCount > 0) {
                commitGroups = await this.getCommitChanges(project, localPath, commitCount);
            }

            if (uncommittedChanges.length > 0 || commitGroups.length > 0) {
                results.push({
                    projectName: project.name,
                    project: project,
                    uncommittedChanges: uncommittedChanges,
                    commitGroups: commitGroups
                });
            }
        }

        return results;
    }

    private async getCommitChanges(project: ProjectConfig, localPath: string, count: number): Promise<CommitChangeGroup[]> {
        try {
            const commits = await this.getRecentCommits(localPath, count);
            const groups: CommitChangeGroup[] = [];

            for (const commit of commits) {
                const fileChanges = await this.getCommitFileChanges(commit, project, localPath);
                if (fileChanges.length > 0) {
                    groups.push({
                        commit: commit,
                        projectName: project.name,
                        project: project,
                        changes: fileChanges
                    });
                }
            }

            return groups;
        } catch (error: any) {
            this.outputChannel.error(`[${project.name}] 获取 commit 记录错误: ${error.message}`);
            vscode.window.setStatusBarMessage(`[${project.name}] 获取 commit 记录失败: ${error.message}`, 5000);
            return [];
        }
    }

    private async getRecentCommits(localPath: string, count: number): Promise<CommitInfo[]> {
        const { stdout } = await execAsync(
            `git log -${count} --format="${GIT_LOG_FORMAT}" --no-merges`,
            {
                cwd: localPath,
                maxBuffer: 1024 * 1024 * 10,
                encoding: 'utf8'
            }
        );

        return parseRecentCommits(stdout);
    }

    private async getCommitFileChanges(commit: CommitInfo, project: ProjectConfig, localPath: string): Promise<CommitFileChange[]> {
        const { stdout } = await execAsync(
            `git diff-tree --no-commit-id -r --name-status ${commit.hash}`,
            {
                cwd: localPath,
                maxBuffer: 1024 * 1024 * 10,
                encoding: 'utf8'
            }
        );

        const parsed = parseDiffTreeOutput(stdout);
        return parsed.map(p => ({
            relativePath: p.relativePath,
            displayPath: p.relativePath,
            type: p.type,
            project: project
        }));
    }

    showDebugLog(): void {
        this.outputChannel.show();
    }
}

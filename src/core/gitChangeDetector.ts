import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitChange, GitChangeGroup, GitChangeType, ProjectConfig, CommitInfo, CommitChangeGroup, CommitFileChange, ProjectChangeData } from '../types';
import { getProjectsWithLocalPath, getProjectCommitCount } from '../config';
import { getOutputChannelManager, UnifiedOutputChannel } from '../utils/outputChannel';

const execAsync = promisify(exec);

interface RawGitChange {
    filePath: string;
    changeType: GitChangeType;
    oldFilePath?: string;
}

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

            const lines = statusOutput.trim().split('\n');
            
            const rawChanges: RawGitChange[] = [];
            
            for (const line of lines) {
                const rawChange = this.parseGitStatusLineToRaw(line);
                if (rawChange) {
                    rawChanges.push(rawChange);
                }
            }
            
            const changes: GitChange[] = [];
            
            for (const rawChange of rawChanges) {
                const absolutePath = path.resolve(localPath, rawChange.filePath);
                
                const isDir = await this.isDirectory(absolutePath, rawChange.changeType, rawChange.filePath);
                
                if (!isDir) {
                    const relativePath = path.relative(localPath, absolutePath);
                    const displayPath = this.getDisplayPath(relativePath);

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
            const oldDir = path.dirname(pair.deleted.relativePath);
            const newDir = path.dirname(pair.added.relativePath);
            
            const isMoved = oldDir !== newDir;
            
            const renamedChange: GitChange = {
                ...pair.added,
                type: isMoved ? 'moved' : 'renamed',
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

    private async calculateFileSimilarity(filePath1: string, filePath2: string): Promise<number> {
        try {
            const content1 = await this.getFileContent(filePath1);
            const content2 = await this.getFileContent(filePath2);

            if (!content1 || !content2) {
                return 0;
            }

            return this.calculateSimilarity(content1, content2);
        } catch {
            return 0;
        }
    }

    private async calculateSimilarityByContent(content1: string, filePath2: string): Promise<number> {
        try {
            const content2 = await this.getFileContent(filePath2);

            if (!content1 || !content2) {
                return 0;
            }

            return this.calculateSimilarity(content1, content2);
        } catch {
            return 0;
        }
    }

    private calculateSimilarity(content1: string, content2: string): number {
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

        const similarity = (2 * commonLines) / (set1.size + set2.size);
        return similarity;
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

    private parseGitStatusLineToRaw(line: string): RawGitChange | null {
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

        const changeType = this.determineChangeType(xStatus, yStatus);

        return {
            filePath: filePath,
            changeType: changeType,
            oldFilePath: oldFilePath
        };
    }

    private getDisplayPath(relativePath: string): string {
        return relativePath.replace(/\\/g, '/');
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

    private determineChangeType(x: string, y: string): GitChangeType {
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

    // 用 RS (Record Separator, ASCII 30) 替代 null 字节，避免 Windows cmd.exe 截断
    private static readonly COMMIT_FIELD_SEP = '\x1e';

    private async getRecentCommits(localPath: string, count: number): Promise<CommitInfo[]> {
        const { stdout } = await execAsync(
            `git log -${count} --format="%H%x1e%h%x1e%s%x1e%an%x1e%ai" --no-merges`,
            {
                cwd: localPath,
                maxBuffer: 1024 * 1024 * 10,
                encoding: 'utf8'
            }
        );

        if (!stdout.trim()) {
            return [];
        }

        const commits: CommitInfo[] = [];
        const lines = stdout.trim().split('\n');

        for (const line of lines) {
            const parts = line.split(GitChangeDetector.COMMIT_FIELD_SEP);
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

    private async getCommitFileChanges(commit: CommitInfo, project: ProjectConfig, localPath: string): Promise<CommitFileChange[]> {
        const { stdout } = await execAsync(
            `git diff-tree --no-commit-id -r --name-status ${commit.hash}`,
            {
                cwd: localPath,
                maxBuffer: 1024 * 1024 * 10,
                encoding: 'utf8'
            }
        );

        if (!stdout.trim()) {
            return [];
        }

        const changes: CommitFileChange[] = [];
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

            const changeType = this.parseDiffTreeStatus(status);
            const relativePath = filePath.replace(/\\/g, '/');
            const displayPath = relativePath;

            const change: CommitFileChange = {
                relativePath: relativePath,
                displayPath: displayPath,
                type: changeType,
                project: project
            };

            changes.push(change);
        }

        return changes;
    }

    private parseDiffTreeStatus(status: string): GitChangeType {
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

    showDebugLog(): void {
        this.outputChannel.show();
    }
}

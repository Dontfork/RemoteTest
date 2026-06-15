/**
 * 变更上传服务 —— 负责将 git 变更（未提交 / commit）上传或删除到远程服务器。
 *
 * 从 ChangesTreeView 中抽出，使"上传逻辑"与"Tree 视图渲染"解耦。
 * ChangesTreeView 通过组合方式使用本服务，自身只负责 UI 交互（确认对话框、进度展示）。
 */
import * as path from 'path';
import * as fs from 'fs';
import { GitChange, CommitFileChange, ProjectConfig } from '../types';
import { SCPClient } from '../core/scpClient';
import { FileUploader } from '../core/uploader';
import { hasValidRemoteDirectory, hasValidLocalPath } from '../config';
import { formatError } from '../pure/errors';
import { relativeToRemotePath } from '../pure/pathUtil';

export class ChangesUploadService {
    private fileUploader: FileUploader;

    constructor(fileUploader: FileUploader) {
        this.fileUploader = fileUploader;
    }

    /* ---------------------------------------------------------------------- */
    /* 公开 API                                                                 */
    /* ---------------------------------------------------------------------- */

    /** 校验项目是否具备上传条件。 */
    canUpload(project: ProjectConfig): { ok: boolean; reason?: string } {
        if (!hasValidLocalPath(project)) {
            return { ok: false, reason: `工程 "${project.name}" 未配置 localPath，无法进行文件上传` };
        }
        if (!hasValidRemoteDirectory(project)) {
            return { ok: false, reason: `工程 "${project.name}" 未配置 remoteDirectory，无法进行文件上传` };
        }
        return { ok: true };
    }

    /**
     * 上传单个变更文件。
     *
     * @param change 变更信息
     * @param options.suppressProgress 为 true 时跳过 uploadFile 自身的进度弹窗
     *   （批量上传场景由调用方统一展示进度，避免双重弹窗）
     */
    async uploadSingleChange(change: GitChange, options?: { suppressProgress?: boolean }): Promise<void> {
        await this.fileUploader.uploadFile(change.path, options);
    }

    /**
     * 上传 commit 中的单个文件。
     *
     * @param fileChange commit 文件变更信息
     * @param options.suppressProgress 为 true 时跳过 uploadFile 自身的进度弹窗
     */
    async uploadCommitFile(fileChange: CommitFileChange, options?: { suppressProgress?: boolean }): Promise<void> {
        const project = fileChange.project;
        if (!project.localPath) {
            throw new Error(`工程 "${project.name}" 未配置 localPath，无法上传文件`);
        }
        const localPath = path.resolve(project.localPath, fileChange.relativePath);

        if (!fs.existsSync(localPath)) {
            throw new Error(`本地文件不存在: ${localPath}`);
        }

        await this.fileUploader.uploadFile(localPath, options);
    }

    /** 删除远程文件。 */
    async deleteRemoteFile(change: GitChange): Promise<void> {
        const project = change.project;
        const remotePath = this.calculateRemotePath(change);

        const scpClient = new SCPClient(project.server, true, project);
        try {
            const sftp = await scpClient.connect();

            try {
                await sftp.delete(remotePath);
            } catch (deleteError: any) {
                try {
                    await sftp.rmdir(remotePath, true);
                } catch (rmdirError: any) {
                    throw new Error(`无法删除远程文件: ${deleteError.message}`);
                }
            }
        } finally {
            await scpClient.disconnect();
        }
    }

    /** 构建上传摘要文本。 */
    buildUploadSummary(
        uploadCount: number,
        deleteCount: number,
        renameCount: number,
        shouldDeleteRemote: boolean
    ): string {
        let summary = `变更处理完成: 上传 ${uploadCount} 个文件`;
        if (shouldDeleteRemote && (deleteCount > 0 || renameCount > 0)) {
            const totalDeleted = deleteCount + renameCount;
            summary += `，删除 ${totalDeleted} 个远程文件`;
            if (renameCount > 0) {
                summary += ` (含 ${renameCount} 个重命名旧文件)`;
            }
        }
        return summary;
    }

    /** 格式化待删除文件列表为展示文本。 */
    formatDeletedFilesMessage(changes: GitChange[]): string {
        const maxDisplay = 5;
        const displayChanges = changes.slice(0, maxDisplay);
        let message = displayChanges.map(c => {
            if (c.type === 'deleted') {
                return `  - ${c.relativePath} (已删除)`;
            }
            return `  - ${c.relativePath} (重命名旧文件)`;
        }).join('\n');

        if (changes.length > maxDisplay) {
            message += `\n  - ... 还有 ${changes.length - maxDisplay} 个文件`;
        }

        return message;
    }

    /* ---------------------------------------------------------------------- */
    /* 内部辅助                                                                 */
    /* ---------------------------------------------------------------------- */

    private calculateRemotePath(change: GitChange): string {
        const project = change.project;
        return relativeToRemotePath(change.relativePath, project.server.remoteDirectory!);
    }
}

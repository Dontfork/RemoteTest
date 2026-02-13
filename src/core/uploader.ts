import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { getConfig } from '../config';
import { CommandExecutor } from './commandExecutor';

export class FileUploader {
    private commandExecutor: CommandExecutor;

    constructor(commandExecutor: CommandExecutor) {
        this.commandExecutor = commandExecutor;
    }

    async uploadAndExecute(): Promise<void> {
        const config = getConfig();

        const fileUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: '选择要上传的文件'
        });

        if (!fileUri || fileUri.length === 0) {
            return;
        }

        const filePath = fileUri[0].fsPath;
        const fileName = path.basename(filePath);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'AutoTest',
                cancellable: false
            }, async (progress) => {
                progress.report({ message: `正在上传: ${fileName}` });
                
                const fileContent = fs.readFileSync(filePath);
                const formData = new FormData();
                formData.append('file', new Blob([fileContent]), fileName);

                await axios.post(config.server.uploadUrl, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 30000
                });

                progress.report({ message: '执行命令中...' });
                
                await this.commandExecutor.executeWithConfig();
            });

            vscode.window.showInformationMessage('文件上传并执行完成');
            this.commandExecutor.showOutput();
        } catch (error: any) {
            vscode.window.showErrorMessage(`操作失败: ${error.message}`);
            throw error;
        }
    }

    async upload(filePath: string): Promise<boolean> {
        const config = getConfig();

        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }

        const fileName = path.basename(filePath);
        const fileContent = fs.readFileSync(filePath);

        const formData = new FormData();
        formData.append('file', new Blob([fileContent]), fileName);

        const response = await axios.post(config.server.uploadUrl, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 30000
        });

        return response.status === 200;
    }
}

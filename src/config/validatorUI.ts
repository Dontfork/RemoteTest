import * as vscode from 'vscode';
import * as fs from 'fs';
import { ConfigValidationResult } from '../pure/configSchema';
import { getOutputChannelManager } from '../utils/outputChannel';

export function showValidationMessages(result: ConfigValidationResult): void {
    const outputChannel = getOutputChannelManager().getRemoteTestChannel();
    
    if (result.errors.length > 0) {
        outputChannel.error('配置验证失败');
        outputChannel.error('─'.repeat(30));
        result.errors.forEach((err, i) => outputChannel.error(`  ${i + 1}. ${err}`));
        vscode.window.showErrorMessage(`RemoteTest 配置验证失败：${result.errors.length} 个错误`, '查看详情').then(selection => {
            if (selection === '查看详情') {
                outputChannel.show();
            }
        });
        return;
    }

    if (result.warnings.length > 0) {
        outputChannel.warn('配置验证警告');
        outputChannel.warn('─'.repeat(30));
        result.warnings.forEach((warn, i) => outputChannel.warn(`  ${i + 1}. ${warn}`));
    }
}

export function saveConfigWithDefaults(configPath: string, config: any, filledConfig: any): void {
    const content = JSON.stringify(filledConfig, null, 4);
    const existingContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';
    
    if (content === existingContent) {
        return;
    }
    
    fs.writeFileSync(configPath, content, 'utf-8');
}

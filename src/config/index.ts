import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AutoTestConfig } from '../types';

const defaultConfig: AutoTestConfig = {
    server: {
        host: "192.168.1.100",
        port: 22,
        username: "root",
        password: "",
        privateKeyPath: "",
        localProjectPath: "",
        remoteDirectory: "/tmp/autotest"
    },
    command: {
        executeCommand: "pytest {filePath} -v",
        filterPatterns: ["PASSED", "FAILED", "ERROR"],
        filterMode: "include"
    },
    ai: {
        provider: "qwen",
        qwen: {
            apiKey: "",
            apiUrl: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            model: "qwen-turbo"
        },
        openai: {
            apiKey: "",
            apiUrl: "https://api.openai.com/v1/chat/completions",
            model: "gpt-3.5-turbo"
        }
    },
    logs: {
        directories: [
            { name: "应用日志", path: "/var/logs" },
            { name: "测试日志", path: "/var/log/autotest" }
        ],
        downloadPath: "",
        refreshInterval: 5000
    }
};

let config: AutoTestConfig | null = null;
let configFilePath: string = '';
let fileWatcher: vscode.FileSystemWatcher | null = null;
let configChangeEmitter = new vscode.EventEmitter<AutoTestConfig>();

export const onConfigChanged = configChangeEmitter.event;

export function loadConfig(workspacePath: string): AutoTestConfig {
    const configPath = vscode.workspace.getConfiguration('autotest').get<string>('configPath') || 'autotest-config.json';
    
    const pathsToTry = [
        path.join(workspacePath, '.vscode', configPath),
        path.join(workspacePath, configPath)
    ];

    let fullPath = '';
    for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
            fullPath = p;
            break;
        }
    }

    if (!fullPath) {
        fullPath = pathsToTry[0];
    }

    configFilePath = fullPath;
    console.log('[AutoTest] Loading config from:', fullPath);

    try {
        if (!fs.existsSync(fullPath)) {
            console.log('[AutoTest] Config file not found, creating default config');
            const vscodeDir = path.join(workspacePath, '.vscode');
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir, { recursive: true });
            }
            fs.writeFileSync(fullPath, JSON.stringify(defaultConfig, null, 4), 'utf-8');
            vscode.window.showInformationMessage(`已创建默认配置文件: ${path.join('.vscode', configPath)}`);
            config = defaultConfig;
            return config as AutoTestConfig;
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        const loadedConfig = JSON.parse(content);
        config = { ...defaultConfig, ...loadedConfig };
        console.log('[AutoTest] Config loaded successfully');
        return config as AutoTestConfig;
    } catch (error: any) {
        console.error('[AutoTest] Config load error:', error.message);
        console.log('[AutoTest] Using default config due to error');
        config = defaultConfig;
        return config as AutoTestConfig;
    }
}

export function getConfig(): AutoTestConfig {
    return config || defaultConfig;
}

export function reloadConfig(workspacePath?: string): AutoTestConfig {
    const wsPath = workspacePath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!wsPath) {
        console.warn('[AutoTest] No workspace path available for config reload');
        return getConfig();
    }
    
    const oldConfig = config;
    const newConfig = loadConfig(wsPath);
    
    if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
        configChangeEmitter.fire(newConfig);
        console.log('[AutoTest] Config changed, notifying listeners');
    }
    
    return newConfig;
}

export function setupConfigWatcher(context: vscode.ExtensionContext): void {
    if (fileWatcher) {
        fileWatcher.dispose();
    }

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
        console.warn('[AutoTest] No workspace available for config watcher');
        return;
    }

    const configPath = vscode.workspace.getConfiguration('autotest').get<string>('configPath') || 'autotest-config.json';
    
    const watchPatterns = [
        new vscode.RelativePattern(workspacePath, `.vscode/${configPath}`),
        new vscode.RelativePattern(workspacePath, configPath)
    ];

    fileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspacePath, `**/${configPath}`),
        false,
        false,
        false
    );

    fileWatcher.onDidChange((uri) => {
        console.log('[AutoTest] Config file changed:', uri.fsPath);
        reloadConfig(workspacePath);
        vscode.window.showInformationMessage('AutoTest 配置已自动刷新');
    });

    fileWatcher.onDidCreate((uri) => {
        console.log('[AutoTest] Config file created:', uri.fsPath);
        reloadConfig(workspacePath);
        vscode.window.showInformationMessage('AutoTest 配置文件已创建并加载');
    });

    fileWatcher.onDidDelete((uri) => {
        console.log('[AutoTest] Config file deleted:', uri.fsPath);
        config = defaultConfig;
        configChangeEmitter.fire(defaultConfig);
        vscode.window.showWarningMessage('AutoTest 配置文件已删除，使用默认配置');
    });

    context.subscriptions.push(fileWatcher);
    console.log('[AutoTest] Config watcher setup complete');
}

export function getConfigFilePath(): string {
    return configFilePath;
}

export function dispose(): void {
    if (fileWatcher) {
        fileWatcher.dispose();
        fileWatcher = null;
    }
    configChangeEmitter.dispose();
}

export { defaultConfig };

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
        uploadUrl: "http://192.168.1.100:8080/upload",
        executeCommand: "http://192.168.1.100:8080/execute",
        logDirectory: "/var/logs",
        downloadPath: "./downloads"
    },
    command: {
        executeCommand: "echo 'No command configured'",
        filterPatterns: [],
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
        monitorDirectory: "/var/logs",
        downloadPath: "./downloads",
        refreshInterval: 5000
    }
};

let config: AutoTestConfig | null = null;

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

export function reloadConfig(workspacePath: string): AutoTestConfig {
    return loadConfig(workspacePath);
}

export { defaultConfig };

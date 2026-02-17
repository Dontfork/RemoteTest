import { AutoTestConfig, ProjectConfig, ServerConfig, AIConfig } from '../types';

export interface ConfigValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    missingFields: MissingField[];
    unknownKeys: string[];
}

export interface MissingField {
    path: string;
    field: string;
    projectIndex?: number;
    project?: string;
    defaultValue: any;
}

const VALID_ROOT_KEYS = ['projects', 'ai', 'refreshInterval', 'textFileExtensions', 'outputMode'];

const VALID_PROJECT_KEYS = ['name', 'localPath', 'enabled', 'server', 'commands', 'logs'];

const VALID_SERVER_KEYS = ['host', 'port', 'username', 'password', 'privateKeyPath', 'remoteDirectory'];

const VALID_COMMAND_KEYS = ['name', 'executeCommand', 'includePatterns', 'excludePatterns', 'colorRules', 'runnable'];

const VALID_LOGS_KEYS = ['directories', 'downloadPath'];

const VALID_LOG_DIRECTORY_KEYS = ['name', 'path'];

const VALID_AI_KEYS = ['models', 'defaultModel', 'proxy'];

const VALID_MODEL_KEYS = ['name', 'apiKey', 'apiUrl'];

const REQUIRED_PROJECT_FIELDS = [
    { path: 'name', field: 'name', defaultValue: '未命名工程' },
];

const REQUIRED_SERVER_FIELDS = [
    { path: 'server.host', field: 'host', defaultValue: '' },
    { path: 'server.port', field: 'port', defaultValue: 22 },
    { path: 'server.username', field: 'username', defaultValue: '' },
];

const DEFAULT_AI_CONFIG: AIConfig = {
    models: []
};

function isValidPath(path: string): boolean {
    if (!path || typeof path !== 'string') {
        return false;
    }
    
    if (path.includes('..') || path.includes('~')) {
        return true;
    }
    
    const windowsPathRegex = /^[a-zA-Z]:\\/;
    const posixPathRegex = /^\//;
    
    return windowsPathRegex.test(path) || posixPathRegex.test(path);
}

function isValidHost(host: string): boolean {
    if (!host || typeof host !== 'string') {
        return false;
    }
    
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^\[?([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\]?$/;
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (ipv4Regex.test(host)) {
        const parts = host.split('.');
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }
    
    return ipv6Regex.test(host) || hostnameRegex.test(host);
}

function isValidPort(port: any): boolean {
    if (typeof port !== 'number') {
        return false;
    }
    return Number.isInteger(port) && port > 0 && port <= 65535;
}

function isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
        return false;
    }
    
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function checkUnknownKeys(obj: any, validKeys: string[], path: string): string[] {
    const unknownKeys: string[] = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return unknownKeys;
    }
    
    for (const key of Object.keys(obj)) {
        if (!validKeys.includes(key)) {
            unknownKeys.push(`${path}.${key}`);
        }
    }
    return unknownKeys;
}

export function validateConfig(config: any): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingFields: MissingField[] = [];
    const unknownKeys: string[] = [];

    unknownKeys.push(...checkUnknownKeys(config, VALID_ROOT_KEYS, 'root'));

    if (!config.projects || !Array.isArray(config.projects)) {
        errors.push('配置文件缺少 "projects" 数组');
        missingFields.push({
            path: 'projects',
            field: 'projects',
            defaultValue: []
        });
        return { isValid: false, errors, warnings, missingFields, unknownKeys };
    }

    if (config.projects.length === 0) {
        warnings.push('配置文件中 "projects" 数组为空，请添加至少一个工程配置');
    }

    if (config.refreshInterval !== undefined) {
        if (typeof config.refreshInterval !== 'number') {
            errors.push(`refreshInterval 必须是数字类型，当前类型为 "${typeof config.refreshInterval}"`);
        } else if (config.refreshInterval < 0) {
            errors.push(`refreshInterval 不能为负数，当前值为 ${config.refreshInterval}`);
        } else if (!Number.isInteger(config.refreshInterval)) {
            warnings.push(`refreshInterval 应该是整数，当前值为 ${config.refreshInterval}`);
        }
    }

    if (config.textFileExtensions !== undefined) {
        if (!Array.isArray(config.textFileExtensions)) {
            errors.push(`textFileExtensions 必须是数组类型，当前类型为 "${typeof config.textFileExtensions}"`);
        } else {
            for (let i = 0; i < config.textFileExtensions.length; i++) {
                const ext = config.textFileExtensions[i];
                if (typeof ext !== 'string') {
                    errors.push(`textFileExtensions[${i}] 必须是字符串类型`);
                } else if (!ext.startsWith('.')) {
                    warnings.push(`textFileExtensions[${i}] 建议以点号开头，例如 ".${ext}"`);
                }
            }
        }
    }

    if (config.outputMode !== undefined) {
        const validModes = ['channel', 'webview'];
        const mode = String(config.outputMode).toLowerCase();
        if (!validModes.includes(mode)) {
            warnings.push(`outputMode "${config.outputMode}" 不是有效值，应为 "channel" 或 "webview"，将使用默认值 "channel"`);
        }
    }

    for (let i = 0; i < config.projects.length; i++) {
        const project = config.projects[i];
        const projectPrefix = `projects[${i}]`;

        unknownKeys.push(...checkUnknownKeys(project, VALID_PROJECT_KEYS, projectPrefix));

        for (const required of REQUIRED_PROJECT_FIELDS) {
            if (!project[required.field]) {
                const message = `工程 ${i + 1} 缺少必填字段 "${required.path}"`;
                errors.push(message);
                missingFields.push({
                    path: `${projectPrefix}.${required.path}`,
                    field: required.field,
                    projectIndex: i,
                    project: project.name || `工程${i + 1}`,
                    defaultValue: required.defaultValue
                });
            }
        }

        if (project.localPath && !isValidPath(project.localPath)) {
            warnings.push(`工程 "${project.name || i + 1}" 的 localPath "${project.localPath}" 可能不是有效的绝对路径格式`);
        }

        if (!project.server || typeof project.server !== 'object') {
            errors.push(`工程 "${project.name || i + 1}" 缺少 "server" 配置`);
            missingFields.push({
                path: `${projectPrefix}.server`,
                field: 'server',
                projectIndex: i,
                project: project.name || `工程${i + 1}`,
                defaultValue: {
                    host: '',
                    port: 22,
                    username: '',
                    password: '',
                    privateKeyPath: '',
                    remoteDirectory: ''
                }
            });
        } else {
            unknownKeys.push(...checkUnknownKeys(project.server, VALID_SERVER_KEYS, `${projectPrefix}.server`));

            for (const required of REQUIRED_SERVER_FIELDS) {
                if (project.server[required.field] === undefined || project.server[required.field] === '') {
                    const message = `工程 "${project.name || i + 1}" 的服务器配置缺少 "${required.path}"`;
                    errors.push(message);
                    missingFields.push({
                        path: `${projectPrefix}.${required.path}`,
                        field: required.field,
                        projectIndex: i,
                        project: project.name || `工程${i + 1}`,
                        defaultValue: required.defaultValue
                    });
                }
            }

            if (project.server.host && !isValidHost(project.server.host)) {
                warnings.push(`工程 "${project.name || i + 1}" 的 server.host "${project.server.host}" 可能不是有效的 IP 地址或主机名`);
            }

            if (project.server.port !== undefined && !isValidPort(project.server.port)) {
                errors.push(`工程 "${project.name || i + 1}" 的 server.port "${project.server.port}" 不是有效的端口号（应为 1-65535 的整数）`);
            }

            if (!project.server.password && !project.server.privateKeyPath) {
                warnings.push(`工程 "${project.name || i + 1}" 未配置认证方式，请配置 password 或 privateKeyPath`);
            }
        }

        if (project.commands && Array.isArray(project.commands)) {
            for (let j = 0; j < project.commands.length; j++) {
                const cmd = project.commands[j];
                const cmdPrefix = `projects[${i}].commands[${j}]`;

                unknownKeys.push(...checkUnknownKeys(cmd, VALID_COMMAND_KEYS, cmdPrefix));

                if (!cmd.name || typeof cmd.name !== 'string') {
                    warnings.push(`工程 "${project.name || i + 1}" 的命令 ${j + 1} 缺少 name 字段`);
                }

                if (!cmd.executeCommand || typeof cmd.executeCommand !== 'string') {
                    errors.push(`工程 "${project.name || i + 1}" 的命令 "${cmd.name || j + 1}" 缺少 executeCommand 字段`);
                }

                if (cmd.runnable !== undefined && typeof cmd.runnable !== 'boolean') {
                    errors.push(`工程 "${project.name || i + 1}" 的命令 "${cmd.name || j + 1}" 的 runnable 字段必须是布尔值，当前类型为 "${typeof cmd.runnable}"`);
                }

                if (cmd.includePatterns && !Array.isArray(cmd.includePatterns)) {
                    warnings.push(`工程 "${project.name || i + 1}" 的命令 "${cmd.name || j + 1}" 的 includePatterns 应为数组`);
                }

                if (cmd.excludePatterns && !Array.isArray(cmd.excludePatterns)) {
                    warnings.push(`工程 "${project.name || i + 1}" 的命令 "${cmd.name || j + 1}" 的 excludePatterns 应为数组`);
                }
            }
        }

        if (!project.commands || !Array.isArray(project.commands)) {
            warnings.push(`工程 "${project.name || i + 1}" 未配置命令`);
        }

        if (project.logs) {
            unknownKeys.push(...checkUnknownKeys(project.logs, VALID_LOGS_KEYS, `${projectPrefix}.logs`));

            if (project.logs.directories && Array.isArray(project.logs.directories)) {
                for (let k = 0; k < project.logs.directories.length; k++) {
                    const dir = project.logs.directories[k];
                    unknownKeys.push(...checkUnknownKeys(dir, VALID_LOG_DIRECTORY_KEYS, `${projectPrefix}.logs.directories[${k}]`));

                    if (!dir.path || typeof dir.path !== 'string') {
                        warnings.push(`工程 "${project.name || i + 1}" 的日志目录 ${k + 1} 缺少 path 字段`);
                    }
                    if (!dir.name || typeof dir.name !== 'string') {
                        warnings.push(`工程 "${project.name || i + 1}" 的日志目录 ${k + 1} 缺少 name 字段`);
                    }
                }
            }

            if (project.logs.downloadPath && !isValidPath(project.logs.downloadPath)) {
                warnings.push(`工程 "${project.name || i + 1}" 的 logs.downloadPath "${project.logs.downloadPath}" 可能不是有效的绝对路径格式`);
            }
        }

        if (!project.logs || !project.logs.directories || project.logs.directories.length === 0) {
            warnings.push(`工程 "${project.name || i + 1}" 未配置日志目录`);
        }

        if (project.enabled !== undefined && typeof project.enabled !== 'boolean') {
            warnings.push(`工程 "${project.name || i + 1}" 的 enabled 字段应为布尔值，当前类型为 "${typeof project.enabled}"`);
        }
    }

    if (!config.ai || typeof config.ai !== 'object') {
        warnings.push('配置文件缺少 "ai" 配置，将使用默认 AI 配置');
    } else {
        if (config.ai.provider || config.ai.qwen || config.ai.openai) {
            warnings.push('AI 配置格式已更新，请将旧格式（provider/qwen/openai）迁移为新格式（models 数组）。' +
                '新格式示例: {"models": [{"name": "qwen-turbo", "apiKey": "your-key"}], "defaultModel": "qwen-turbo"}');
        }

        unknownKeys.push(...checkUnknownKeys(config.ai, VALID_AI_KEYS, 'ai'));

        if (!config.ai.models || !Array.isArray(config.ai.models)) {
            warnings.push('AI 配置缺少 "models" 数组，AI 对话功能将无法使用');
        } else {
            if (config.ai.models.length === 0) {
                warnings.push('AI 配置的 "models" 数组为空，AI 对话功能将无法使用');
            }

            for (let i = 0; i < config.ai.models.length; i++) {
                const model = config.ai.models[i];
                const modelPrefix = `ai.models[${i}]`;

                unknownKeys.push(...checkUnknownKeys(model, VALID_MODEL_KEYS, modelPrefix));

                if (!model.name || typeof model.name !== 'string') {
                    warnings.push(`AI 模型 ${i + 1} 缺少 "name" 字段`);
                }

                if (model.apiUrl && !isValidUrl(model.apiUrl)) {
                    warnings.push(`AI 模型 "${model.name || i + 1}" 的 apiUrl "${model.apiUrl}" 不是有效的 URL`);
                }
            }

            if (config.ai.proxy && typeof config.ai.proxy === 'string') {
                const proxyParts = config.ai.proxy.split(':');
                if (proxyParts.length !== 2 || isNaN(parseInt(proxyParts[1], 10))) {
                    warnings.push(`AI proxy "${config.ai.proxy}" 格式不正确，应为 "host:port"`);
                }
            }

            if (config.ai.defaultModel) {
                const modelNames = config.ai.models.map((m: any) => m.name);
                if (!modelNames.includes(config.ai.defaultModel)) {
                    warnings.push(`AI 配置的 defaultModel "${config.ai.defaultModel}" 在 models 中不存在`);
                }
            }
        }
    }

    if (config.refreshInterval === undefined) {
        warnings.push('未配置 refreshInterval，将使用默认值 0（禁用自动刷新）');
    }

    if (unknownKeys.length > 0) {
        warnings.push(`配置文件包含未知字段: ${unknownKeys.join(', ')}`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        missingFields,
        unknownKeys
    };
}

export function fillMissingFields(config: any, missingFields: MissingField[]): any {
    const result = JSON.parse(JSON.stringify(config));

    for (const missing of missingFields) {
        const pathParts = missing.path.split('.');
        let current: any = result;

        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
            
            if (arrayMatch) {
                const arrayName = arrayMatch[1];
                const arrayIndex = parseInt(arrayMatch[2], 10);
                
                if (!current[arrayName]) {
                    current[arrayName] = [];
                }
                if (!current[arrayName][arrayIndex]) {
                    current[arrayName][arrayIndex] = {};
                }
                current = current[arrayName][arrayIndex];
            } else {
                if (!current[part]) {
                    current[part] = {};
                }
                current = current[part];
            }
        }

        const lastPart = pathParts[pathParts.length - 1];
        const lastArrayMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);
        
        if (lastArrayMatch) {
            const arrayName = lastArrayMatch[1];
            const arrayIndex = parseInt(lastArrayMatch[2], 10);
            
            if (!current[arrayName]) {
                current[arrayName] = [];
            }
            if (current[arrayName][arrayIndex] === undefined || current[arrayName][arrayIndex] === '') {
                current[arrayName][arrayIndex] = missing.defaultValue;
            }
        } else {
            if (current[lastPart] === undefined || current[lastPart] === '') {
                current[lastPart] = missing.defaultValue;
            }
        }
    }

    if (!result.ai) {
        result.ai = DEFAULT_AI_CONFIG;
    } else {
        result.ai = {
            models: result.ai.models || [],
            defaultModel: result.ai.defaultModel
        };
    }

    if (result.refreshInterval === undefined) {
        result.refreshInterval = 0;
    }

    for (const project of result.projects) {
        if (!project.commands) {
            project.commands = [];
        }

        if (!project.logs) {
            project.logs = {
                directories: [],
                downloadPath: ''
            };
        }
        if (!project.logs.directories) {
            project.logs.directories = [];
        }
        if (!project.logs.downloadPath) {
            project.logs.downloadPath = '';
        }

        if (project.enabled === undefined) {
            project.enabled = true;
        }
    }

    return result;
}

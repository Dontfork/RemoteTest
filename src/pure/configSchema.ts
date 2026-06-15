/**
 * 配置 schema、校验与默认值填充（纯逻辑，不依赖 vscode）
 *
 * 从 config/index.ts（defaultConfig/deepMerge/checkPathConflict）与
 * config/validator.ts（VALID_KEYS / REQUIRED_FIELDS / validateConfig / fillMissingFields）抽出。
 */
import * as path from 'path';
import {
    RemoteTestConfig,
    ProjectConfig
} from '../types';
import { normalizePath, isValidPath, isValidHost, isValidPort } from './pathUtil';

/* -------------------------------------------------------------------------- */
/* 默认配置                                                                     */
/* -------------------------------------------------------------------------- */

export const defaultConfig: RemoteTestConfig = {
    projects: [
        {
            name: "我的测试项目",
            localPath: "",
            enabled: true,
            server: {
                host: "192.168.1.100",
                port: 22,
                username: "root",
                password: "",
                privateKeyPath: "",
                remoteDirectory: "/home/user/project"
            },
            commands: [
                {
                    name: "运行测试",
                    executeCommand: "pytest {filePath} -v",
                    runnable: true,
                    clearOutputBeforeRun: true,
                    includePatterns: [],
                    excludePatterns: []
                }
            ],
            logs: {
                directories: [
                    { name: "应用日志", path: "/var/log/app" }
                ],
                downloadPath: "D:\\downloads\\logs"
            },
            textFileExtensions: [],
            commitCount: 1
        }
    ],
    refreshInterval: 0,
    useLogOutputChannel: true,
    textFileExtensions: [],
    logViewer: "",
    commitCount: 1
};

/** 浅深合并对象（不展开数组，不合并 undefined）。 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key in source) {
        if (source[key] !== undefined) {
            if (
                typeof source[key] === 'object' &&
                source[key] !== null &&
                !Array.isArray(source[key]) &&
                typeof target[key] === 'object' &&
                target[key] !== null
            ) {
                result[key] = deepMerge(target[key], source[key] as any);
            } else {
                result[key] = source[key] as any;
            }
        }
    }
    return result;
}

/**
 * 检测工程之间的路径包含冲突，并自动禁用冲突工程。
 *
 * 返回冲突描述列表；同时会就地修改 `projects` 中冲突工程的 enabled=false。
 */
export function checkPathConflict(projects: ProjectConfig[]): { hasConflict: boolean; conflicts: string[] } {
    const conflicts: string[] = [];
    const enabledProjects: ProjectConfig[] = [];

    for (const project of projects) {
        if (!project.localPath) {
            continue;
        }

        const normalizedPath = normalizePath(project.localPath);

        for (const existing of enabledProjects) {
            if (!existing.localPath) {
                continue;
            }
            const existingPath = normalizePath(existing.localPath);

            if (normalizedPath.startsWith(existingPath + path.sep) ||
                existingPath.startsWith(normalizedPath + path.sep)) {
                conflicts.push(`工程 "${project.name}" (${project.localPath}) 与工程 "${existing.name}" (${existing.localPath}) 存在路径包含关系`);
                project.enabled = false;
                break;
            }
        }

        if (project.enabled !== false) {
            enabledProjects.push(project);
        }
    }

    return { hasConflict: conflicts.length > 0, conflicts };
}

/* -------------------------------------------------------------------------- */
/* 校验                                                                         */
/* -------------------------------------------------------------------------- */

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

export const VALID_ROOT_KEYS = ['projects', 'refreshInterval', 'textFileExtensions', 'clearOutputBeforeRun', 'useLogOutputChannel', 'logViewer', 'commitCount'];

export const VALID_PROJECT_KEYS = ['name', 'localPath', 'enabled', 'server', 'commands', 'logs', 'textFileExtensions', 'commitCount'];

export const VALID_SERVER_KEYS = ['host', 'port', 'username', 'password', 'privateKeyPath', 'remoteDirectory'];

export const VALID_COMMAND_KEYS = ['name', 'executeCommand', 'includePatterns', 'excludePatterns', 'runnable', 'clearOutputBeforeRun'];

export const VALID_LOGS_KEYS = ['directories', 'downloadPath'];

export const VALID_LOG_DIRECTORY_KEYS = ['name', 'path'];

export const REQUIRED_PROJECT_FIELDS = [
    { path: 'name', field: 'name', defaultValue: '未命名工程' },
];

export const REQUIRED_SERVER_FIELDS = [
    { path: 'server.host', field: 'host', defaultValue: '' },
    { path: 'server.port', field: 'port', defaultValue: 22 },
    { path: 'server.username', field: 'username', defaultValue: '' },
];

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

export { isValidPath, isValidHost, isValidPort };

/**
 * 校验配置对象，返回错误/警告/缺失字段/未知字段。
 *
 * 与原 config/validator.ts 行为逐行等价。
 */
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

    if (config.useLogOutputChannel !== undefined && typeof config.useLogOutputChannel !== 'boolean') {
        errors.push(`useLogOutputChannel 必须是布尔类型，当前类型为 "${typeof config.useLogOutputChannel}"`);
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

                if (cmd.clearOutputBeforeRun !== undefined && typeof cmd.clearOutputBeforeRun !== 'boolean') {
                    errors.push(`工程 "${project.name || i + 1}" 的命令 "${cmd.name || j + 1}" 的 clearOutputBeforeRun 字段必须是布尔值，当前类型为 "${typeof cmd.clearOutputBeforeRun}"`);
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

        if (project.textFileExtensions !== undefined) {
            if (!Array.isArray(project.textFileExtensions)) {
                errors.push(`工程 "${project.name || i + 1}" 的 textFileExtensions 必须是数组类型，当前类型为 "${typeof project.textFileExtensions}"`);
            } else {
                for (let e = 0; e < project.textFileExtensions.length; e++) {
                    const ext = project.textFileExtensions[e];
                    if (typeof ext !== 'string') {
                        errors.push(`工程 "${project.name || i + 1}" 的 textFileExtensions[${e}] 必须是字符串类型`);
                    } else if (!ext.startsWith('.')) {
                        warnings.push(`工程 "${project.name || i + 1}" 的 textFileExtensions[${e}] 建议以点号开头，例如 ".${ext}"`);
                    }
                }
            }
        }

        if (project.commitCount !== undefined) {
            if (typeof project.commitCount !== 'number') {
                errors.push(`工程 "${project.name || i + 1}" 的 commitCount 必须是数字类型，当前类型为 "${typeof project.commitCount}"`);
            } else if (!Number.isInteger(project.commitCount) || project.commitCount < 0) {
                errors.push(`工程 "${project.name || i + 1}" 的 commitCount 必须是非负整数，当前值为 ${project.commitCount}`);
            }
        }
    }

    if (config.refreshInterval === undefined) {
        warnings.push('未配置 refreshInterval，将使用默认值 0（禁用自动刷新）');
    }

    if (config.commitCount !== undefined) {
        if (typeof config.commitCount !== 'number') {
            errors.push(`commitCount 必须是数字类型，当前类型为 "${typeof config.commitCount}"`);
        } else if (!Number.isInteger(config.commitCount) || config.commitCount < 0) {
            errors.push(`commitCount 必须是非负整数，当前值为 ${config.commitCount}`);
        }
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

/** 按缺失字段路径补齐默认值，并补全结构化字段（commands/logs/enabled/refreshInterval）。 */
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

/**
 * 路径工具（纯逻辑，不依赖 vscode）
 *
 * 汇总分散在 config/index.ts、validator.ts、scpClient.ts、changesTreeView.ts、uploader.ts
 * 中的路径相关纯函数。
 */
import * as path from 'path';

/** 归一化并转小写，用于路径比较（忽略大小写差异）。 */
export function normalizePath(p: string): string {
    return path.normalize(p).toLowerCase();
}

/** 是否为绝对路径（跨平台）。 */
export function isAbsolutePath(p: string): boolean {
    return path.isAbsolute(p);
}

/**
 * 粗略校验字符串是否为有效的绝对路径格式。
 *
 * - 含 `..` 视为非法；
 * - 以 `~` 开头视为合法（家目录）；
 * - 否则需匹配 Windows 盘符 (`C:\`) 或 POSIX (`/`) 形式。
 *
 * 从 config/validator.ts 抽出。
 */
export function isValidPath(p: string): boolean {
    if (!p || typeof p !== 'string') {
        return false;
    }

    if (p.includes('..')) {
        return false;
    }

    if (p.startsWith('~')) {
        return true;
    }

    const windowsPathRegex = /^[a-zA-Z]:\\/;
    const posixPathRegex = /^\//;

    return windowsPathRegex.test(p) || posixPathRegex.test(p);
}

/** 把路径中的反斜杠统一成正斜杠，用于展示相对路径。 */
export function toDisplayPath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/');
}

/** 校验主机名/IP（IPv4/IPv6/hostname）。 */
export function isValidHost(host: string): boolean {
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

/** 校验端口为 1-65535 的整数。 */
export function isValidPort(port: any): boolean {
    if (typeof port !== 'number') {
        return false;
    }
    return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * 计算本地文件对应的远程路径。
 *
 * 要求本地路径必须位于工程 localPath 之内，否则抛错。
 * 返回值使用 posix 分隔符（远程为 Linux）。
 *
 * 从 core/uploader.ts FileUploader.calculateRemotePath 抽出。
 */
export function calculateRemotePath(
    localFilePath: string,
    projectLocalPath: string,
    remoteDirectory: string
): string {
    if (!projectLocalPath || projectLocalPath.trim() === '') {
        throw new Error('未配置 localPath，无法进行文件上传');
    }
    if (!remoteDirectory || remoteDirectory.trim() === '') {
        throw new Error('未配置 remoteDirectory，无法进行文件上传');
    }

    const normalizedLocalPath = path.normalize(localFilePath);
    const normalizedProjectPath = path.normalize(projectLocalPath);

    if (normalizedLocalPath.toLowerCase() !== normalizedProjectPath.toLowerCase() &&
        !normalizedLocalPath.toLowerCase().startsWith(normalizedProjectPath.toLowerCase() + path.sep)) {
        throw new Error(`文件路径 "${localFilePath}" 不在工程路径 "${projectLocalPath}" 内`);
    }

    const relativePath = path.relative(normalizedProjectPath, normalizedLocalPath);
    const posixRelativePath = relativePath.split(path.sep).join(path.posix.sep);
    return path.posix.join(remoteDirectory, posixRelativePath);
}

/** 将工程相对路径映射为远程 posix 路径。 */
export function relativeToRemotePath(relativePath: string, remoteDirectory: string): string {
    return path.posix.join(remoteDirectory, relativePath.replace(/\\/g, '/'));
}

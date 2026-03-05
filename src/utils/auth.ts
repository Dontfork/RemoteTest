import * as fs from 'fs';
import { ServerConfig } from '../types';

/**
 * SSH认证配置接口
 * 
 * 该接口定义了SSH连接所需的认证信息，支持密码和私钥两种认证方式。
 * 根据服务器配置自动选择合适的认证方式。
 */
export interface SSHAuthConfig {
    /** 私钥内容（Buffer格式），用于密钥认证 */
    privateKey?: Buffer;
    /** 密码，用于密码认证 */
    password?: string;
}

/**
 * 创建SSH认证配置
 * 
 * 根据服务器配置生成SSH认证信息。优先使用私钥认证，如果私钥不存在则使用密码认证。
 * 这确保了认证方式的灵活性和安全性。
 * 
 * @param serverConfig - 服务器配置对象，包含认证所需的信息
 * @returns SSH认证配置对象，包含privateKey或password
 * @throws {Error} 当既没有配置私钥路径也没有配置密码时抛出错误
 * 
 * @example
 * ```typescript
 * const serverConfig: ServerConfig = {
 *     host: '192.168.1.100',
 *     port: 22,
 *     username: 'root',
 *     privateKeyPath: '/path/to/private/key',
 *     password: '',
 *     remoteDirectory: '/home/user'
 * };
 * 
 * const authConfig = createSSHAuthConfig(serverConfig);
 * // 返回: { privateKey: <Buffer> }
 * ```
 * 
 * @example
 * ```typescript
 * const serverConfig: ServerConfig = {
 *     host: '192.168.1.100',
 *     port: 22,
 *     username: 'root',
 *     password: 'mypassword',
 *     privateKeyPath: '',
 *     remoteDirectory: '/home/user'
 * };
 * 
 * const authConfig = createSSHAuthConfig(serverConfig);
 * // 返回: { password: 'mypassword' }
 * ```
 */
export function createSSHAuthConfig(serverConfig: ServerConfig): SSHAuthConfig {
    if (serverConfig.privateKeyPath && fs.existsSync(serverConfig.privateKeyPath)) {
        return { 
            privateKey: fs.readFileSync(serverConfig.privateKeyPath) 
        };
    }
    
    if (serverConfig.password) {
        return { 
            password: serverConfig.password 
        };
    }
    
    throw new Error('未配置 SSH 认证方式（密码或私钥）');
}

/**
 * 验证服务器配置是否包含有效的认证信息
 * 
 * 检查服务器配置是否包含至少一种有效的认证方式（密码或私钥）。
 * 这是一个轻量级的验证方法，不会实际读取私钥文件。
 * 
 * @param serverConfig - 服务器配置对象
 * @returns 如果配置了密码或私钥路径则返回true，否则返回false
 * 
 * @example
 * ```typescript
 * const config1 = { password: 'pass', privateKeyPath: '' };
 * hasValidAuth(config1); // true
 * 
 * const config2 = { password: '', privateKeyPath: '/path/to/key' };
 * hasValidAuth(config2); // true
 * 
 * const config3 = { password: '', privateKeyPath: '' };
 * hasValidAuth(config3); // false
 * ```
 */
export function hasValidAuth(serverConfig: ServerConfig): boolean {
    return !!(serverConfig.password || serverConfig.privateKeyPath);
}

/**
 * 获取认证方式描述
 * 
 * 返回当前配置使用的认证方式的友好描述，用于日志记录和用户提示。
 * 
 * @param serverConfig - 服务器配置对象
 * @returns 认证方式描述字符串
 * 
 * @example
 * ```typescript
 * const config = { password: 'pass', privateKeyPath: '' };
 * getAuthType(config); // '密码认证'
 * 
 * const config2 = { password: '', privateKeyPath: '/path/to/key' };
 * getAuthType(config2); // '私钥认证'
 * ```
 */
export function getAuthType(serverConfig: ServerConfig): string {
    if (serverConfig.privateKeyPath && fs.existsSync(serverConfig.privateKeyPath)) {
        return '私钥认证';
    }
    if (serverConfig.password) {
        return '密码认证';
    }
    return '未配置认证';
}

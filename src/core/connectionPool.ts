import SftpClient from 'ssh2-sftp-client';
import { ServerConfig } from '../types';
import { createSSHAuthConfig } from '../utils/auth';

interface PooledConnection {
    client: SftpClient;
    lastUsed: number;
    serverKey: string;
}

let debugLogFn: ((msg: string) => void) | null = null;

export function setConnectionPoolLogger(fn: (msg: string) => void): void {
    debugLogFn = fn;
}

function debugLog(msg: string): void {
    if (debugLogFn) {
        debugLogFn(`[连接池] ${msg}`);
    }
}

export class ConnectionPool {
    private static instance: ConnectionPool | null = null;
    private connections: Map<string, PooledConnection> = new Map();
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;
    private readonly IDLE_TIMEOUT = 60000;
    private readonly CLEANUP_INTERVAL = 30000;
    private maxConnections: number = 10;

    private constructor() {
        this.startCleanupTimer();
    }

    static getInstance(): ConnectionPool {
        if (!ConnectionPool.instance) {
            ConnectionPool.instance = new ConnectionPool();
        }
        return ConnectionPool.instance;
    }

    private getServerKey(config: ServerConfig): string {
        return `${config.host}:${config.port}:${config.username}`;
    }

    private createSftpConfig(serverConfig: ServerConfig): SftpClient.ConnectOptions {
        const sftpConfig: SftpClient.ConnectOptions = {
            host: serverConfig.host,
            port: serverConfig.port,
            username: serverConfig.username,
            readyTimeout: 30000
        };

        const authConfig = createSSHAuthConfig(serverConfig);
        Object.assign(sftpConfig, authConfig);

        return sftpConfig;
    }

    async getConnection(serverConfig: ServerConfig): Promise<SftpClient> {
        const key = this.getServerKey(serverConfig);
        const pooled = this.connections.get(key);

        if (pooled) {
            try {
                await pooled.client.list('/');
                pooled.lastUsed = Date.now();
                return pooled.client;
            } catch (checkErr) {
                debugLog(`连接 ${key} 已断开，重新创建 (${checkErr})`);
                try {
                    await pooled.client.end();
                } catch (endErr) {
                    debugLog(`关闭旧连接失败: ${endErr}`);
                }
                this.connections.delete(key);
            }
        }

        if (this.connections.size >= this.maxConnections) {
            await this.evictOldestConnection();
        }

        const client = new SftpClient();
        const sftpConfig = this.createSftpConfig(serverConfig);
        await client.connect(sftpConfig);

        this.connections.set(key, {
            client,
            lastUsed: Date.now(),
            serverKey: key
        });

        debugLog(`新建连接: ${key} (当前连接数: ${this.connections.size})`);
        return client;
    }

    private async evictOldestConnection(): Promise<void> {
        let oldest: PooledConnection | null = null;
        let oldestKey: string | null = null;

        for (const [key, conn] of this.connections) {
            if (!oldest || conn.lastUsed < oldest.lastUsed) {
                oldest = conn;
                oldestKey = key;
            }
        }

        if (oldest && oldestKey) {
            try {
                await oldest.client.end();
            } catch (endErr) {
                debugLog(`淘汰连接关闭失败: ${endErr}`);
            }
            this.connections.delete(oldestKey);
            debugLog(`淘汰最旧连接: ${oldestKey}`);
        }
    }

    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupIdleConnections();
        }, this.CLEANUP_INTERVAL);
    }

    private async cleanupIdleConnections(): Promise<void> {
        const now = Date.now();
        const keysToRemove: string[] = [];

        for (const [key, conn] of this.connections) {
            if (now - conn.lastUsed > this.IDLE_TIMEOUT) {
                keysToRemove.push(key);
            }
        }

        for (const key of keysToRemove) {
            const conn = this.connections.get(key);
            if (conn) {
                try {
                    await conn.client.end();
                } catch (endErr) {
                    debugLog(`空闲连接关闭失败: ${endErr}`);
                }
                this.connections.delete(key);
            }
        }

        if (keysToRemove.length > 0) {
            debugLog(`清理 ${keysToRemove.length} 个空闲连接`);
        }
    }

    async releaseConnection(serverConfig: ServerConfig): Promise<void> {
        const key = this.getServerKey(serverConfig);
        const pooled = this.connections.get(key);

        if (pooled) {
            try {
                await pooled.client.end();
            } catch (endErr) {
                debugLog(`释放连接关闭失败: ${endErr}`);
            }
            this.connections.delete(key);
        }
    }

    async releaseAll(): Promise<void> {
        for (const [key, conn] of this.connections) {
            try {
                await conn.client.end();
            } catch (endErr) {
                debugLog(`释放全部连接关闭失败 (${key}): ${endErr}`);
            }
        }
        this.connections.clear();
    }

    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.releaseAll();
        ConnectionPool.instance = null;
    }

    getPoolStats(): { totalConnections: number; connections: Array<{ serverKey: string; lastUsed: Date }> } {
        const connections = Array.from(this.connections.values()).map(conn => ({
            serverKey: conn.serverKey,
            lastUsed: new Date(conn.lastUsed)
        }));

        return {
            totalConnections: this.connections.size,
            connections
        };
    }
}

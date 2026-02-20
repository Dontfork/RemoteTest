# 日志监控模块 (LogMonitor Module)

## 1. 模块概述

日志监控模块负责监控远程服务器上的日志文件，提供多目录监控、日志文件列表获取、目录浏览、日志下载等功能。模块通过 SSH/SCP 协议与远程服务器交互，支持树形视图展示目录结构和文件信息。支持多项目环境，日志目录可关联到特定项目，自动使用项目服务器配置。

## 2. 设计方案

### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    LogMonitor Module                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         getDirectories()                             │    │
│  │  从配置获取监控目录列表（含项目关联）                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         fetchDirectoryContents(path, project)        │    │
│  │  通过 SCP 获取远程目录内容（使用项目服务器配置）       │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         fetchAllDirectories()                        │    │
│  │  获取所有配置目录的内容（含连接间隔优化）              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         downloadLog(logFile, project)                │    │
│  │  通过 SCP 下载远程日志文件                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         downloadLogWithProgress(logFile, project)    │    │
│  │  带进度提示的下载功能                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         getLoadError(dirPath)                        │    │
│  │  获取目录加载错误信息                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 工作流程

```
插件激活
    │
    ▼
读取配置中的日志目录列表（含项目关联）
    │
    ▼
TreeView 显示目录列表
    │
    ├── 用户点击目录
    │       │
    │       ▼
    │   fetchDirectoryContents(path, project)
    │       │
    │       ▼
    │   SCP 连接远程服务器（使用项目服务器配置）
    │       │
    │       ▼
    │   获取目录内容（文件和子目录）
    │       │
    │       ▼
    │   显示文件列表（含大小、修改时间）
    │       │
    │       ▼
    │   如有错误，显示错误信息
    │
    ├── 用户点击子目录
    │       │
    │       ▼
    │   递归获取子目录内容
    │
    └── 用户点击文件
            │
            ▼
        downloadLogWithProgress(logFile, project)
            │
            ▼
        SCP 下载文件到本地（使用项目下载路径）
            │
            ▼
        显示下载完成提示
```

### 2.3 多项目支持

日志目录可关联到特定项目，实现多环境日志监控：

| 属性 | 类型 | 说明 |
|------|------|------|
| name | string | 目录在界面显示的名称 |
| path | string | 远程服务器上的目录路径 |
| projectName | string | 关联的项目名称（可选） |

关联项目后：
- 自动使用项目配置的服务器连接信息
- 日志下载到项目配置的 downloadPath
- 界面显示项目名称便于识别

配置示例：
```json
{
    "projects": [
        {
            "name": "项目A",
            "localPath": "D:\\projectA",
            "server": { "host": "192.168.1.100", ... },
            "logs": {
                "directories": [
                    { "name": "应用日志", "path": "/var/log/projectA/app" },
                    { "name": "测试日志", "path": "/var/log/projectA/test" }
                ],
                "downloadPath": "D:\\downloads\\projectA"
            }
        },
        {
            "name": "项目B",
            "localPath": "D:\\projectB",
            "server": { "host": "192.168.1.200", ... },
            "logs": {
                "directories": [
                    { "name": "应用日志", "path": "/var/log/projectB/app" }
                ],
                "downloadPath": "D:\\downloads\\projectB"
            }
        }
    ],
    "refreshInterval": 0
}
```

## 3. 类型定义

### 3.1 日志目录配置

```typescript
interface LogDirectoryConfig {
    name: string;           // 目录显示名称，如 "应用日志"
    path: string;           // 远程目录路径，如 "/var/log/myapp"
    projectName?: string;   // 关联的项目名称（可选）
}
```

### 3.2 日志文件/目录接口

```typescript
interface LogFile {
    name: string;           // 文件/目录名，如 "app.log" 或 "subdir"
    path: string;           // 完整路径，如 "/var/logs/app.log"
    size: number;           // 大小（字节）
    modifiedTime: Date;     // 最后修改时间
    isDirectory: boolean;   // 是否为目录
}
```

### 3.3 项目日志配置接口

```typescript
interface ProjectLogsConfig {
    directories: LogDirectoryConfig[];  // 监控目录列表
    downloadPath: string;               // 下载路径
}
```

### 3.4 全局配置

```typescript
interface RemoteTestConfig {
    projects: ProjectConfig[];  // 多工程配置数组
    ai: AIConfig;               // AI 服务配置
    refreshInterval?: number;   // 全局日志刷新间隔（毫秒），默认 0（禁用）
}
```

## 4. 功能实现

### 4.1 类结构

```typescript
export class LogMonitor {
    private logFilesCache: Map<string, LogFile[]> = new Map();
    private loadErrors: Map<string, string> = new Map();

    constructor();
    
    // 自动刷新控制
    isAutoRefreshEnabled(): boolean;
    
    // 目录管理
    getDirectories(): LogDirectoryConfig[];
    getProjectForDirectory(dir: LogDirectoryConfig): ProjectConfig | null;
    
    // 内容获取
    async fetchDirectoryContents(
        dirPath: string, 
        project: ProjectConfig | null
    ): Promise<{ files: LogFile[]; error: string | null }>;
    
    async fetchAllDirectories(): Promise<Map<string, LogFile[]>>;
    
    // 错误信息
    getLoadError(dirPath: string): string | null;
    
    // 下载功能
    async downloadLog(logFile: LogFile, project: ProjectConfig | null): Promise<string>;
    async downloadLogWithProgress(logFile: LogFile, project: ProjectConfig | null): Promise<string>;
    
    // 缓存管理
    getCachedFiles(dirPath: string): LogFile[] | undefined;
}
```

### 4.2 核心方法

#### isAutoRefreshEnabled(): boolean

检查是否启用自动刷新。

**返回值**：
- `boolean`: 是否启用自动刷新

**实现逻辑**：
```typescript
isAutoRefreshEnabled(): boolean {
    return getRefreshInterval() > 0;
}
```

#### getDirectories(): LogDirectoryConfig[]

获取配置的监控目录列表。

**返回值**：
- `LogDirectoryConfig[]`: 目录配置数组

#### getProjectForDirectory(dir: LogDirectoryConfig): ProjectConfig | null

获取目录关联的项目配置。

**参数**：
- `dir`: 日志目录配置

**返回值**：
- `ProjectConfig | null`: 关联的项目配置，无关联则返回 null

#### fetchDirectoryContents(dirPath: string, project: ProjectConfig | null): Promise<{ files: LogFile[]; error: string | null }>

获取指定目录的内容列表。

**参数**：
- `dirPath`: 远程目录路径
- `project`: 项目配置（用于获取服务器连接信息）

**返回值**：
- `Promise<{ files: LogFile[]; error: string | null }>`: 文件列表和错误信息

**实现逻辑**：
```typescript
async fetchDirectoryContents(
    dirPath: string, 
    project: ProjectConfig | null = null
): Promise<{ files: LogFile[]; error: string | null }> {
    try {
        const serverConfig = this.getServerConfig(project);
        const scpClient = new SCPClient(serverConfig);
        try {
            const items = await scpClient.listDirectory(dirPath);
            const sortedItems = items.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) {
                    return a.isDirectory ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
            return { files: sortedItems, error: null };
        } finally {
            await scpClient.disconnect();
        }
    } catch (error: any) {
        const errorMsg = error.message || '未知错误';
        log(`加载目录 ${dirPath} 失败: ${errorMsg}`);
        return { files: [], error: errorMsg };
    }
}
```

#### fetchAllDirectories(): Promise<Map<string, LogFile[]>>

获取所有配置目录的内容（含连接间隔优化）。

**返回值**：
- `Promise<Map<string, LogFile[]>>`: 目录路径到文件列表的映射

**实现逻辑**：
```typescript
async fetchAllDirectories(): Promise<Map<string, LogFile[]>> {
    const allDirs = getAllLogDirectories();
    const results = new Map<string, LogFile[]>();
    this.loadErrors.clear();

    log(`开始加载 ${allDirs.length} 个日志目录`);

    for (const item of allDirs) {
        const projectName = item.project ? item.project.name : '未知项目';
        log(`加载目录: ${item.directory.path} (项目: ${projectName})`);
        
        const { files, error } = await this.fetchDirectoryContents(
            item.directory.path, 
            item.project
        );
        results.set(item.directory.path, files);
        this.logFilesCache.set(item.directory.path, files);
        
        if (error) {
            this.loadErrors.set(item.directory.path, error);
            log(`目录 ${item.directory.path} 加载失败: ${error}`);
        } else {
            log(`目录 ${item.directory.path} 加载成功，共 ${files.length} 个文件`);
        }

        // 连接间隔优化：避免 SSH 连接过于频繁
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    log(`日志目录加载完成，成功: ${results.size - this.loadErrors.size}，失败: ${this.loadErrors.size}`);
    return results;
}
```

#### getLoadError(dirPath: string): string | null

获取目录加载错误信息。

**参数**：
- `dirPath`: 目录路径

**返回值**：
- `string | null`: 错误信息，无错误则返回 null

### 4.3 下载方法

#### downloadLog(logFile: LogFile, project: ProjectConfig | null): Promise<string>

下载指定日志文件到本地。

**参数**：
- `logFile`: 要下载的日志文件对象
- `project`: 项目配置（用于获取下载路径）

**返回值**：
- `Promise<string>`: 本地文件路径

**实现逻辑**：
```typescript
async downloadLog(logFile: LogFile, project: ProjectConfig | null): Promise<string> {
    if (logFile.isDirectory) {
        throw new Error('不能下载目录');
    }

    const serverConfig = this.getServerConfig(project);
    const scpClient = new SCPClient(serverConfig);
    
    // 获取项目配置的下载路径
    const downloadPath = project?.logs?.downloadPath || '';
    if (!downloadPath) {
        throw new Error('未配置日志下载路径');
    }
    
    // 确保下载目录存在
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
    }

    const localPath = path.join(downloadPath, logFile.name);
    await scpClient.downloadFile(logFile.path, localPath);
    await scpClient.disconnect();
    
    return localPath;
}
```

#### downloadLogWithProgress(logFile: LogFile, project: ProjectConfig | null): Promise<string>

带进度提示的下载功能。

**参数**：
- `logFile`: 要下载的日志文件对象
- `project`: 项目配置

**返回值**：
- `Promise<string>`: 本地文件路径

### 4.4 辅助函数

#### formatSize(bytes: number): string

格式化文件大小（左对齐，固定宽度）。

```typescript
function formatSize(bytes: number): string {
    if (!bytes || bytes < 1024) return String((bytes || 0)).padStart(6) + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1).padStart(6) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1).padStart(6) + ' MB';
    return (bytes / 1073741824).toFixed(1).padStart(6) + ' GB';
}
```

**示例输出**：
- `512` → `"   512 B"`
- `2048` → `"   2.0 KB"`
- `5242880` → `"   5.0 MB"`

#### formatDate(date: Date): string

格式化日期（右对齐）。

```typescript
function formatDate(date: Date): string {
    try {
        return new Date(date).toLocaleString('zh-CN');
    } catch {
        return '';
    }
}
```

**示例输出**：
- `new Date()` → `"2024/1/15 10:30:00"`

## 5. TreeView 集成

日志监控模块与 VSCode TreeView 集成，显示在资源管理器面板中。

### 5.1 TreeView 数据提供者

```typescript
class LogTreeDataProvider implements vscode.TreeDataProvider<LogTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<LogTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: LogTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: LogTreeItem): Promise<LogTreeItem[]> {
        if (!element) {
            // 根级别：显示配置的目录列表
            const allDirs = getAllLogDirectories();
            return allDirs.map(item => new LogTreeItem(
                item.directory, 
                true, 
                true, 
                item.project
            ));
        }

        if (element.contextValue === 'logDirectory' && element.directoryConfig) {
            // 配置目录：获取其内容
            const { files, error } = await this.logMonitor.fetchDirectoryContents(
                element.directoryConfig.path,
                element.projectConfig
            );
            this.directoryContents.set(element.directoryConfig.path, files);
            
            if (error) {
                return [this.createErrorItem(`加载失败: ${error}`)];
            }
            if (files.length === 0) {
                return [this.createMessageItem('目录为空')];
            }
            return files.map(item => new LogTreeItem(
                item, 
                item.isDirectory, 
                false, 
                element.projectConfig
            ));
        }

        if (element.contextValue === 'logSubDirectory' && element.logFile) {
            // 子目录：获取其内容
            const contents = await this.logMonitor.fetchDirectoryContents(
                element.logFile.path,
                element.projectConfig
            );
            return this.createLogItems(contents);
        }

        return [];
    }

    private createErrorItem(message: string): LogTreeItem {
        return new LogTreeItem({ name: message, path: '', size: 0, modifiedTime: new Date(), isDirectory: false }, false, false);
    }

    private createMessageItem(message: string): LogTreeItem {
        return new LogTreeItem({ name: message, path: '', size: 0, modifiedTime: new Date(), isDirectory: false }, false, false);
    }
}
```

### 5.2 TreeItem 实现

```typescript
class LogTreeItem extends vscode.TreeItem {
    public logFile: LogFile | null;
    public directoryConfig: LogDirectoryConfig | null;
    public projectConfig: ProjectConfig | null;

    constructor(
        item: LogFile | LogDirectoryConfig,
        isDirectory: boolean,
        isConfigDir: boolean = false,
        project: ProjectConfig | null = null
    ) {
        if (isConfigDir) {
            // 配置的顶级目录
            const dir = item as LogDirectoryConfig;
            const displayName = project ? `${dir.name} (${project.name})` : dir.name;
            super(displayName, vscode.TreeItemCollapsibleState.Collapsed);
            this.directoryConfig = dir;
            this.logFile = null;
            this.projectConfig = project;
            this.contextValue = 'logDirectory';
            this.iconPath = new vscode.ThemeIcon('folder');
            this.tooltip = `路径: ${dir.path}${project ? `\n项目: ${project.name}` : ''}`;
        } else if (isDirectory) {
            // 子目录
            const file = item as LogFile;
            super(file.name, vscode.TreeItemCollapsibleState.Collapsed);
            this.logFile = file;
            this.directoryConfig = null;
            this.projectConfig = project;
            this.contextValue = 'logSubDirectory';
            this.iconPath = new vscode.ThemeIcon('folder');
            this.tooltip = `路径: ${file.path}`;
        } else {
            // 文件
            const file = item as LogFile;
            super(file.name, vscode.TreeItemCollapsibleState.None);
            this.logFile = file;
            this.directoryConfig = null;
            this.projectConfig = project;
            // 左对齐文件名，右对齐大小和日期
            this.description = `${formatSize(file.size)} | ${formatDate(file.modifiedTime)}`;
            this.tooltip = `路径: ${file.path}\n大小: ${formatSize(file.size)}\n修改时间: ${formatDate(file.modifiedTime)}`;
            this.contextValue = 'logFile';
            this.iconPath = new vscode.ThemeIcon('file-text');
            this.command = {
                command: 'RemoteTest.downloadLog',
                title: '下载日志',
                arguments: [this]
            };
        }
    }
}
```

### 5.3 TreeView 层级结构

```
日志监控 (TreeView)
├── 应用日志 (项目A) (配置目录，关联项目)
│   ├── subdir1 (子目录)
│   │   ├── log1.log (文件)
│   │   └── log2.log (文件)
│   ├── app.log (文件) - 显示: "   2.0 KB | 2024/1/15 10:30:00"
│   └── error.log (文件) - 显示: "   512 B | 2024/1/15 09:00:00"
├── 测试日志 (项目A) (配置目录)
│   └── test.log (文件)
├── 应用日志 (项目B) (配置目录，不同项目)
│   └── app.log (文件)
└── 加载失败: Connection refused (错误提示)
```

## 6. 命令注册

### 6.1 刷新日志列表

```typescript
vscode.commands.registerCommand('RemoteTest.refreshLogs', () => {
    logTreeDataProvider.refresh();
});
```

### 6.2 下载日志

```typescript
vscode.commands.registerCommand('RemoteTest.downloadLog', async (item: LogTreeItem) => {
    if (item && item.logFile && !item.logFile.isDirectory) {
        await logMonitor.downloadLogWithProgress(item.logFile, item.projectConfig);
    }
});
```

### 6.3 打开日志

```typescript
vscode.commands.registerCommand('RemoteTest.openLog', async (item: LogTreeItem) => {
    if (item && item.logFile && !item.logFile.isDirectory) {
        const localPath = await logMonitor.downloadLog(item.logFile, item.projectConfig);
        const document = await vscode.workspace.openTextDocument(localPath);
        await vscode.window.showTextDocument(document);
    }
});
```

## 7. SCP 客户端集成

日志监控模块依赖 SCP 客户端进行远程文件操作。

### 7.1 构造函数

```typescript
export class SCPClient {
    private sftp: SftpClient | null = null;
    private serverConfig: ServerConfig | null = null;

    constructor(serverConfig?: ServerConfig) {
        this.serverConfig = serverConfig || null;
    }
}
```

### 7.2 listDirectory 函数

获取远程目录内容。

```typescript
async listDirectory(remotePath: string): Promise<LogFile[]> {
    const sftp = await this.connect();
    const items = await sftp.list(remotePath);
    
    return items.map(item => ({
        name: item.name,
        path: path.posix.join(remotePath, item.name),
        size: item.size,
        modifiedTime: new Date(item.modifyTime),
        isDirectory: item.type === 'd'
    }));
}
```

### 7.3 downloadFile 函数

下载远程文件。

```typescript
async downloadFile(remotePath: string, localPath?: string): Promise<string> {
    const sftp = await this.connect();
    const fileName = path.basename(remotePath);
    const local = localPath || path.join(downloadPath, fileName);

    const localDir = path.dirname(local);
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }

    await sftp.fastGet(remotePath, local);
    return local;
}
```

## 8. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| SCP 连接失败 | 返回空数组和错误信息，在界面显示错误 |
| 目录不存在 | 返回空数组和错误信息 |
| 下载目录创建失败 | 抛出异常 |
| 文件下载失败 | 显示错误提示 |
| 尝试下载目录 | 抛出异常，显示提示 |
| 未配置下载路径 | 抛出异常，显示提示 |

## 9. 性能优化

### 9.1 连接间隔优化

为避免 SSH 连接过于频繁导致服务器拒绝连接，在加载多个目录时增加间隔：

```typescript
for (const item of allDirs) {
    const { files, error } = await this.fetchDirectoryContents(item.directory.path, item.project);
    // ... 处理结果 ...
    
    // 连接间隔：100ms
    await new Promise(resolve => setTimeout(resolve, 100));
}
```

### 9.2 缓存机制

- 使用 `logFilesCache` 缓存已加载的目录内容
- 减少重复请求
- 支持手动刷新清除缓存

### 9.3 懒加载

- 按需加载目录内容
- 只在用户展开目录时获取内容
- 文件列表排序在客户端完成

### 9.4 自动刷新控制

- 全局 `refreshInterval` 控制自动刷新
- 默认值为 0（禁用自动刷新）
- 执行用例完成后自动刷新对应项目的日志

## 10. 测试覆盖

日志监控模块测试覆盖以下场景：

- 文件大小格式化测试
- 日期格式化测试
- 日志文件对象创建测试
- 日志目录对象测试
- 文件排序测试（目录优先）
- 路径处理测试
- 项目关联测试
- 错误处理测试
- SCP 客户端集成测试
- 下载功能测试

详见测试文件：`test/suite/logMonitor.test.ts`、`test/suite/logMonitorProject.test.ts`

## 8. 性能优化

### 8.1 SSH 连接池

为减少 SSH 连接开销，系统实现了连接池机制：

**连接池特性**：
- 单例模式管理所有 SSH 连接
- 相同服务器配置复用连接
- 空闲连接自动清理（60秒超时）
- 最大连接数限制（10个）

**连接池配置**：
```typescript
class ConnectionPool {
    private readonly IDLE_TIMEOUT = 60000;      // 空闲超时：60秒
    private readonly CLEANUP_INTERVAL = 30000;  // 清理间隔：30秒
    private maxConnections = 10;                // 最大连接数
}
```

### 8.2 目录加载优化

**按服务器分组加载**：
```typescript
async fetchAllDirectories(): Promise<Map<string, LogFile[]>> {
    // 按服务器分组，减少连接数
    const dirsByServer = new Map<string, Array<{ dir, project }>>();
    
    for (const item of allDirs) {
        const serverKey = `${host}:${port}:${username}`;
        if (!dirsByServer.has(serverKey)) {
            dirsByServer.set(serverKey, []);
        }
        dirsByServer.get(serverKey)!.push(item);
    }
    
    // 每个服务器只建立一次连接
    for (const [serverKey, dirs] of dirsByServer) {
        const scpClient = new SCPClient(serverConfig, true);
        try {
            for (const { dir, project } of dirs) {
                // 复用同一连接加载多个目录
                await scpClient.listDirectory(dir.path);
            }
        } finally {
            await scpClient.disconnect();
        }
    }
}
```

**优化效果**：
- 原来：N 个目录 = N 次 SSH 连接
- 现在：N 个目录 / M 个服务器 = M 次 SSH 连接

### 8.3 连接间隔

目录加载之间增加 50ms 间隔，避免服务器压力过大：

```typescript
await new Promise(resolve => setTimeout(resolve, 50));
```

### 8.4 错误处理优化

- 单个目录加载失败不影响其他目录
- 错误信息缓存并显示在界面上
- 详细日志输出便于问题诊断

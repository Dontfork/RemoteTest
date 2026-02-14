# 日志监控模块 (LogMonitor Module)

## 1. 模块概述

日志监控模块负责监控远程服务器上的日志文件，提供多目录监控、日志文件列表获取、目录浏览、日志下载等功能。模块通过 SSH/SCP 协议与远程服务器交互，支持树形视图展示目录结构和文件信息。

## 2. 设计方案

### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    LogMonitor Module                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         getDirectories()                             │    │
│  │  从配置获取监控目录列表                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         fetchDirectoryContents(path)                 │    │
│  │  通过 SCP 获取远程目录内容                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         fetchAllDirectories()                        │    │
│  │  获取所有配置目录的内容                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         downloadLog(logFile)                         │    │
│  │  通过 SCP 下载远程日志文件                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         downloadLogWithProgress(logFile)             │    │
│  │  带进度提示的下载功能                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 工作流程

```
插件激活
    │
    ▼
读取配置中的日志目录列表
    │
    ▼
TreeView 显示目录列表
    │
    ├── 用户点击目录
    │       │
    │       ▼
    │   fetchDirectoryContents()
    │       │
    │       ▼
    │   SCP 连接远程服务器
    │       │
    │       ▼
    │   获取目录内容（文件和子目录）
    │       │
    │       ▼
    │   显示文件列表（含大小、修改时间）
    │
    ├── 用户点击子目录
    │       │
    │       ▼
    │   递归获取子目录内容
    │
    └── 用户点击文件
            │
            ▼
        downloadLogWithProgress()
            │
            ▼
        SCP 下载文件到本地
            │
            ▼
        显示下载完成提示
```

### 2.3 多目录监控设计

模块支持配置多个日志监控目录，每个目录包含：

| 属性 | 类型 | 说明 |
|------|------|------|
| name | string | 目录在界面显示的名称 |
| path | string | 远程服务器上的目录路径 |

配置示例：
```json
{
    "logs": {
        "directories": [
            { "name": "应用日志", "path": "/var/log/myapp" },
            { "name": "测试日志", "path": "/var/log/autotest" },
            { "name": "系统日志", "path": "/var/log/system" }
        ],
        "downloadPath": "./downloads",
        "refreshInterval": 5000
    }
}
```

## 3. 类型定义

### 3.1 日志目录配置

```typescript
interface LogDirectoryConfig {
    name: string;           // 目录显示名称，如 "应用日志"
    path: string;           // 远程目录路径，如 "/var/log/myapp"
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

### 3.3 日志配置接口

```typescript
interface LogsConfig {
    directories: LogDirectoryConfig[];  // 监控目录列表
    downloadPath: string;               // 下载路径
    refreshInterval: number;            // 刷新间隔(毫秒)
}
```

## 4. 功能实现

### 4.1 类结构

```typescript
export class LogMonitor {
    private logFilesCache: Map<string, LogFile[]> = new Map();

    constructor();
    
    // 目录管理
    getDirectories(): LogDirectoryConfig[];
    
    // 内容获取
    async fetchDirectoryContents(dirPath: string): Promise<LogFile[]>;
    async fetchAllDirectories(): Promise<Map<string, LogFile[]>>;
    
    // 下载功能
    async downloadLog(logFile: LogFile): Promise<string>;
    async downloadLogWithProgress(logFile: LogFile): Promise<string>;
    
    // 缓存管理
    getCachedFiles(dirPath: string): LogFile[] | undefined;
}
```

### 4.2 核心方法

#### getDirectories(): LogDirectoryConfig[]

获取配置的监控目录列表。

**返回值**：
- `LogDirectoryConfig[]`: 目录配置数组

**实现逻辑**：
```typescript
getDirectories(): LogDirectoryConfig[] {
    const config = getConfig();
    return config.logs.directories || [];
}
```

#### fetchDirectoryContents(dirPath: string): Promise<LogFile[]>

获取指定目录的内容列表。

**参数**：
- `dirPath`: 远程目录路径

**返回值**：
- `Promise<LogFile[]>`: 文件和子目录数组

**实现逻辑**：
```typescript
async fetchDirectoryContents(dirPath: string): Promise<LogFile[]> {
    try {
        const items = await listDirectory(dirPath);
        
        // 排序：目录优先，然后按名称排序
        return items.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    } catch (error: any) {
        console.error(`[LogMonitor] 获取目录 ${dirPath} 内容失败:`, error.message);
        return [];
    }
}
```

#### fetchAllDirectories(): Promise<Map<string, LogFile[]>>

获取所有配置目录的内容。

**返回值**：
- `Promise<Map<string, LogFile[]>>`: 目录路径到文件列表的映射

**实现逻辑**：
```typescript
async fetchAllDirectories(): Promise<Map<string, LogFile[]>> {
    const directories = this.getDirectories();
    const results = new Map<string, LogFile[]>();

    for (const dir of directories) {
        const files = await this.fetchDirectoryContents(dir.path);
        results.set(dir.path, files);
        this.logFilesCache.set(dir.path, files);
    }

    return results;
}
```

### 4.3 下载方法

#### downloadLog(logFile: LogFile): Promise<string>

下载指定日志文件到本地。

**参数**：
- `logFile`: 要下载的日志文件对象

**返回值**：
- `Promise<string>`: 本地文件路径

**实现逻辑**：
```typescript
async downloadLog(logFile: LogFile): Promise<string> {
    if (logFile.isDirectory) {
        throw new Error('不能下载目录');
    }

    const config = getConfig();
    const downloadPath = config.logs.downloadPath;
    
    // 确保下载目录存在
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
    }

    // 通过 SCP 下载文件
    const localPath = await downloadFile(logFile.path, path.join(downloadPath, logFile.name));
    return localPath;
}
```

#### downloadLogWithProgress(logFile: LogFile): Promise<string>

带进度提示的下载功能。

**参数**：
- `logFile`: 要下载的日志文件对象

**返回值**：
- `Promise<string>`: 本地文件路径

**实现逻辑**：
```typescript
async downloadLogWithProgress(logFile: LogFile): Promise<string> {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '下载日志',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: `正在下载 ${logFile.name}...` });
        const localPath = await this.downloadLog(logFile);
        vscode.window.showInformationMessage(`日志已下载到: ${localPath}`);
        return localPath;
    });
}
```

### 4.4 辅助函数

#### formatSize(bytes: number): string

格式化文件大小。

```typescript
function formatSize(bytes: number): string {
    if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
}
```

**示例输出**：
- `512` → `"512 B"`
- `2048` → `"2.0 KB"`
- `5242880` → `"5.0 MB"`
- `1073741824` → `"1.0 GB"`

#### formatDate(date: Date): string

格式化日期。

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
            const directories = this.logMonitor.getDirectories();
            return directories.map(dir => new LogTreeItem(dir, true, true));
        }

        if (element.contextValue === 'logDirectory' && element.directoryConfig) {
            // 配置目录：获取其内容
            const contents = await this.logMonitor.fetchDirectoryContents(element.directoryConfig.path);
            return this.createLogItems(contents);
        }

        if (element.contextValue === 'logSubDirectory' && element.logFile) {
            // 子目录：获取其内容
            const contents = await this.logMonitor.fetchDirectoryContents(element.logFile.path);
            return this.createLogItems(contents);
        }

        return [];
    }

    private createLogItems(files: LogFile[]): LogTreeItem[] {
        return files.map(file => new LogTreeItem(file, file.isDirectory, false));
    }
}
```

### 5.2 TreeItem 实现

```typescript
class LogTreeItem extends vscode.TreeItem {
    public logFile: LogFile | null;
    public directoryConfig: LogDirectoryConfig | null;

    constructor(
        item: LogFile | LogDirectoryConfig,
        isDirectory: boolean,
        isConfigDir: boolean = false
    ) {
        if (isConfigDir) {
            // 配置的顶级目录
            const dir = item as LogDirectoryConfig;
            super(dir.name, vscode.TreeItemCollapsibleState.Collapsed);
            this.directoryConfig = dir;
            this.logFile = null;
            this.contextValue = 'logDirectory';
            this.iconPath = new vscode.ThemeIcon('folder');
            this.tooltip = `路径: ${dir.path}`;
        } else if (isDirectory) {
            // 子目录
            const file = item as LogFile;
            super(file.name, vscode.TreeItemCollapsibleState.Collapsed);
            this.logFile = file;
            this.directoryConfig = null;
            this.contextValue = 'logSubDirectory';
            this.iconPath = new vscode.ThemeIcon('folder');
            this.tooltip = `路径: ${file.path}`;
        } else {
            // 文件
            const file = item as LogFile;
            super(file.name, vscode.TreeItemCollapsibleState.None);
            this.logFile = file;
            this.directoryConfig = null;
            this.description = `${formatSize(file.size)} | ${formatDate(file.modifiedTime)}`;
            this.tooltip = `路径: ${file.path}\n大小: ${formatSize(file.size)}\n修改时间: ${formatDate(file.modifiedTime)}`;
            this.contextValue = 'logFile';
            this.iconPath = new vscode.ThemeIcon('file-text');
            this.command = {
                command: 'autotest.downloadLog',
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
├── 应用日志 (配置目录)
│   ├── subdir1 (子目录)
│   │   ├── log1.log (文件)
│   │   └── log2.log (文件)
│   ├── app.log (文件) - 显示: "2.0 KB | 2024/1/15 10:30:00"
│   └── error.log (文件) - 显示: "512 B | 2024/1/15 09:00:00"
├── 测试日志 (配置目录)
│   └── test.log (文件)
└── 系统日志 (配置目录)
    └── system.log (文件)
```

## 6. 命令注册

### 6.1 刷新日志列表

```typescript
vscode.commands.registerCommand('autotest.refreshLogs', () => {
    logTreeDataProvider.refresh();
});
```

### 6.2 下载日志

```typescript
vscode.commands.registerCommand('autotest.downloadLog', async (item: LogTreeItem) => {
    if (item && item.logFile && !item.logFile.isDirectory) {
        await logMonitor.downloadLogWithProgress(item.logFile);
    }
});
```

### 6.3 打开日志

```typescript
vscode.commands.registerCommand('autotest.openLog', async (item: LogTreeItem) => {
    if (item && item.logFile && !item.logFile.isDirectory) {
        const localPath = await logMonitor.downloadLog(item.logFile);
        const document = await vscode.workspace.openTextDocument(localPath);
        await vscode.window.showTextDocument(document);
    }
});
```

## 7. SCP 客户端集成

日志监控模块依赖 SCP 客户端进行远程文件操作。

### 7.1 listDirectory 函数

获取远程目录内容。

```typescript
async function listDirectory(remotePath: string): Promise<LogFile[]> {
    const sftp = await connect();
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

### 7.2 downloadFile 函数

下载远程文件。

```typescript
async function downloadFile(remotePath: string, localPath?: string): Promise<string> {
    const config = getConfig();
    const sftp = await connect();

    const fileName = path.basename(remotePath);
    const local = localPath || path.join(config.logs.downloadPath, fileName);

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
| SCP 连接失败 | 返回空数组，记录错误日志 |
| 目录不存在 | 返回空数组 |
| 下载目录创建失败 | 抛出异常 |
| 文件下载失败 | 显示错误提示 |
| 尝试下载目录 | 抛出异常，显示提示 |

## 9. 性能考虑

- 使用缓存减少重复请求
- 按需加载目录内容（懒加载）
- 文件列表排序在客户端完成
- 支持手动刷新，避免自动轮询开销

## 10. 测试覆盖

日志监控模块测试覆盖以下场景：

- 文件大小格式化测试
- 日期格式化测试
- 日志文件对象创建测试
- 日志目录对象测试
- 文件排序测试（目录优先）
- 路径处理测试
- SCP 客户端集成测试
- 下载功能测试

详见测试文件：`test/suite/logMonitor.test.ts`

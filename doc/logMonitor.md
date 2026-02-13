# 日志监控模块 (LogMonitor Module)

## 1. 模块概述

日志监控模块负责监控服务器或本地的日志文件，提供日志文件列表获取、定时刷新、下载等功能。模块支持从远程服务器 API 获取日志列表，也支持直接读取本地日志目录。

## 2. 设计方案

### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    LogMonitor Module                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              fetchLogFiles()                         │    │
│  │  ┌──────────────┐        ┌──────────────┐           │    │
│  │  │ 远程 API 请求 │  或 →  │ 本地目录读取  │           │    │
│  │  └──────────────┘        └──────────────┘           │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              startMonitoring()                       │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │    │
│  │  │ 首次获取  │→│ 定时刷新  │→│ 回调通知更新      │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              downloadLog()                           │    │
│  │  ┌──────────────┐        ┌──────────────┐           │    │
│  │  │ 远程 API 下载 │  或 →  │ 本地文件复制  │           │    │
│  │  └──────────────┘        └──────────────┘           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 工作流程

```
插件激活
    │
    ▼
startMonitoring()
    │
    ├── 首次获取日志列表
    │
    ├── 启动定时器
    │
    ▼
定时刷新 (默认 5 秒)
    │
    ├── fetchLogFiles()
    │   │
    │   ├── 尝试远程 API
    │   │   │
    │   │   └── 成功 → 返回列表
    │   │
    │   └── 失败 → 读取本地目录
    │
    ├── 回调通知 UI 更新
    │
    ▼
用户点击下载
    │
    ▼
downloadLog()
    │
    ├── 创建下载目录
    │
    ├── 尝试远程下载
    │   │
    │   └── 失败 → 本地复制
    │
    ▼
返回本地文件路径
```

### 2.3 双模式设计

模块支持两种工作模式：

| 模式 | 数据来源 | 适用场景 |
|------|----------|----------|
| 远程模式 | 服务器 API | 生产环境、远程服务器 |
| 本地模式 | 本地文件系统 | 开发环境、本地测试 |

当远程 API 不可用时，自动降级到本地模式。

## 3. 类型定义

### 3.1 日志文件接口

```typescript
interface LogFile {
    name: string;           // 文件名，如 "app.log"
    path: string;           // 文件路径，如 "/var/logs/app.log"
    size: number;           // 文件大小（字节）
    modifiedTime: Date;     // 最后修改时间
}
```

### 3.2 日志配置接口

```typescript
interface LogsConfig {
    monitorDirectory: string;     // 监控目录
    downloadPath: string;         // 下载路径
    refreshInterval: number;      // 刷新间隔(毫秒)
}
```

## 4. 功能实现

### 4.1 类结构

```typescript
export class LogMonitor {
    private logFiles: LogFile[] = [];
    private refreshInterval: number = 5000;
    private monitorTimer: ReturnType<typeof setInterval> | null = null;
    private onLogFilesChange: ((files: LogFile[]) => void) | null = null;

    constructor();
    
    // 核心方法
    async fetchLogFiles(): Promise<LogFile[]>;
    startMonitoring(onChange: (files: LogFile[]) => void): void;
    stopMonitoring(): void;
    
    // 下载方法
    async downloadLog(logFile: LogFile): Promise<string>;
    async downloadSelectedLog(): Promise<string | null>;
    
    // 工具方法
    getLogFiles(): LogFile[];
}
```

### 4.2 核心方法

#### fetchLogFiles(): Promise<LogFile[]>

获取日志文件列表。

**返回值**：
- `Promise<LogFile[]>`: 日志文件数组

**实现逻辑**：
```typescript
async fetchLogFiles(): Promise<LogFile[]> {
    const config = getConfig();

    try {
        // 1. 尝试从远程 API 获取
        const response = await axios.get(`${config.server.executeCommand}/logs`, {
            timeout: 10000
        });
        
        if (response.data && Array.isArray(response.data)) {
            this.logFiles = response.data.map((item: any) => ({
                name: item.name,
                path: item.path,
                size: item.size || 0,
                modifiedTime: new Date(item.modifiedTime || Date.now())
            }));
        }
    } catch {
        // 2. 远程失败，读取本地目录
        const logDir = config.logs.monitorDirectory;
        if (fs.existsSync(logDir)) {
            const files = fs.readdirSync(logDir);
            this.logFiles = files
                .filter(file => file.endsWith('.log'))  // 只处理 .log 文件
                .map(file => {
                    const filePath = path.join(logDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        path: filePath,
                        size: stats.size,
                        modifiedTime: stats.mtime
                    };
                });
        }
    }

    return this.logFiles;
}
```

#### startMonitoring(onChange: (files: LogFile[]) => void): void

启动定时监控。

**参数**：
- `onChange`: 日志列表变化时的回调函数

**实现逻辑**：
```typescript
startMonitoring(onChange: (files: LogFile[]) => void): void {
    this.onLogFilesChange = onChange;
    
    // 1. 立即获取一次
    this.fetchLogFiles().then(files => {
        onChange(files);
    });

    // 2. 启动定时器
    this.monitorTimer = setInterval(async () => {
        const files = await this.fetchLogFiles();
        if (this.onLogFilesChange) {
            this.onLogFilesChange(files);
        }
    }, this.refreshInterval);
}
```

#### stopMonitoring(): void

停止监控。

```typescript
stopMonitoring(): void {
    if (this.monitorTimer) {
        clearInterval(this.monitorTimer);
        this.monitorTimer = null;
    }
}
```

### 4.3 下载方法

#### downloadLog(logFile: LogFile): Promise<string>

下载指定日志文件。

**参数**：
- `logFile`: 要下载的日志文件对象

**返回值**：
- `Promise<string>`: 本地文件路径

**实现逻辑**：
```typescript
async downloadLog(logFile: LogFile): Promise<string> {
    const config = getConfig();
    const downloadPath = config.logs.downloadPath;
    
    // 1. 确保下载目录存在
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
    }

    const localPath = path.join(downloadPath, logFile.name);

    try {
        // 2. 尝试从远程下载
        const response = await axios.get(`${config.server.executeCommand}/logs/download`, {
            params: { path: logFile.path },
            responseType: 'arraybuffer',
            timeout: 30000
        });

        fs.writeFileSync(localPath, response.data);
        return localPath;
    } catch {
        // 3. 远程失败，尝试本地复制
        if (fs.existsSync(logFile.path)) {
            fs.copyFileSync(logFile.path, localPath);
            return localPath;
        }
        throw new Error('无法下载日志文件');
    }
}
```

#### downloadSelectedLog(): Promise<string | null>

显示选择器让用户选择要下载的日志。

**返回值**：
- `Promise<string | null>`: 下载成功返回路径，取消返回 null

**实现逻辑**：
```typescript
async downloadSelectedLog(): Promise<string | null> {
    const files = await this.fetchLogFiles();
    
    if (files.length === 0) {
        vscode.window.showInformationMessage('没有可下载的日志文件');
        return null;
    }

    // 1. 显示快速选择器
    const selected = await vscode.window.showQuickPick(
        files.map(f => ({
            label: f.name,
            description: `${formatSize(f.size)} | ${formatDate(f.modifiedTime)}`
        })),
        { placeHolder: '选择要下载的日志文件' }
    );

    if (!selected) {
        return null;
    }

    // 2. 查找选中的文件
    const logFile = files.find(f => f.name === selected.label);
    if (!logFile) {
        return null;
    }

    // 3. 下载文件
    const localPath = await this.downloadLog(logFile);
    vscode.window.showInformationMessage(`日志已下载到: ${localPath}`);
    
    return localPath;
}
```

### 4.4 辅助函数

#### formatSize(bytes: number): string

格式化文件大小。

```typescript
function formatSize(bytes: number): string {
    if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
```

**示例输出**：
- `512` → `"512 B"`
- `2048` → `"2.0 KB"`
- `5242880` → `"5.0 MB"`

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

## 5. 使用示例

### 5.1 基本使用

```typescript
import { LogMonitor } from './core/logMonitor';

const monitor = new LogMonitor();

// 获取日志列表
const files = await monitor.fetchLogFiles();
console.log('Log files:', files);

// 下载日志
if (files.length > 0) {
    const localPath = await monitor.downloadLog(files[0]);
    console.log('Downloaded to:', localPath);
}
```

### 5.2 启动监控

```typescript
const monitor = new LogMonitor();

// 启动定时监控
monitor.startMonitoring((files) => {
    console.log('Log files updated:', files.length);
    // 更新 UI 显示
    updateTreeView(files);
});

// 停止监控
monitor.stopMonitoring();
```

### 5.3 用户选择下载

```typescript
const monitor = new LogMonitor();

// 显示选择器让用户选择
const localPath = await monitor.downloadSelectedLog();
if (localPath) {
    console.log('Downloaded to:', localPath);
}
```

## 6. TreeView 集成

日志监控模块与 VSCode TreeView 集成，显示在资源管理器面板中。

### 6.1 TreeView 数据提供者

```typescript
class LogTreeDataProvider implements vscode.TreeDataProvider<LogFileItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<LogFileItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(files: LogFile[]): void {
        this.files = files;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: LogFileItem): vscode.TreeItem {
        return element;
    }

    getChildren(): LogFileItem[] {
        return this.files.map(file => new LogFileItem(file));
    }
}
```

### 6.2 TreeItem 实现

```typescript
class LogFileItem extends vscode.TreeItem {
    constructor(file: LogFile) {
        super(file.name, vscode.TreeItemCollapsibleState.None);
        
        this.description = `${formatSize(file.size)} | ${formatDate(file.modifiedTime)}`;
        this.tooltip = file.path;
        this.command = {
            command: 'autotest.downloadLog',
            title: 'Download Log',
            arguments: [file]
        };
    }
}
```

## 7. API 接口规范

### 7.1 获取日志列表

**请求**：
```
GET {executeCommand}/logs
```

**响应**：
```json
[
    {
        "name": "app.log",
        "path": "/var/logs/app.log",
        "size": 1024,
        "modifiedTime": "2024-01-15T10:30:00Z"
    },
    {
        "name": "error.log",
        "path": "/var/logs/error.log",
        "size": 512,
        "modifiedTime": "2024-01-15T09:00:00Z"
    }
]
```

### 7.2 下载日志文件

**请求**：
```
GET {executeCommand}/logs/download?path=/var/logs/app.log
```

**响应**：
- Content-Type: `application/octet-stream`
- Body: 文件二进制内容

## 8. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 远程 API 不可用 | 降级到本地目录读取 |
| 本地目录不存在 | 返回空数组 |
| 下载目录创建失败 | 抛出异常 |
| 文件复制失败 | 抛出异常并提示用户 |
| 网络超时 | 10 秒超时后降级 |

## 9. 性能考虑

- 定时刷新默认 5 秒间隔，可配置
- API 请求设置 10 秒超时
- 文件下载设置 30 秒超时
- 只读取 `.log` 扩展名的文件

## 10. 测试覆盖

日志监控模块测试覆盖以下场景：

- 文件大小格式化测试
- 日期格式化测试
- 日志文件对象创建测试
- 文件排序测试
- 文件过滤测试
- 错误处理测试
- 刷新机制测试

详见测试文件：`test/suite/logMonitor.test.ts`

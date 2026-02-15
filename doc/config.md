# 配置模块 (Config Module)

## 1. 模块概述

配置模块负责管理 AutoTest 插件的所有配置信息，包括服务器连接、命令执行、AI 服务和日志监控等配置项。模块支持自动创建默认配置文件，并提供配置加载、获取和重载功能。

## 2. 设计方案

### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Config Module                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  defaultConfig  │  │  loadConfig()   │                  │
│  │  (默认配置)      │  │  (加载配置)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  getConfig()    │  │ reloadConfig()  │                  │
│  │  (获取配置)      │  │  (重载配置)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│                      Configuration File                      │
│              .vscode/autotest-config.json                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 配置文件查找策略

模块按以下顺序查找配置文件：

1. `{workspace}/.vscode/autotest-config.json` (优先)
2. `{workspace}/autotest-config.json` (备选)

### 2.3 自动创建机制

当配置文件不存在时，模块会：
1. 创建 `.vscode` 目录（如不存在）
2. 生成包含默认值的配置文件
3. 显示提示信息告知用户

## 3. 类型定义

### 3.0 路径配置重要说明

> **⚠️ 重要：所有路径配置必须使用绝对路径**

| 配置项 | 路径类型 | 示例 |
|--------|----------|------|
| `server.privateKeyPath` | 本地绝对路径 | `C:\Users\user\.ssh\id_rsa` 或 `/home/user/.ssh/id_rsa` |
| `server.localProjectPath` | 本地绝对路径 | `D:\Projects\Test` 或 `/home/user/projects/test` |
| `server.remoteDirectory` | 远程绝对路径 | `/tmp/autotest` 或 `/home/user/test` |
| `logs.directories[].path` | 远程绝对路径 | `/var/log/app` 或 `/home/user/logs` |
| `logs.downloadPath` | 本地相对/绝对路径 | `./downloads` 或 `D:\logs` |

**注意事项**：
- 本地路径格式根据操作系统而定：
  - Windows: `D:\path\to\file` 或 `C:\Users\user\...`
  - Linux/macOS: `/home/user/path/to/file`
- 远程路径格式取决于远程服务器操作系统（通常为 Linux，使用 `/` 开头的绝对路径）
- `logs.downloadPath` 支持相对路径，相对于工作区目录

### 3.1 完整配置结构

```typescript
interface AutoTestConfig {
    server: ServerConfig;      // 服务器连接配置
    command: CommandConfig;    // 命令执行配置
    ai: AIConfig;              // AI 服务配置
    logs: LogsConfig;          // 日志监控配置
}
```

### 3.2 服务器配置

```typescript
interface ServerConfig {
    host: string;              // 服务器主机地址，如 "192.168.1.100"
    port: number;              // SSH 端口，默认 22
    username: string;          // 登录用户名
    password: string;          // 登录密码（密码认证）
    privateKeyPath: string;    // 私钥路径（密钥认证，优先于密码）
    localProjectPath: string;  // 本地工程路径（用于计算相对路径）
    remoteDirectory: string;   // 远程工作目录（上传文件的目标目录）
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| host | string | 是 | "192.168.1.100" | 目标服务器 IP 地址 |
| port | number | 是 | 22 | SSH 连接端口 |
| username | string | 是 | "root" | SSH 登录用户名 |
| password | string | 否 | "" | SSH 登录密码（密码认证） |
| privateKeyPath | string | 否 | "" | SSH 私钥路径（密钥认证，优先于密码） |
| localProjectPath | string | 否 | "" | 本地工程根路径，**留空则自动使用 VSCode 打开的工作区路径** |
| remoteDirectory | string | 是 | "/tmp/autotest" | 远程工作目录，上传文件的目标目录 |

**认证方式**：

| 认证方式 | 配置 | 优先级 |
|----------|------|--------|
| 密钥认证 | privateKeyPath | 高（优先使用） |
| 密码认证 | password | 低（密钥不存在时使用） |

**路径映射说明**：

上传文件时，插件会自动计算本地文件的相对路径，并映射到远程目录的对应位置：

```
本地文件: {localProjectPath}/xx/a/test.js
远程路径: {remoteDirectory}/xx/a/test.js
```

**重要说明**：
- `localProjectPath` **无需配置**，默认自动使用 VSCode 打开的工作区路径
- 只有在需要指定不同的工程根目录时才需要手动配置此项

例如：
- VSCode 打开的工作区: `D:\Projects\Test`（自动使用）
- 远程工程路径: `/home/user/test`
- 本地文件: `D:\Projects\Test\src\utils\helper.js`
- 上传后远程路径: `/home/user/test/src/utils/helper.js`

### 3.3 命令配置

```typescript
interface CommandConfig {
    executeCommand: string;              // 要执行的命令（支持变量）
    filterPatterns: string[];            // 过滤正则表达式数组
    filterMode: 'include' | 'exclude';   // 过滤模式
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| executeCommand | string | 是 | "echo 'No command configured'" | 默认执行的命令，支持变量替换 |
| filterPatterns | string[] | 否 | [] | 正则表达式数组，用于过滤输出 |
| filterMode | enum | 是 | "include" | include: 只保留匹配行；exclude: 排除匹配行 |

**命令变量**：

executeCommand 支持以下变量，在执行时自动替换为对应的值：

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `{filePath}` | 远程文件完整路径 | `/tmp/autotest/tests/test_example.py` |
| `{fileName}` | 远程文件名 | `test_example.py` |
| `{fileDir}` | 远程文件所在目录 | `/tmp/autotest/tests` |
| `{localPath}` | 本地文件完整路径 | `D:\project\tests\test_example.py` |
| `{localDir}` | 本地文件所在目录 | `D:\project\tests` |
| `{localFileName}` | 本地文件名 | `test_example.py` |
| `{remoteDir}` | 远程工程目录 | `/tmp/autotest` |

**命令配置示例（带变量）**：
```json
{
    "command": {
        "executeCommand": "pytest {filePath} -v",
        "filterPatterns": ["PASSED", "FAILED", "ERROR"],
        "filterMode": "include"
    }
}
```

**常用测试框架配置示例**：

Python pytest:
```json
{
    "executeCommand": "cd {remoteDir} && pytest {filePath} -v",
    "filterPatterns": ["PASSED", "FAILED", "ERROR"],
    "filterMode": "include"
}
```

JavaScript Jest:
```json
{
    "executeCommand": "cd {remoteDir} && npx jest {filePath} --coverage=false",
    "filterPatterns": ["PASS", "FAIL", "✓", "✕"],
    "filterMode": "include"
}
```

Java Maven:
```json
{
    "executeCommand": "cd {remoteDir} && mvn test -Dtest={fileName}",
    "filterPatterns": ["Tests run:", "FAILURE", "ERROR"],
    "filterMode": "include"
}
```

**过滤模式示例**：

```json
{
    "filterPatterns": ["\\[error\\]", "\\[warn\\]"],
    "filterMode": "include"
}
```

上述配置只显示包含 `[error]` 或 `[warn]` 的输出行。

### 3.4 AI 配置

```typescript
interface AIConfig {
    provider: 'qwen' | 'openai';  // AI 提供商
    qwen: QWenConfig;             // 通义千问配置
    openai: OpenAIConfig;         // OpenAI 配置
}

interface QWenConfig {
    apiKey: string;               // API 密钥
    apiUrl: string;               // API 地址
    model: string;                // 模型名称
}

interface OpenAIConfig {
    apiKey: string;               // API 密钥
    apiUrl: string;               // API 地址
    model: string;                // 模型名称
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| provider | enum | 是 | "qwen" | 当前使用的 AI 提供商 |
| qwen.apiKey | string | 是* | "" | 通义千问 API 密钥 |
| qwen.apiUrl | string | 否 | 阿里云默认地址 | API 接口地址 |
| qwen.model | string | 否 | "qwen-turbo" | 模型名称 |
| openai.apiKey | string | 是* | "" | OpenAI API 密钥 |
| openai.apiUrl | string | 否 | OpenAI 默认地址 | API 接口地址 |
| openai.model | string | 否 | "gpt-3.5-turbo" | 模型名称 |

*根据 provider 选择对应的 apiKey

**支持的模型**：

| 提供商 | 模型列表 |
|--------|----------|
| QWen | qwen-turbo, qwen-plus, qwen-max, qwen-max-longcontext |
| OpenAI | gpt-3.5-turbo, gpt-3.5-turbo-16k, gpt-4, gpt-4-32k, gpt-4-turbo |

### 3.5 日志配置

```typescript
interface LogDirectoryConfig {
    name: string;                 // 目录显示名称
    path: string;                 // 远程目录路径
}

interface LogsConfig {
    directories: LogDirectoryConfig[];  // 监控目录列表
    downloadPath: string;               // 下载路径
    refreshInterval: number;            // 刷新间隔(毫秒)
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| directories | LogDirectoryConfig[] | 是 | [] | 要监控的日志目录列表 |
| directories[].name | string | 是 | - | 目录在界面显示的名称 |
| directories[].path | string | 是 | - | 远程服务器上的目录路径 |
| downloadPath | string | 是 | "./downloads" | 日志下载保存路径 |
| refreshInterval | number | 是 | 5000 | 自动刷新间隔，单位毫秒。设为 0 或负数禁用自动刷新 |

**日志监控功能**：

- 支持配置多个日志目录
- 树形视图展示目录和文件
- 显示文件大小和修改时间
- 支持展开子目录
- 点击文件可下载到本地
- 自动刷新：`refreshInterval > 0` 时启用，设为 0 禁用自动刷新，仅支持手动刷新
- 执行用例完成后自动刷新日志列表

## 4. 功能实现

### 4.1 核心函数

#### loadConfig(workspacePath: string): AutoTestConfig

加载配置文件，如不存在则创建默认配置。

**参数**：
- `workspacePath`: 工作区路径

**返回值**：
- `AutoTestConfig`: 配置对象

**实现逻辑**：
```
1. 获取配置文件路径设置（默认 autotest-config.json）
2. 按优先级查找配置文件
3. 如果文件存在：
   - 读取文件内容
   - 解析 JSON
   - 与默认配置合并
4. 如果文件不存在：
   - 创建 .vscode 目录
   - 写入默认配置
   - 显示提示信息
5. 返回配置对象
```

#### getConfig(): AutoTestConfig

获取当前已加载的配置。

**返回值**：
- `AutoTestConfig`: 当前配置对象

**注意**：如未调用 loadConfig，返回默认配置。

#### reloadConfig(workspacePath?: string): AutoTestConfig

重新加载配置文件。

**参数**：
- `workspacePath`: 工作区路径（可选，默认使用当前工作区）

**返回值**：
- `AutoTestConfig`: 重新加载后的配置对象

**特性**：
- 如果配置发生变化，会触发 `onConfigChanged` 事件通知所有监听者

#### setupConfigWatcher(context: vscode.ExtensionContext): void

设置配置文件监听器，自动监听配置文件变化。

**参数**：
- `context`: VSCode 扩展上下文

**监听事件**：
- `onDidChange`: 配置文件被修改时自动刷新
- `onDidCreate`: 配置文件被创建时自动加载
- `onDidDelete`: 配置文件被删除时使用默认配置

#### onConfigChanged 事件

配置变化事件，用于监听配置更新。

```typescript
import { onConfigChanged } from './config';

// 监听配置变化
onConfigChanged((newConfig) => {
    console.log('配置已更新:', newConfig);
    // 执行配置更新后的操作
});
```

#### getConfigFilePath(): string

获取当前配置文件的完整路径。

**返回值**：
- `string`: 配置文件路径

### 4.2 默认配置

```typescript
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
        downloadPath: "./downloads",
        refreshInterval: 5000
    }
};
```

## 5. 使用示例

### 5.1 加载配置

```typescript
import { loadConfig, getConfig } from './config';

// 在扩展激活时加载配置
export function activate(context: vscode.ExtensionContext) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspacePath) {
        loadConfig(workspacePath);
    }
    
    // 获取配置
    const config = getConfig();
    console.log('Server host:', config.server.host);
}
```

### 5.2 重载配置

```typescript
import { reloadConfig } from './config';

// 用户修改配置后重载
function onConfigChanged() {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspacePath) {
        const newConfig = reloadConfig(workspacePath);
        console.log('Config reloaded');
    }
}
```

### 5.3 配置文件示例

```json
{
    "server": {
        "host": "10.0.0.1",
        "port": 22,
        "username": "admin",
        "password": "your-password",
        "privateKeyPath": "",
        "localProjectPath": "",
        "remoteDirectory": "/home/admin/autotest"
    },
    "command": {
        "executeCommand": "pytest tests/",
        "filterPatterns": ["FAILED", "ERROR", "\\[error\\]"],
        "filterMode": "include"
    },
    "ai": {
        "provider": "openai",
        "qwen": {
            "apiKey": "",
            "apiUrl": "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            "model": "qwen-max"
        },
        "openai": {
            "apiKey": "sk-your-api-key",
            "apiUrl": "https://api.openai.com/v1/chat/completions",
            "model": "gpt-4"
        }
    },
    "logs": {
        "directories": [
            { "name": "应用日志", "path": "/var/log/myapp" },
            { "name": "测试日志", "path": "/var/log/autotest" },
            { "name": "系统日志", "path": "/var/log/system" }
        ],
        "downloadPath": "./logs",
        "refreshInterval": 3000
    }
}
```

## 6. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 配置文件不存在 | 自动创建默认配置文件 |
| JSON 解析失败 | 使用默认配置，记录错误日志 |
| 文件读取权限不足 | 使用默认配置，显示错误提示 |
| 配置项缺失 | 使用默认值填充缺失项 |

## 7. 测试覆盖

配置模块测试覆盖以下场景：

- 默认配置验证
- 配置值验证
- 配置结构验证
- 配置值修改测试
- AI 模型配置测试
- 日志目录列表配置测试
- ServerConfig 不包含 logDirectory/downloadPath 测试

详见测试文件：`test/suite/types.test.ts`

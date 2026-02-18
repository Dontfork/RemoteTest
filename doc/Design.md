# AutoTest 插件设计文档

## 1. 概述

AutoTest 是一款 VSCode 插件，旨在简化测试工作流程，提供文件上传、命令执行、日志监控和 AI 对话功能。插件采用模块化设计，支持多工程多环境配置，通过 SSH/SCP 协议与远程服务器交互，实现安全的文件传输和命令执行。

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      VSCode Extension Host                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Activity  │  │  Explorer   │  │    Command Palette   │  │
│  │    Bar      │  │    View     │  │                      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────────▼──────────┐  │
│  │ AI Chat     │  │ Log Monitor │  │ Upload & Execute    │  │
│  │ (Webview)   │  │ (TreeView)  │  │ (Commands)          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
├─────────┴────────────────┴─────────────────────┴─────────────┤
│                      Core Modules                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   AIChat    │  │ LogMonitor  │  │  Uploader   │          │
│  │SessionMgr   │  │             │  │             │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │CommandExec  │  │   Config    │  │ SSH/SCP     │          │
│  │  (SSH)      │  │ (Multi-     │  │  Client     │          │
│  │             │  │  Project)   │  │             │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Utils                                 │ │
│  │  ┌───────────┐  ┌───────────────┐                      │ │
│  │  │  Logger   │  │  Markdown     │                      │ │
│  │  └───────────┘  └───────────────┘                      │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 3. 模块概览

| 模块 | 文件 | 职责 |
|------|------|------|
| 配置模块 | `src/config/index.ts` | 管理多工程配置，支持路径匹配和冲突检测 |
| 命令执行模块 | `src/core/commandExecutor.ts` | 通过 SSH 执行远程命令并过滤输出 |
| 日志监控模块 | `src/core/logMonitor.ts` | 通过 SCP 监控和下载远程日志文件 |
| 文件上传模块 | `src/core/uploader.ts` | 文件上传和用例运行功能，支持多工程匹配 |
| AI 对话模块 | `src/ai/chat.ts` | 提供与 AI 模型的对话能力 |
| AI 提供商模块 | `src/ai/providers.ts` | AI 服务提供商实现（QWen、OpenAI） |
| 会话管理模块 | `src/ai/sessionManager.ts` | AI 对话会话的持久化管理 |
| 输出过滤模块 | `src/utils/outputFilter.ts` | 命令输出过滤和颜色渲染 |
| 输出通道管理模块 | `src/utils/outputChannel.ts` | 统一管理 VSCode 输出通道 |

## 4. 输出通道约束

### 4.1 设计原则

插件**严格限制**只能有两个输出通道，禁止创建其他通道：

| 通道名称 | 用途 | 内容示例 |
|----------|------|----------|
| `AutoTest` | 插件自身信息输出 | 配置验证结果、Git 检测日志、错误信息、调试信息 |
| `TestOutput` | 命令执行输出 | 远程服务器返回的命令执行结果、测试用例输出 |

### 4.2 约束规则

1. **禁止直接创建输出通道**：所有模块必须通过 `OutputChannelManager` 获取输出通道
2. **单例模式**：`OutputChannelManager` 使用单例模式，确保通道只创建一次
3. **用途分离**：
   - `AutoTest` 通道：插件内部状态、配置信息、错误日志
   - `TestOutput` 通道：用户命令执行结果、测试输出

### 4.3 使用方式

```typescript
import { getOutputChannelManager, OutputChannelType } from '../utils/outputChannel';

const channelManager = getOutputChannelManager();

const autoTestChannel = channelManager.getAutoTestChannel();
const testOutputChannel = channelManager.getTestOutputChannel();

autoTestChannel.appendLine('[LogMonitor] 配置加载完成');
testOutputChannel.appendLine('测试执行结果: PASSED');
```

### 4.4 违规示例（禁止）

```typescript
const channel = vscode.window.createOutputChannel('AutoTest Git检测');
const channel = vscode.window.createOutputChannel('AutoTest 配置验证');
const channel = vscode.window.createOutputChannel('TestOutput');
```

## 5. 配置结构

### 5.1 多工程配置架构

插件支持多工程多环境配置，每个工程拥有独立的服务器配置和命令配置：

```typescript
interface AutoTestConfig {
    projects: ProjectConfig[];  // 多工程配置数组
    ai: AIConfig;               // AI 服务配置（全局）
    refreshInterval?: number;   // 日志刷新间隔（全局，毫秒）
}

interface ProjectConfig {
    name: string;               // 工程名称
    localPath?: string;         // 本地工程路径（可选，用于路径匹配）
    enabled?: boolean;          // 是否启用（默认 true）
    server: ServerConfig;       // 服务器连接配置
    commands?: CommandConfig[]; // 命令配置数组（可选，未配置时快捷命令和运行用例不可用）
    logs?: ProjectLogsConfig;   // 日志配置（可选）
}
```

### 5.2 配置文件位置

`{workspace}/.vscode/autotest-config.json` 或 `{workspace}/autotest-config.json`

### 5.3 配置示例

```json
{
    "projects": [
        {
            "name": "项目A",
            "localPath": "D:\\projectA",
            "enabled": true,
            "server": {
                "host": "192.168.1.100",
                "port": 22,
                "username": "root",
                "password": "",
                "privateKeyPath": "",
                "remoteDirectory": "/tmp/projectA"
            },
            "commands": [
                {
                    "name": "运行测试",
                    "executeCommand": "pytest {filePath} -v",
                    "includePatterns": ["ERROR", "FAILED", "PASSED"],
                    "excludePatterns": [],
                    "colorRules": [
                        { "pattern": "ERROR|FAILED|FAIL", "color": "red" },
                        { "pattern": "PASSED|SUCCESS", "color": "green" }
                    ],
                    "runnable": true,
                    "clearOutputBeforeRun": true
                },
                {
                    "name": "运行覆盖率",
                    "executeCommand": "pytest {filePath} --cov",
                    "includePatterns": ["ERROR", "FAILED", "%"],
                    "excludePatterns": []
                }
            ],
            "logs": {
                "directories": [
                    { "name": "应用日志", "path": "/var/log/projectA" }
                ],
                "downloadPath": "D:\\downloads\\projectA"
            }
        },
        {
            "name": "项目B",
            "localPath": "D:\\projectB",
            "enabled": true,
            "server": {
                "host": "192.168.1.200",
                "port": 22,
                "username": "test",
                "password": "",
                "privateKeyPath": "C:\\Users\\test\\.ssh\\id_rsa",
                "remoteDirectory": "/home/test/projectB"
            },
            "commands": [
                {
                    "name": "执行用例",
                    "executeCommand": "python {filePath}",
                    "includePatterns": ["error", "failed", "OK"],
                    "excludePatterns": ["traceback", "File"]
                }
            ],
            "logs": {
                "directories": [
                    { "name": "测试日志", "path": "/var/log/projectB" }
                ],
                "downloadPath": "D:\\downloads\\projectB"
            }
        }
    ],
    "ai": {
        "models": [
            {
                "name": "qwen-turbo",
                "apiKey": "your-qwen-api-key"
            },
            {
                "name": "gpt-4",
                "apiKey": "your-openai-api-key",
                "apiUrl": "https://api.openai.com/v1/chat/completions"
            }
        ],
        "defaultModel": "qwen-turbo",
        "proxy": "127.0.0.1:7890"
    },
    "refreshInterval": 5000,
    "textFileExtensions": [".py", ".js", ".ts", ".json"],
    "useLogOutputChannel": true
}
```

### 5.4 仅快捷命令工程配置示例

当工程仅需执行快捷命令时，可以省略 `localPath` 和 `remoteDirectory` 配置：

```json
{
    "projects": [
        {
            "name": "服务器管理",
            "server": {
                "host": "192.168.1.100",
                "port": 22,
                "username": "root",
                "password": "password",
                "privateKeyPath": ""
            },
            "commands": [
                {
                    "name": "查看状态",
                    "executeCommand": "systemctl status nginx"
                },
                {
                    "name": "重启服务",
                    "executeCommand": "systemctl restart nginx"
                },
                {
                    "name": "查看日志",
                    "executeCommand": "tail -100 /var/log/nginx/error.log"
                }
            ]
        }
    ],
    "ai": {
        "models": [
            { "name": "qwen-turbo", "apiKey": "your-qwen-api-key" }
        ],
        "defaultModel": "qwen-turbo"
    }
}
```

**说明**：
- 此类工程仅支持执行无变量的快捷命令
- Git 变更监控、文件上传、日志下载等功能不可用
- 命令中不能使用 `{filePath}`、`{remoteDir}` 等变量

### 5.5 路径匹配机制

当用户执行上传或运行用例操作时，插件会根据本地文件路径自动匹配对应的工程配置：

1. **路径匹配规则**：
   - 遍历所有启用的工程配置
   - 检查本地文件路径是否以工程的 `localPath` 开头
   - 选择最长匹配的工程（处理嵌套路径情况）

2. **路径冲突检测**：
   - 加载配置时检测工程路径是否存在包含关系
   - 如存在冲突，自动禁用范围较小的工程并警告用户
   - 示例：`D:\project` 和 `D:\project\sub` 存在冲突，后者会被禁用

3. **匹配示例**：
   ```
   文件路径: D:\projectA\tests\test_example.py
   工程配置:
     - 项目A: D:\projectA (匹配 ✓)
     - 项目B: D:\projectB (不匹配)
   
   结果: 自动使用"项目A"的服务器和命令配置
   ```

### 5.6 命令选择机制

当工程配置了多个命令时：

1. **单个命令**：直接执行该命令
2. **多个命令**：弹出选择框让用户选择要执行的命令

### 5.7 关键配置说明

#### 工程配置 (ProjectConfig)

| 字段 | 说明 |
|------|------|
| name | 工程名称，用于界面显示和日志标识 |
| localPath | 本地工程路径，**可选**，用于路径匹配 |
| enabled | 是否启用该工程配置，默认 true |
| server | 该工程对应的服务器配置 |
| commands | 该工程支持的命令列表，**可选**，未配置时快捷命令和运行用例不可用 |
| logs | 该工程的日志配置，**可选**，不依赖 localPath |

**localPath 配置说明**:
- 当 `localPath` 未配置或为空时：
  - Git 变更监控不可用
  - 文件上传不可用
  - 运行用例不可用
  - 快捷命令中使用的变量会受到限制
- 快捷命令变量限制：
  - 无变量命令：正常执行
  - 包含 `{filePath}`、`{fileName}`、`{fileDir}`、`{localPath}`、`{localDir}`、`{localFileName}` 变量的命令：不可用
  - 包含 `{remoteDir}` 变量的命令：需要 `remoteDirectory` 配置

**commands 配置说明**:
- 当 `commands` 未配置或为空时：
  - 快捷命令不可用
  - 运行用例不可用
- 工程可仅配置 `logs` 用于日志监控，无需配置 `commands`

**logs 配置说明**:
- 日志监控功能不依赖 `localPath` 或 `commands`
- 只要配置了 `logs.directories` 和服务器信息即可使用

#### 服务器配置 (ServerConfig)

| 字段 | 说明 |
|------|------|
| host | 服务器 IP 地址 |
| port | SSH 端口，默认 22 |
| username | SSH 用户名 |
| password | SSH 密码（密码认证） |
| privateKeyPath | SSH 私钥路径（密钥认证，优先于密码） |
| remoteDirectory | 远程工作目录，**可选**，上传文件的目标目录 |

**remoteDirectory 配置说明**:
- 当 `remoteDirectory` 未配置或为空时，文件上传功能不可用
- 快捷命令中包含 `{remoteDir}` 变量的命令不可用

#### 命令配置 (CommandConfig)

| 字段 | 说明 |
|------|------|
| name | 命令名称，用于选择框显示 |
| executeCommand | 要执行的命令，支持变量替换 |
| includePatterns | 包含模式数组，只显示匹配这些模式的行（为空时显示所有行） |
| excludePatterns | 排除模式数组，排除匹配这些模式的行 |
| colorRules | 颜色规则数组，定义匹配模式和对应颜色 |
| runnable | 命令可见性控制，仅影响"运行用例"功能，true 表示运行用例可用 |
| clearOutputBeforeRun | 执行命令前是否清空 TestOutput 通道，默认 false |

**runnable 配置说明**:
- `runnable: true`：命令在运行用例时显示
- `runnable: false` 或未配置：命令不在运行用例时显示

| runnable 值 | 运行用例 |
|---------------|----------|
| 未配置 | ✗ 不显示 |
| `false` | ✗ 不显示 |
| `true` | ✓ 显示 |

**clearOutputBeforeRun 配置说明**:
- `true`：执行命令前自动清空 TestOutput 通道的历史输出
- `false` 或未配置：保留历史输出，新输出追加在末尾

**快捷命令过滤规则**:
- 快捷命令仅显示不包含变量的命令（无 `{xxx}` 格式的变量）
- `runnable` 不影响快捷命令的显示

**颜色规则 (OutputColorRule)**:

| 字段 | 说明 |
|------|------|
| pattern | 正则表达式模式 |
| color | 颜色名称：red, green, yellow, blue, cyan, magenta, white, gray |

**支持的命令变量**:

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `{filePath}` | 远程文件完整路径 | `/tmp/autotest/tests/test_example.py` |
| `{fileName}` | 远程文件名 | `test_example.py` |
| `{fileDir}` | 远程文件所在目录 | `/tmp/autotest/tests` |
| `{localPath}` | 本地文件完整路径 | `D:\project\tests\test_example.py` |
| `{localDir}` | 本地文件所在目录 | `D:\project\tests` |
| `{localFileName}` | 本地文件名 | `test_example.py` |
| `{remoteDir}` | 远程工程目录 | `/tmp/autotest` |

#### 日志配置 (ProjectLogsConfig)

日志配置现在位于每个项目内部，支持项目独立的日志目录和下载路径。

| 字段 | 说明 |
|------|------|
| directories | 监控目录列表，支持多个目录 |
| directories[].name | 目录在界面显示的名称 |
| directories[].path | 远程服务器上的目录路径 |
| downloadPath | 日志下载保存路径，**必须使用绝对路径** |

#### 全局配置

| 字段 | 说明 |
|------|------|
| refreshInterval | 日志自动刷新间隔（毫秒），设为 0 禁用自动刷新（默认关闭）。此配置为全局配置，与项目独立 |
| textFileExtensions | 文本文件扩展名数组，上传时会自动将 CRLF 转换为 LF。默认包含常见文本文件扩展名 |
| useLogOutputChannel | 输出通道类型，默认 true。true 使用 LogOutputChannel（带时间戳），false 使用普通 OutputChannel（无时间戳） |

**useLogOutputChannel 配置说明**:
- `true`（默认）：使用 LogOutputChannel，输出带时间戳前缀，支持日志级别（info/warn/error）
- `false`：使用普通 OutputChannel，输出无时间戳前缀

**textFileExtensions 配置说明**:
- 上传文件时，匹配这些扩展名的文件会自动将 CRLF 行尾转换为 LF
- 默认包含：`.txt`, `.py`, `.js`, `.ts`, `.json`, `.xml`, `.yaml`, `.yml`, `.md`, `.html`, `.css`, `.sh`, `.bat`, `.conf`, `.ini`, `.log`, `.java`, `.c`, `.cpp`, `.h`, `.hpp`, `.go`, `.rs`, `.rb`, `.php`, `.sql`, `.vue`, `.jsx`, `.tsx`, `.scss`, `.less`, `.sass`

### 5.8 日志刷新机制

日志刷新采用简化机制：

1. **全局刷新**：通过 `refreshInterval` 配置控制，与项目独立
   - 设置为正数时，按指定间隔自动刷新所有项目的日志
   - 设置为 0 时，禁用自动刷新

2. **命令触发刷新**：执行项目命令后自动刷新该项目的日志

### 5.9 向后兼容

插件支持旧版配置格式自动转换：

```json
{
    "server": { ... },
    "command": { ... },
    "ai": { ... },
    "logs": { ... }
}
```

旧版配置会被自动转换为：
```json
{
    "projects": [{
        "name": "默认工程",
        "localPath": "<工作区路径>",
        "enabled": true,
        "server": { ... },
        "commands": [{ ... }],
        "logs": { ... }
    }],
    "ai": { ... },
    "refreshInterval": 5000
}
```

## 6. UI 设计

### 6.1 活动栏 - AI 对话

**位置**: VSCode 左侧活动栏

**组件**:
- 会话管理工具栏（新建对话、历史记录）
- 消息列表区域（支持 Markdown 渲染）
- 输入框
- 发送按钮

**功能特点**:
- 流式输出 AI 响应
- Markdown 语法渲染
- 会话历史管理
- 会话持久化存储

### 6.2 资源管理器 - 日志监控

**位置**: 资源管理器面板下方

**组件**:
- 配置目录列表（可折叠，显示关联项目名称）
- 子目录树形结构
- 文件列表（显示大小和修改时间）
- 工具栏按钮（刷新、刷新配置、打开配置）

**功能**:
- 支持多目录监控
- 目录可展开浏览
- 点击文件下载日志
- 自动/手动刷新

## 7. 命令列表

| 命令 ID | 描述 | 触发方式 |
|---------|------|----------|
| `autotest.runTestCase` | 运行用例（上传并执行） | 右键菜单（文件/目录） |
| `autotest.uploadFile` | 上传文件（仅上传，不执行） | 右键菜单（文件/目录） |
| `autotest.syncFile` | 同步文件（从远程下载到本地） | 右键菜单（文件/目录） |
| `autotest.refreshQuickCommands` | 刷新快捷命令列表 | 工具栏按钮 |
| `autotest.executeQuickCommand` | 执行快捷命令 | 命令节点按钮 |
| `autotest.refreshChanges` | 刷新变更列表 | 工具栏按钮 |
| `autotest.uploadProjectChanges` | 上传项目的所有变更文件 | 项目节点按钮 |
| `autotest.uploadSelectedChange` | 上传选中的变更文件 | 右键菜单 |
| `autotest.openChangeFile` | 打开变更文件 | 右键菜单 |
| `autotest.refreshLogs` | 刷新日志列表 | 工具栏按钮 |
| `autotest.downloadLog` | 下载日志文件 | 点击日志项 |
| `autotest.openLog` | 打开日志文件 | 右键菜单 |
| `autotest.reloadConfig` | 手动刷新配置 | 工具栏按钮 / 命令面板 |
| `autotest.openConfig` | 打开配置文件 | 工具栏按钮 / 命令面板 |

### 7.1 右键菜单配置

| 菜单项 | 文件 | 目录 | 说明 |
|--------|------|------|------|
| 运行用例 | ✓ | ✓ | 上传文件/目录并执行配置的测试命令 |
| 上传文件 | ✓ | ✓ | 仅上传文件/目录，不执行命令 |
| 同步文件 | ✓ | ✓ | 从远程服务器下载文件/目录到本地 |

**目录操作行为**：
- 遍历目录下所有文件（排除 `.` 开头的隐藏目录和 `node_modules`）
- "运行用例"会对每个文件执行上传和命令执行
- "上传文件"会上传目录下所有文件到远程服务器对应位置
- "同步文件"会递归下载整个目录到本地

**多工程支持**：
- 自动根据文件路径匹配对应的工程配置
- 使用匹配工程的服务器信息进行上传和执行
- 如果工程配置了多个命令，弹出选择框让用户选择

### 7.2 修改监控视图

| 按钮 | 功能 |
|------|------|
| ↻ 刷新 | 重新检测 Git 变更 |
| ☁️ 上传 | 一键上传所有变更文件 |

**变更类型说明**：
| 类型 | 图标 | 说明 | 可操作 |
|------|------|------|--------|
| 新增 (added) | ➕ 绿色 | 新创建的文件 | 上传、打开 |
| 修改 (modified) | ✏️ 黄色 | 内容有修改的文件 | 上传、打开 |
| 删除 (deleted) | 🗑️ 红色 | 已删除的文件 | 无（需通过项目级上传同步删除远程） |
| 重命名 (renamed) | ➡️ 蓝色 | 同目录内改名的文件 | 上传、打开 |
| 移动 (moved) | ⇄️ 蓝色 | 跨目录移动的文件 | 上传、打开 |

**重命名与移动的区分**：
- **重命名**：文件在同一目录内改名，例如 `src/old.ts` → `src/new.ts`
- **移动**：文件移动到不同目录，例如 `src/utils/helper.ts` → `src/core/helper.ts`
- 判断依据：比较旧路径和新路径的目录部分是否相同

**变更文件右键菜单**：
| 菜单项 | 说明 |
|--------|------|
| 上传此文件 | 上传选中的变更文件（删除类型除外） |
| 打开文件 | 在编辑器中打开该文件（删除类型除外） |

## 8. 数据流

### 8.1 AI 对话流程

```
用户输入消息
    │
    ▼
Webview.postMessage()
    │
    ▼
AIChatViewProvider 接收
    │
    ▼
AIChat.sendMessageStream()
    │
    ├── 添加用户消息到会话
    │
    ├── 调用 Provider.sendStream()
    │       │
    │       ├── QWen/OpenAI API 流式请求
    │       │
    │       └── 通过 onChunk 回调返回数据块
    │
    ├── Webview 接收 streamChunk 消息
    │       │
    │       └── 实时更新 UI（Markdown 渲染）
    │
    └── 保存 AI 响应到会话
            │
            ▼
        SessionManager 持久化存储
```

### 8.2 文件上传流程（多工程）

```
用户右键点击文件/目录
    │
    ├── 选择"运行用例"
    │       │
    │       ▼
    │   Uploader.runTestCase()
    │       │
    │       ├── 根据本地路径匹配工程配置
    │       │       │
    │       │       ├── 匹配成功 → 使用对应工程配置
    │       │       └── 匹配失败 → 显示错误提示
    │       │
    │       ├── 选择命令（多命令时弹出选择框）
    │       │
    │       ├── 计算远程路径（使用工程的 remoteDirectory）
    │       │
    │       ├── SCP 上传文件（使用工程的 server 配置）
    │       │
    │       ├── 构建命令变量
    │       │
    │       ├── SSH 执行命令
    │       │
    │       └── 过滤输出显示
    │
    ├── 选择"上传文件"
    │       │
    │       ▼
    │   Uploader.uploadFile()
    │       │
    │       ├── 根据本地路径匹配工程配置
    │       │
    │       ├── 计算远程路径
    │       │
    │       └── SCP 上传文件
    │
    └── 选择"同步文件"
            │
            ▼
        Uploader.syncFile()
            │
            ├── 根据本地路径匹配工程配置
            │
            ├── 计算远程路径
            │
            └── SCP 下载文件/目录
```

### 8.3 修改监控流程

```
用户点击刷新/展开修改监控
    │
    ▼
GitChangeDetector.getGitChanges()
    │
    ├── 获取所有启用的项目列表
    │
    └── 遍历每个项目
            │
            ├── 检查项目localPath是否为Git仓库
            │       │
            │       ├── 否 → 跳过该项目
            │       └── 是 → 继续
            │
            ├── 在项目目录执行 git status --porcelain
            │
            ├── 解析状态行
            │       │
            │       ├── 判断变更类型（added/modified/deleted/renamed）
            │       │
            │       └── 计算相对路径
            │
            └── 返回变更列表（按项目分组）
                    │
                    ▼
            TreeView 显示变更列表
                    │
                    ├── 项目节点：显示项目名称和变更数量
                    │       │
                    │       └── 右侧显示上传按钮（☁️）
                    │
                    └── 文件节点：显示相对路径（扁平化，无目录层级）
                            │
                            └── 用户点击项目节点的上传按钮
                                    │
                                    ▼
                                检查该项目是否有删除的文件
                                    │
                                    ├── 有删除文件
                                    │       │
                                    │       ▼
                                    │   弹出确认对话框（仅显示当前项目的删除文件）
                                    │       │
                                    │       ├── 用户选择"同步删除"
                                    │       │       │
                                    │       │       ▼
                                    │       │   上传该项目的所有变更文件
                                    │       │   删除远程对应文件
                                    │       │
                                    │       ├── 用户选择"仅上传修改"
                                    │       │       │
                                    │       │       ▼
                                    │       │   仅上传该项目的变更文件
                                    │       │
                                    │       └── 用户取消
                                    │               │
                                    │               ▼
                                    │           结束操作
                                    │
                                    └── 无删除文件
                                            │
                                            ▼
                                        上传该项目的所有变更文件
```

### 8.4 日志监控流程（多工程）

```
读取全局日志目录配置
    │
    ▼
遍历日志目录列表
    │
    ├── 目录配置了projectName
    │       │
    │       ▼
    │   查找匹配的项目配置
    │       │
    │       ├── 找到项目
    │       │       │
    │       │       ▼
    │       │   使用项目服务器配置获取日志
    │       │   使用项目下载路径保存日志
    │       │   目录显示项目名称标识
    │       │
    │       └── 未找到项目
    │               │
    │               ▼
    │           使用默认服务器配置
    │
    └── 目录未配置projectName
            │
            ▼
        使用默认服务器配置
        使用全局下载路径
            │
            ▼
    TreeView 显示日志目录列表
            │
            └── 用户点击目录
                    │
                    ▼
                SCP 获取远程目录内容
                    │
                    ▼
                显示文件列表（含大小、修改时间）
                    │
                    └── 用户点击文件
                            │
                            ▼
                        SCP 下载文件到本地
```

## 9. 扩展性设计

### 9.1 AI 模型配置

AI 配置采用模型列表方式，支持多模型配置，无需指定 provider：

```typescript
interface AIConfig {
    models: AIModelConfig[];    // 模型列表
    defaultModel?: string;      // 默认模型名称
    proxy?: string;             // 全局代理（host:port）
}

interface AIModelConfig {
    name: string;               // 模型名称（用于识别 API 格式）
    apiKey?: string;            // API 密钥（可选，自部署模型可能不需要）
    apiUrl?: string;            // 自定义 API 地址（可选）
}
```

**模型自动识别**：
- 系统根据模型名称自动选择对应的 API 格式：
  - QWen 模型：名称包含 `qwen`（如 qwen-turbo、qwen-plus、qwen-max）
  - OpenAI 模型：名称包含 `gpt`（如 gpt-3.5-turbo、gpt-4、gpt-4o）
  - 其他模型：使用自定义 `apiUrl`，采用 OpenAI 兼容格式

**代理配置**：
- 支持全局代理
- 代理格式：`host:port`（如 `proxy.company.com:8080`）
- 适用于需要通过代理访问外网的内网环境

**自部署模型**：
- 对于自部署的模型（如 Ollama、LocalAI），可以不配置 `apiKey`
- 只需配置 `apiUrl` 指向本地服务地址

**添加新模型**：
1. 在配置文件的 `ai.models` 数组中添加模型配置
2. 如果是 QWen 或 OpenAI 兼容模型，系统会自动识别
3. 如果是自定义模型，需要配置 `apiUrl` 参数
4. 如需代理，配置全局 `proxy` 参数

### 9.2 Markdown 渲染

使用 `marked` 库提供 Markdown 渲染功能：
- 支持标题、加粗、斜体
- 支持代码块和行内代码
- 支持链接、列表、引用
- 支持分割线
- 自动转义 HTML 特殊字符

## 11. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 配置加载失败 | 使用默认配置 |
| 路径匹配失败 | 显示错误消息，提示用户检查配置 |
| 路径冲突 | 自动禁用冲突工程并警告用户 |
| SSH 连接失败 | 显示错误消息 |
| SCP 传输失败 | 显示错误消息并记录日志 |
| AI API 调用失败 | 流式请求失败时回退到非流式请求 |
| 会话存储失败 | 记录错误日志 |

## 12. 性能考虑

- 日志监控支持禁用自动刷新（refreshInterval = 0）
- SSH 连接复用，减少连接开销
- **SSH 连接池**：单例模式管理连接，相同服务器复用连接，空闲自动清理（60秒超时）
- **目录分组加载**：按服务器分组，减少连接次数（N 个目录 / M 个服务器 = M 次连接）
- API 请求设置 60 秒超时
- webpack 打包优化，减少插件体积
- AI 响应流式输出，提升用户体验
- 路径匹配采用最长匹配策略，避免不必要的遍历

## 13. 目录结构

```
d:\code\AutoTest
├── .vscode/                # VSCode 配置
│   ├── launch.json         # 调试配置
│   └── tasks.json          # 任务配置
├── dist/                   # webpack 打包输出
│   └── extension.js
├── doc/                    # 文档
│   ├── Design.md           # 本文档（总览）
│   ├── USER_GUIDE.md       # 用户指南
│   ├── config.md           # 配置模块详细文档
│   ├── commandExecutor.md  # 命令执行模块详细文档
│   ├── logMonitor.md       # 日志监控模块详细文档
│   ├── ai.md               # AI对话模块详细文档
│   └── ai-mode-design.md   # AI多模式架构设计
├── resources/              # 资源文件
│   └── icon.svg            # 插件图标
├── src/                    # 源代码
│   ├── extension.ts        # 扩展入口
│   ├── config/             # 配置模块
│   │   └── index.ts
│   ├── core/               # 核心功能模块
│   │   ├── commandExecutor.ts
│   │   ├── uploader.ts
│   │   ├── logMonitor.ts
│   │   ├── sshClient.ts
│   │   ├── scpClient.ts
│   │   ├── gitChangeDetector.ts
│   │   ├── connectionPool.ts
│   │   └── index.ts
│   ├── ai/                 # AI 模块
│   │   ├── chat.ts
│   │   ├── providers.ts
│   │   ├── sessionManager.ts
│   │   └── index.ts
│   ├── types/              # 类型定义
│   │   └── index.ts
│   ├── utils/              # 工具模块
│   │   ├── colorRules.ts
│   │   └── outputFilter.ts
│   └── views/              # UI 视图
│       ├── aiChatView.ts
│       ├── logTreeView.ts
│       ├── changesTreeView.ts
│       └── index.ts
├── test/                   # 测试用例
│   ├── suite/
│   │   ├── types.test.ts
│   │   ├── config.test.ts
│   │   ├── commandExecutor.test.ts
│   │   ├── logMonitor.test.ts
│   │   ├── sshClient.test.ts
│   │   ├── scpClient.test.ts
│   │   ├── ai.test.ts
│   │   ├── aiStreaming.test.ts
│   │   ├── sessionManager.test.ts
│   │   ├── markdown.test.ts
│   │   └── gitChangeDetector.test.ts
│   ├── package.json
│   ├── runTest.ts
│   └── tsconfig.json
├── .gitignore
├── .vscodeignore           # 打包排除配置
├── DEVELOPMENT.md          # 开发流程文档
├── LICENSE
├── README.md               # 项目说明
├── autotest-config.json    # 默认配置文件
├── package.json            # 扩展配置
├── tsconfig.json           # TypeScript 配置
└── webpack.config.js       # webpack 配置
```

## 14. 快速开始

### 14.1 安装依赖

```bash
npm install
```

### 14.2 编译

```bash
npm run webpack-dev
```

### 14.3 运行测试

```bash
npm run test:unit
```

### 14.4 调试

1. 在 VSCode 中打开项目
2. 按 F5 启动调试
3. 在新窗口中测试插件功能

### 14.5 打包

```bash
npm run package
vsce package
```

## 15. 相关文档

- [用户指南](./USER_GUIDE.md)
- [配置模块详细文档](./config.md)
- [命令执行模块详细文档](./commandExecutor.md)
- [日志监控模块详细文档](./logMonitor.md)
- [AI 对话模块详细文档](./ai.md)
- [AI 多模式架构设计](./ai-mode-design.md)

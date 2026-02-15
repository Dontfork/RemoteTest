# AutoTest 插件设计文档

## 1. 概述

AutoTest 是一款 VSCode 插件，旨在简化测试工作流程，提供文件上传、命令执行、日志监控和 AI 对话功能。插件采用模块化设计，支持灵活配置和扩展。通过 SSH/SCP 协议与远程服务器交互，实现安全的文件传输和命令执行。

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
│  │  (SSH)      │  │             │  │  Client     │          │
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
| 配置模块 | `src/config/index.ts` | 管理插件配置，支持自动创建默认配置文件 |
| 命令执行模块 | `src/core/commandExecutor.ts` | 通过 SSH 执行远程命令并过滤输出 |
| 日志监控模块 | `src/core/logMonitor.ts` | 通过 SCP 监控和下载远程日志文件 |
| 文件上传模块 | `src/core/uploader.ts` | 文件上传和用例运行功能 |
| AI 对话模块 | `src/ai/chat.ts` | 提供与 AI 模型的对话能力 |
| AI 提供商模块 | `src/ai/providers.ts` | AI 服务提供商实现（QWen、OpenAI） |
| 会话管理模块 | `src/ai/sessionManager.ts` | AI 对话会话的持久化管理 |
| 日志工具模块 | `src/utils/logger.ts` | 统一日志输出到 VSCode OutputChannel |
| Markdown 模块 | `src/utils/markdown.ts` | Markdown 文本渲染 |

## 4. 配置结构

### 4.1 完整配置接口

```typescript
interface AutoTestConfig {
    server: ServerConfig;      // 服务器连接配置 (SSH/SCP)
    command: CommandConfig;    // 命令执行配置
    ai: AIConfig;              // AI 服务配置
    logs: LogsConfig;          // 日志监控配置
}
```

### 4.2 配置文件位置

`{workspace}/.vscode/autotest-config.json` 或 `{workspace}/autotest-config.json`

### 4.3 配置示例

```json
{
    "server": {
        "host": "192.168.1.100",
        "port": 22,
        "username": "root",
        "password": "",
        "privateKeyPath": "",
        "localProjectPath": "",
        "remoteDirectory": "/tmp/autotest"
    },
    "command": {
        "executeCommand": "pytest {filePath} -v",
        "filterPatterns": ["ERROR", "FAILED", "Exception"],
        "filterMode": "include"
    },
    "ai": {
        "provider": "qwen",
        "qwen": {
            "apiKey": "your-qwen-api-key",
            "apiUrl": "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            "model": "qwen-turbo"
        },
        "openai": {
            "apiKey": "your-openai-api-key",
            "apiUrl": "https://api.openai.com/v1/chat/completions",
            "model": "gpt-3.5-turbo"
        }
    },
    "logs": {
        "directories": [
            { "name": "应用日志", "path": "/var/log/myapp" },
            { "name": "测试日志", "path": "/var/log/autotest" }
        ],
        "downloadPath": "D:\\downloads",
        "refreshInterval": 5000
    }
}
```

### 4.4 关键配置说明

#### 服务器配置 (SSH/SCP)

| 字段 | 说明 |
|------|------|
| host | 服务器 IP 地址 |
| port | SSH 端口，默认 22 |
| username | SSH 用户名 |
| password | SSH 密码（密码认证） |
| privateKeyPath | SSH 私钥路径（密钥认证，优先于密码） |
| localProjectPath | 本地工程路径，**无需配置，默认自动使用 VSCode 打开的工作区路径** |
| remoteDirectory | 远程工作目录，上传文件的目标目录 |

#### 日志配置

| 字段 | 说明 |
|------|------|
| directories | 监控目录列表，支持多个目录 |
| directories[].name | 目录在界面显示的名称 |
| directories[].path | 远程服务器上的目录路径 |
| downloadPath | 日志下载保存路径 |
| refreshInterval | 自动刷新间隔（毫秒），设为 0 禁用自动刷新 |

#### 命令配置

| 字段 | 说明 |
|------|------|
| executeCommand | 要执行的命令，支持变量替换 |
| filterPatterns | 过滤正则表达式数组 |
| filterMode | 过滤模式：include（保留匹配行）/ exclude（排除匹配行） |

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

## 5. UI 设计

### 5.1 活动栏 - AI 对话

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

### 5.2 资源管理器 - 日志监控

**位置**: 资源管理器面板下方

**组件**:
- 配置目录列表（可折叠）
- 子目录树形结构
- 文件列表（显示大小和修改时间）
- 工具栏按钮（刷新、刷新配置、打开配置）

**功能**:
- 支持多目录监控
- 目录可展开浏览
- 点击文件下载日志
- 自动/手动刷新

## 6. 命令列表

| 命令 ID | 描述 | 触发方式 |
|---------|------|----------|
| `autotest.runTestCase` | 运行用例（上传并执行） | 右键菜单（文件/目录） |
| `autotest.uploadFile` | 上传文件（仅上传，不执行） | 右键菜单（文件/目录） |
| `autotest.refreshLogs` | 刷新日志列表 | 工具栏按钮 |
| `autotest.downloadLog` | 下载日志文件 | 点击日志项 |
| `autotest.openLog` | 打开日志文件 | 右键菜单 |
| `autotest.reloadConfig` | 手动刷新配置 | 工具栏按钮 / 命令面板 |
| `autotest.openConfig` | 打开配置文件 | 工具栏按钮 / 命令面板 |

### 6.1 右键菜单配置

| 菜单项 | 文件 | 目录 | 说明 |
|--------|------|------|------|
| 运行用例 | ✓ | ✓ | 上传文件/目录并执行配置的测试命令 |
| 上传文件 | ✓ | ✓ | 仅上传文件/目录，不执行命令 |

**目录操作行为**：
- 遍历目录下所有文件（排除 `.` 开头的隐藏目录和 `node_modules`）
- "运行用例"会对每个文件执行上传和命令执行
- "上传文件"会上传目录下所有文件到远程服务器对应位置

## 7. 数据流

### 7.1 AI 对话流程

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

### 7.2 文件上传流程

```
用户右键点击文件/目录
    │
    ├── 选择"运行用例"
    │       │
    │       ▼
    │   Uploader.runTestCase()
    │       │
    │       ├── 计算远程路径
    │       ├── SCP 上传文件
    │       ├── 构建命令变量
    │       ├── SSH 执行命令
    │       └── 过滤输出显示
    │
    └── 选择"上传文件"
            │
            ▼
        Uploader.uploadFile()
            │
            ├── 计算远程路径
            └── SCP 上传文件
```

### 7.3 日志监控流程

```
读取配置中的日志目录列表
    │
    ▼
TreeView 显示目录列表
    │
    ├── 用户点击目录
    │       │
    │       ▼
    │   SCP 获取远程目录内容
    │       │
    │       ▼
    │   显示文件列表（含大小、修改时间）
    │
    └── 用户点击文件
            │
            ▼
        SCP 下载文件到本地
```

## 8. 输出通道

插件使用两个独立的输出通道：

| 通道名称 | 用途 |
|----------|------|
| AutoTest | 插件自身日志、调试信息 |
| TestOutput | 用例执行时的命令输出 |

## 9. 扩展性设计

### 9.1 AI 提供商扩展

新增 AI 提供商需要:
1. 在 `types/index.ts` 中添加配置接口
2. 在 `ai/providers.ts` 中实现新的 Provider 类
3. 在 `AIConfig` 中添加配置项
4. 在 `sendMessage()` 中添加路由逻辑

### 9.2 Markdown 渲染

`src/utils/markdown.ts` 提供独立的 Markdown 渲染功能：
- 支持标题、加粗、斜体
- 支持代码块和行内代码
- 支持链接、列表、引用
- 支持分割线
- 自动转义 HTML 特殊字符

## 10. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 配置加载失败 | 使用默认配置 |
| SSH 连接失败 | 显示错误消息 |
| SCP 传输失败 | 显示错误消息并记录日志 |
| AI API 调用失败 | 流式请求失败时回退到非流式请求 |
| 会话存储失败 | 记录错误日志 |

## 11. 性能考虑

- 日志监控支持禁用自动刷新（refreshInterval = 0）
- SSH 连接复用，减少连接开销
- API 请求设置 60 秒超时
- webpack 打包优化，减少插件体积
- AI 响应流式输出，提升用户体验

## 12. 目录结构

```
d:\code\AutoTest
├── .vscode/                # VSCode 配置
│   ├── launch.json         # 调试配置
│   └── tasks.json          # 任务配置
├── dist/                   # webpack 打包输出
│   └── extension.js
├── doc/                    # 文档
│   ├── Design.md           # 本文档（总览）
│   ├── FUNCTIONS.md        # 功能使用文档
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
│   │   └── index.ts
│   ├── ai/                 # AI 模块
│   │   ├── chat.ts
│   │   ├── providers.ts
│   │   ├── sessionManager.ts
│   │   └── index.ts
│   ├── types/              # 类型定义
│   │   └── index.ts
│   ├── utils/              # 工具模块
│   │   ├── logger.ts
│   │   └── markdown.ts
│   └── views/              # UI 视图
│       ├── aiChatView.ts
│       ├── logTreeView.ts
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
│   │   └── markdown.test.ts
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

## 13. 快速开始

### 13.1 安装依赖

```bash
npm install
```

### 13.2 编译

```bash
npm run webpack-dev
```

### 13.3 运行测试

```bash
npm run test:unit
```

### 13.4 调试

1. 在 VSCode 中打开项目
2. 按 F5 启动调试
3. 在新窗口中测试插件功能

### 13.5 打包

```bash
npm run package
vsce package
```

## 14. 相关文档

- [功能使用文档](./FUNCTIONS.md)
- [配置模块详细文档](./config.md)
- [命令执行模块详细文档](./commandExecutor.md)
- [日志监控模块详细文档](./logMonitor.md)
- [AI 对话模块详细文档](./ai.md)
- [AI 多模式架构设计](./ai-mode-design.md)

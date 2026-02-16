# AutoTest

一款 VSCode 插件，旨在简化测试工作流程，提供文件上传、命令执行、日志监控和 AI 对话功能。支持多工程多环境配置，自动路径匹配，灵活的命令执行和日志管理。

## 功能特性

- **多工程多环境**: 支持配置多个项目，每个项目独立的服务器、命令和日志配置
- **灵活配置**: `localPath` 和 `remoteDirectory` 为可选配置，支持仅执行快捷命令的轻量级工程
- **自动路径匹配**: 根据本地文件路径自动匹配对应的项目环境
- **文件上传**: 支持单文件和目录上传，右键菜单操作
- **文件同步**: 从远程服务器下载文件/目录到本地
- **快捷命令**: 快速执行预定义命令，无需选择文件，支持命令过滤和变量替换
- **修改监控**: 基于 Git 检测项目变更，一键上传所有修改文件，支持重命名和移动检测
- **运行用例**: 上传文件并自动执行配置的测试命令，支持多命令选择
- **日志监控**: 实时监控服务器日志，支持多目录、项目关联、下载到本地
- **命令输出过滤**: 支持正则表达式过滤输出，内置颜色渲染
- **SSH 连接池**: 单例模式管理连接，相同服务器复用连接，减少连接开销
- **AI 对话**: 
  - 支持多种 AI 提供商（QWen、OpenAI）
  - 流式输出 AI 响应
  - Markdown 语法渲染
  - 会话历史管理和持久化存储

## 快速开始

### 安装依赖

```bash
npm install
```

### 编译

```bash
npm run webpack-dev
```

### 运行测试

```bash
npm test
```

### 调试

1. 在 VSCode 中打开项目
2. 按 F5 启动调试
3. 在新窗口中测试插件功能

### 打包

```bash
npm run package
vsce package
```

生成的 `.vsix` 文件可直接安装到 VSCode。

## 配置

在项目根目录创建 `.vscode/autotest-config.json` 文件：

> **⚠️ 路径配置说明**：所有路径必须使用绝对路径
> - `localPath`: 本地工程绝对路径，如 `D:\projectA`（可选）
> - `privateKeyPath`: 本地私钥绝对路径，如 `C:\Users\user\.ssh\id_rsa`
> - `remoteDirectory`: 远程服务器绝对路径，如 `/tmp/autotest`（可选）
> - `logs.directories[].path`: 远程服务器绝对路径，如 `/var/log/myapp`
> - `logs.downloadPath`: 本地绝对路径，如 `D:\downloads`

### 完整工程配置示例

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
          "includePatterns": ["ERROR", "FAILED", "PASSED"]
        },
        {
          "name": "运行覆盖率",
          "executeCommand": "pytest {filePath} --cov",
          "includePatterns": ["error", "failed", "%"]
        }
      ],
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
          { "name": "应用日志", "path": "/var/log/projectB" }
        ],
        "downloadPath": "D:\\downloads\\projectB"
      }
    }
  ],
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
  "refreshInterval": 0
}
```

### 仅快捷命令工程配置示例

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
    "provider": "qwen",
    "qwen": { "apiKey": "", "apiUrl": "", "model": "qwen-turbo" },
    "openai": { "apiKey": "", "apiUrl": "", "model": "gpt-3.5-turbo" }
  }
}
```

**说明**：
- 此类工程仅支持执行无变量的快捷命令
- Git 变更监控、文件上传、日志下载等功能不可用
- 命令中不能使用 `{filePath}`、`{remoteDir}` 等变量

## 配置说明

### 工程配置 (ProjectConfig)

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✓ | 项目名称 |
| `localPath` | ✗ | 本地工程路径，未配置时 Git 监控、文件上传、运行用例不可用 |
| `enabled` | ✗ | 是否启用（默认 true） |
| `server` | ✓ | 服务器连接配置 |
| `commands` | ✗ | 命令配置数组，未配置时快捷命令和运行用例不可用 |
| `logs` | ✗ | 日志监控配置（不依赖 localPath） |

### 服务器配置 (ServerConfig)

| 字段 | 必填 | 说明 |
|------|------|------|
| `host` | ✓ | 服务器 IP 地址 |
| `port` | ✓ | SSH 端口，默认 22 |
| `username` | ✓ | SSH 用户名 |
| `password` | ✗ | SSH 密码（密码认证） |
| `privateKeyPath` | ✗ | SSH 私钥路径（密钥认证，优先于密码） |
| `remoteDirectory` | ✗ | 远程工作目录，未配置时文件上传功能不可用 |

### 命令配置 (CommandConfig)

| 字段 | 说明 |
|------|------|
| `name` | 命令名称（多命令选择时显示） |
| `executeCommand` | 执行命令（支持变量替换） |
| `includePatterns` | 包含匹配模式（只保留匹配的行） |
| `excludePatterns` | 排除匹配模式（排除匹配的行） |
| `colorRules` | 颜色规则（根据正则匹配渲染颜色） |
| `selectable` | 命令可见性控制，默认 false（运行用例可用，快捷命令不可用） |

**selectable 配置说明**:
- 未配置或 `false`：命令在运行用例时显示，不在快捷命令中显示
- `true`：命令仅在快捷命令中显示，不在运行用例时显示

### 支持的命令变量

| 变量 | 说明 | 配置要求 |
|------|------|----------|
| `{filePath}` | 远程文件完整路径 | 需要 `localPath` 和 `remoteDirectory` |
| `{fileName}` | 远程文件名 | 需要 `localPath` 和 `remoteDirectory` |
| `{fileDir}` | 远程文件所在目录 | 需要 `localPath` 和 `remoteDirectory` |
| `{localPath}` | 本地文件完整路径 | 需要 `localPath` |
| `{localDir}` | 本地文件所在目录 | 需要 `localPath` |
| `{localFileName}` | 本地文件名 | 需要 `localPath` |
| `{remoteDir}` | 远程工程目录 | 需要 `remoteDirectory` |

### 全局配置

| 字段 | 说明 |
|------|------|
| `ai` | AI 服务配置（全局） |
| `refreshInterval` | 日志刷新间隔（毫秒），默认 0（禁用自动刷新） |

## 功能可用性矩阵

| 功能 | 完整配置 | 仅 localPath | 仅 logs 配置 | 无路径配置 |
|------|----------|--------------|--------------|------------|
| 快捷命令（无变量） | ✓ | ✓ | ✓ | ✓ |
| 快捷命令（本地变量） | ✓ | ✓ | ✗ | ✗ |
| 快捷命令（远程变量） | ✓ | ✗ | ✓ | ✗ |
| 文件上传 | ✓ | ✗ | ✗ | ✗ |
| Git 变更监控 | ✓ | ✓ | ✗ | ✗ |
| 日志监控 | ✓ | ✓ | ✓ | ✓ |
| 运行用例 | ✓ | ✗ | ✗ | ✗ |

> **说明**: 
> - **完整配置**: 配置了 `localPath`、`remoteDirectory`、`commands`、`logs`
> - **仅 localPath**: 仅配置了 `localPath`，用于 Git 监控和本地变量命令
> - **仅 logs 配置**: 仅配置了 `logs.directories`，用于日志监控
> - **无路径配置**: 仅配置了 `server` 和 `commands`（无变量），用于执行简单快捷命令

## 支持的 AI 模型

### QWen (通义千问)

| 模型 | 说明 |
|------|------|
| qwen-turbo | 快速响应模型 |
| qwen-plus | 增强模型 |
| qwen-max | 最强模型 |
| qwen-max-longcontext | 长上下文模型 |

### OpenAI

| 模型 | 说明 |
|------|------|
| gpt-3.5-turbo | 快速响应模型 |
| gpt-3.5-turbo-16k | 长上下文模型 |
| gpt-4 | 高级模型 |
| gpt-4-32k | 超长上下文模型 |
| gpt-4-turbo | 最新模型 |

## 命令列表

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

## 文档

- [设计文档](./doc/Design.md) - 系统架构和模块概览
- [开发流程](./DEVELOPMENT.md) - 开发流程规范
- [功能文档](./doc/FUNCTIONS.md) - 功能使用说明
- [配置模块](./doc/config.md) - 配置模块详细文档
- [命令执行模块](./doc/commandExecutor.md) - 命令执行模块详细文档
- [日志监控模块](./doc/logMonitor.md) - 日志监控模块详细文档
- [AI 对话模块](./doc/ai.md) - AI 对话模块详细文档

## 目录结构

```
d:\code\AutoTest
├── .vscode/                # VSCode 配置
│   ├── launch.json         # 调试配置
│   └── tasks.json          # 任务配置
├── dist/                   # webpack 打包输出
│   └── extension.js
├── doc/                    # 文档
│   ├── Design.md           # 设计文档
│   ├── FUNCTIONS.md        # 功能文档
│   ├── ai.md               # AI 模块文档
│   ├── ai-mode-design.md   # AI 多模式设计
│   ├── commandExecutor.md  # 命令执行文档
│   ├── config.md           # 配置模块文档
│   └── logMonitor.md       # 日志监控文档
├── resources/              # 资源文件
│   └── icon.svg            # 插件图标
├── src/                    # 源代码
│   ├── ai/                 # AI 模块
│   │   ├── chat.ts         # AI 对话管理
│   │   ├── providers.ts    # AI 提供商实现
│   │   ├── sessionManager.ts # 会话管理
│   │   └── index.ts
│   ├── config/             # 配置模块
│   │   ├── index.ts        # 配置加载和管理
│   │   ├── validator.ts    # 配置验证
│   │   └── validatorUI.ts  # 配置验证 UI
│   ├── core/               # 核心功能模块
│   │   ├── commandExecutor.ts  # 命令执行
│   │   ├── uploader.ts     # 文件上传
│   │   ├── logMonitor.ts   # 日志监控
│   │   ├── sshClient.ts    # SSH 客户端
│   │   ├── scpClient.ts    # SCP 客户端
│   │   ├── connectionPool.ts # 连接池
│   │   ├── gitChangeDetector.ts # Git 变更检测
│   │   └── quickCommandDetector.ts # 快捷命令检测
│   ├── types/              # 类型定义
│   │   └── index.ts
│   ├── utils/              # 工具模块
│   │   ├── colorRules.ts   # 内置颜色规则
│   │   ├── outputFilter.ts # 输出过滤和着色
│   │   └── outputChannel.ts # 输出通道管理
│   ├── views/              # UI 视图
│   │   ├── aiChatView.ts   # AI 对话界面
│   │   ├── logTreeView.ts  # 日志监控界面
│   │   ├── changesTreeView.ts # 变更监控界面
│   │   ├── quickCommandsTreeView.ts # 快捷命令界面
│   │   └── index.ts
│   └── extension.ts        # 扩展入口
├── test/                   # 测试用例
│   ├── suite/
│   │   ├── ai.test.ts
│   │   ├── aiStreaming.test.ts
│   │   ├── commandExecutor.test.ts
│   │   ├── config.test.ts
│   │   ├── logMonitor.test.ts
│   │   ├── logMonitorProject.test.ts
│   │   ├── multiProject.test.ts
│   │   ├── outputFilter.test.ts
│   │   ├── scpClient.test.ts
│   │   ├── sessionManager.test.ts
│   │   ├── sshClient.test.ts
│   │   └── types.test.ts
│   ├── package.json
│   ├── runTest.ts
│   └── tsconfig.json
├── .gitignore
├── .vscodeignore           # 打包排除配置
├── DEVELOPMENT.md          # 开发流程文档
├── LICENSE
├── README.md               # 本文档
├── autotest-config.json    # 默认配置文件
├── package.json            # 扩展配置
├── tsconfig.json           # TypeScript 配置
└── webpack.config.js       # webpack 配置
```

## 许可证

MIT

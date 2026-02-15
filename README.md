# AutoTest

一款 VSCode 插件，旨在简化测试工作流程，提供文件上传、命令执行、日志监控和 AI 对话功能。

## 功能特性

- **文件上传**: 支持单文件和目录上传，右键菜单操作
- **运行用例**: 上传文件并自动执行配置的测试命令
- **日志监控**: 实时监控服务器日志，支持多目录、下载到本地
- **AI 对话**: 支持多种 AI 提供商（QWen、OpenAI），可配置模型名称

## 快速开始

### 安装依赖

```bash
npm install
```

### 编译

```bash
npm run compile
```

### 运行测试

```bash
npm run test:unit
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
> - `privateKeyPath`: 本地私钥绝对路径，如 `C:\Users\user\.ssh\id_rsa`
> - `remoteDirectory`: 远程服务器绝对路径，如 `/tmp/autotest`
> - `logs.directories[].path`: 远程服务器绝对路径，如 `/var/log/myapp`
> - `logs.downloadPath`: 本地绝对路径，如 `D:\downloads`

```json
{
  "server": {
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "",
    "privateKeyPath": "",
    "remoteDirectory": "/tmp/autotest"
  },
  "command": {
    "executeCommand": "pytest {filePath} -v",
    "filterPatterns": ["PASSED", "FAILED", "ERROR"],
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
│   ├── config/             # 配置模块
│   ├── core/               # 核心功能模块
│   ├── types/              # 类型定义
│   ├── views/              # UI 视图
│   └── extension.ts        # 扩展入口
├── test/                   # 测试用例
│   ├── suite/              # 测试套件
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

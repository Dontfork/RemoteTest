# AutoTest

一款 VSCode 插件，旨在简化测试工作流程，提供文件上传、命令执行、日志监控和 AI 对话功能。

## 功能特性

- **AI 对话**: 支持多种 AI 提供商（QWen、OpenAI），可配置模型名称
- **日志监控**: 实时监控服务器日志，支持下载到本地
- **命令执行**: 执行终端命令并支持输出过滤
- **文件上传**: 上传文件到服务器并自动执行配置命令

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

## 配置

在项目根目录创建 `.vscode/autotest-config.json` 文件：

```json
{
  "server": {
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "",
    "uploadUrl": "http://192.168.1.100:8080/upload",
    "executeCommand": "http://192.168.1.100:8080/execute",
    "logDirectory": "/var/logs",
    "downloadPath": "./downloads"
  },
  "command": {
    "executeCommand": "npm test",
    "filterPatterns": ["\\[error\\]"],
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
    "monitorDirectory": "/var/logs",
    "downloadPath": "./downloads",
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
d:\AutoTest
├── src/                    # 源代码
│   ├── extension.ts        # 扩展入口
│   ├── config/             # 配置模块
│   ├── core/               # 核心功能模块
│   ├── ai/                 # AI 模块
│   ├── types/              # 类型定义
│   └── views/              # UI 视图
├── test/                   # 测试用例
├── doc/                    # 文档
├── package.json            # 扩展配置
├── tsconfig.json           # TypeScript 配置
├── README.md               # 本文档
├── DEVELOPMENT.md          # 开发流程文档
└── autotest-config.json    # 默认配置文件
```

## 许可证

MIT

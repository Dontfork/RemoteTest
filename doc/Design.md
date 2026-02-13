# AutoTest 插件设计文档

## 1. 概述

AutoTest 是一款 VSCode 插件，旨在简化测试工作流程，提供文件上传、命令执行、日志监控和 AI 对话功能。插件采用模块化设计，支持灵活配置和扩展。

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
│  │   AIChat    │  │ LogMonitor  │  │FileUploader │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │CommandExec  │  │   Config    │  │   axios     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## 3. 模块概览

| 模块 | 文档 | 职责 |
|------|------|------|
| 配置模块 | [config.md](./config.md) | 管理插件配置，支持自动创建默认配置文件 |
| 命令执行模块 | [commandExecutor.md](./commandExecutor.md) | 执行终端命令并过滤输出 |
| 日志监控模块 | [logMonitor.md](./logMonitor.md) | 监控和下载服务器日志文件 |
| AI 对话模块 | [ai.md](./ai.md) | 提供与 AI 模型的对话能力 |

## 4. 配置结构

### 4.1 完整配置接口

```typescript
interface AutoTestConfig {
    server: ServerConfig;      // 服务器连接配置
    command: CommandConfig;    // 命令执行配置
    ai: AIConfig;              // AI 服务配置
    logs: LogsConfig;          // 日志监控配置
}
```

### 4.2 配置文件位置

`{workspace}/.vscode/autotest-config.json`

### 4.3 配置示例

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

## 5. UI 设计

### 5.1 活动栏 - AI 对话

**位置**: VSCode 左侧活动栏

**组件**:
- 消息列表区域
- 输入框
- 发送按钮 (箭头图标)

**样式特点**:
- 简约风格
- 使用 VSCode 原生主题色
- 消息气泡式布局

### 5.2 资源管理器 - 日志监控

**位置**: 资源管理器面板下方

**组件**:
- 日志文件树形列表
- 刷新按钮
- 文件大小和修改时间显示

## 6. 命令列表

| 命令 ID | 描述 | 触发方式 |
|---------|------|----------|
| `autotest.uploadAndExecute` | 上传文件并执行命令 | 命令面板 |
| `autotest.monitorLogs` | 监控日志 | 命令面板 |
| `autotest.refreshLogs` | 刷新日志列表 | 工具栏按钮 |
| `autotest.downloadLog` | 下载日志文件 | 点击日志项 |

## 7. 数据流

### 7.1 文件上传流程

```
用户选择文件
    │
    ▼
FileUploader.uploadAndExecute()
    │
    ├── 读取文件内容
    │
    ▼
POST → server.uploadUrl
    │
    ▼
CommandExecutor.executeWithConfig()
    │
    ├── 执行配置命令
    │
    ├── 过滤输出
    │
    ▼
显示到 OutputChannel
```

### 7.2 AI 对话流程

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
AIChat.sendMessage()
    │
    ├── 添加到历史
    │
    ├── 获取配置的模型名称
    │
    ├── 调用 AI API (携带 model 参数)
    │
    ▼
返回响应到 Webview
```

## 8. 扩展性设计

### 8.1 AI 提供商扩展

新增 AI 提供商需要:
1. 在 `types/index.ts` 中添加配置接口 (包含 apiKey, apiUrl, model 字段)
2. 在 `ai/providers.ts` 中实现新的 Provider 类
3. 在 `AIConfig` 中添加配置项
4. 在 `sendMessage()` 中添加路由逻辑

详见 [AI 对话模块文档](./ai.md#10-扩展性设计)

### 8.2 Agent 模式预留

AI 模块设计支持未来扩展为 Agent 模式:
- 消息历史管理
- 工具调用接口预留
- 多轮对话支持

## 9. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 配置加载失败 | 使用默认配置 |
| API 请求失败 | 显示错误消息 |
| 文件操作失败 | 抛出异常并提示用户 |
| 模型名称为空 | 使用默认模型 |

## 10. 性能考虑

- 日志监控使用定时器，默认 5 秒刷新
- API 请求设置 60 秒超时
- 文件上传设置 30 秒超时

## 11. 目录结构

```
d:\AutoTest
├── src/
│   ├── extension.ts          # 扩展入口
│   ├── config/               # 配置模块
│   │   └── index.ts
│   ├── core/                 # 核心功能模块
│   │   ├── commandExecutor.ts
│   │   ├── fileUploader.ts
│   │   └── logMonitor.ts
│   ├── ai/                   # AI 模块
│   │   ├── chat.ts
│   │   └── providers.ts
│   ├── types/                # 类型定义
│   │   └── index.ts
│   └── views/                # UI 视图
│       ├── aiChatView.ts
│       └── logTreeView.ts
├── test/                     # 测试用例
│   └── suite/
│       ├── types.test.ts
│       ├── config.test.ts
│       ├── commandExecutor.test.ts
│       ├── logMonitor.test.ts
│       └── ai.test.ts
├── doc/                      # 文档
│   ├── Design.md             # 本文档（总览）
│   ├── config.md             # 配置模块详细文档
│   ├── commandExecutor.md    # 命令执行模块详细文档
│   ├── logMonitor.md         # 日志监控模块详细文档
│   ├── ai.md                 # AI对话模块详细文档
│   └── FUNCTIONS.md          # 功能使用文档
├── package.json              # 扩展配置
├── tsconfig.json             # TypeScript 配置
└── autotest-config.json      # 默认配置文件
```

## 12. 快速开始

### 12.1 安装依赖

```bash
npm install
```

### 12.2 编译

```bash
npm run compile
```

### 12.3 运行测试

```bash
npm run test:unit
```

### 12.4 调试

1. 在 VSCode 中打开项目
2. 按 F5 启动调试
3. 在新窗口中测试插件功能

## 13. 相关文档

- [配置模块详细文档](./config.md)
- [命令执行模块详细文档](./commandExecutor.md)
- [日志监控模块详细文档](./logMonitor.md)
- [AI 对话模块详细文档](./ai.md)
- [功能使用文档](./FUNCTIONS.md)

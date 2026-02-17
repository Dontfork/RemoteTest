# AI 模块设计文档

## 1. 模块概述

AI 模块提供与 AI 大模型进行对话交互的能力，支持多个 AI 提供商（QWen、OpenAI 及兼容模型），采用模型列表配置方式，支持自部署模型和代理配置，维护对话历史，为用户提供智能问答和辅助功能。

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AI Module Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                        AIChatViewProvider                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │ ModelSelect │  │  ChatPanel  │  │    MessageList          │   │   │
│  │  │  (模型选择)  │  │  (对话面板)  │  │    (消息列表)            │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                           AIChat                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │   │
│  │  │ sessions[]   │  │  provider    │  │  sessionManager      │    │   │
│  │  │ (会话历史)    │  │  (提供商实例) │  │  (会话管理器)         │    │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                      AIProvider (Strategy Pattern)                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │ QWenProvider│  │OpenAIProvider│  │   Custom Providers      │   │   │
│  │  │ (通义千问)   │  │ (OpenAI兼容) │  │   (自部署模型)           │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                           AI APIs                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │ QWen API    │  │ OpenAI API  │  │   Self-hosted APIs      │   │   │
│  │  │ (阿里云)     │  │ (官方/兼容)  │  │   (Ollama/LocalAI等)    │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 对话流程

```
用户输入消息
    │
    ▼
AIChatViewProvider (Webview)
    │
    ├── postMessage 发送到扩展
    │
    ▼
AIChat.sendMessageStream(userMessage, callback)
    │
    ├── 验证模型配置
    │
    ├── 添加用户消息到会话
    │
    ├── 调用 provider.send(messages)
    │   │
    │   ├── 构建请求体 (包含 model)
    │   │
    │   ├── 应用代理配置（如有）
    │   │
    │   ├── 发送 HTTP 请求（流式）
    │   │
    │   └── 解析流式响应
    │
    ├── 流式回调更新 UI
    │
    ├── 添加 AI 响应到会话
    │
    ▼
返回响应到 Webview 显示
```

### 2.3 Provider 模式

模块采用策略模式（Strategy Pattern）设计，通过 `AIProvider` 接口抽象不同 AI 提供商的实现：

```
         AIProvider (Interface)
                │
        ┌───────┼───────┐
        │       │       │
  QWenProvider  │  CustomProvider
        │       │       │
   QWen API  OpenAI API  Self-hosted
```

**模型自动识别**：
- 系统根据模型名称自动选择对应的 API 格式
- QWen 模型：名称包含 `qwen`（如 qwen-turbo、qwen-plus、qwen-max）
- OpenAI 模型：名称包含 `gpt`（如 gpt-3.5-turbo、gpt-4、gpt-4o）
- 其他模型：使用自定义 `apiUrl`，采用 OpenAI 兼容格式

## 3. 类型定义

### 3.1 消息接口

```typescript
interface AIMessage {
    role: 'user' | 'assistant' | 'system';  // 消息角色
    content: string;                         // 消息内容
}
```

**角色说明**：

| 角色 | 说明 | 使用场景 |
|------|------|----------|
| system | 系统消息 | 设定 AI 行为和角色 |
| user | 用户消息 | 用户的提问或输入 |
| assistant | 助手消息 | AI 的回复 |

### 3.2 响应接口

```typescript
interface AIResponse {
    content: string;    // AI 回复内容
    error?: string;     // 错误信息（可选）
}
```

### 3.3 提供商接口

```typescript
interface AIProvider {
    send(messages: AIMessage[]): Promise<AIResponse>;
    sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse>;
}
```

### 3.4 配置接口

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

### 3.5 会话接口

```typescript
interface ChatSession {
    id: string;
    title: string;
    messages: AIMessage[];
    createdAt: number;
    updatedAt: number;
}
```

## 4. 功能实现

### 4.1 AIChat 类

AIChat 是 AI 对话模块的核心类，负责管理会话和调用 AI 提供商。

```typescript
export class AIChat {
    private provider: AIProvider | null = null;
    private sessionManager: SessionManager;
    private currentModelName: string | null = null;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
        this.initProvider();
    }

    // 模型管理
    setModel(modelName: string): boolean;
    getCurrentModel(): string | null;
    getAvailableModels(): AIModelConfig[];

    // 会话管理
    getCurrentSession(): ChatSession | null;
    setCurrentSession(sessionId: string): ChatSession | null;
    getAllSessions(): ChatSession[];
    createNewSession(): ChatSession;
    deleteSession(sessionId: string): boolean;
    clearCurrentSession(): ChatSession | null;

    // 消息发送
    async sendMessage(userMessage: string): Promise<AIResponse>;
    async sendMessageStream(userMessage: string, onChunk: (chunk: string) => void): Promise<AIResponse>;
}
```

### 4.2 AIProviderImpl 类

统一的 AI 提供商实现，支持 QWen 和 OpenAI 兼容 API。

```typescript
export class AIProviderImpl implements AIProvider {
    private config: AIModelConfig;
    private globalProxy?: string;

    constructor(config: AIModelConfig, globalProxy?: string) {
        this.config = config;
        this.globalProxy = globalProxy;
    }

    private getProxy(): string | undefined {
        return this.config.proxy || this.globalProxy;
    }

    async send(messages: AIMessage[]): Promise<AIResponse>;
    async sendStream(messages: AIMessage[], onChunk: (chunk: string) => void): Promise<AIResponse>;
}
```

### 4.3 SessionManager 类

会话管理器，负责会话的持久化存储和管理。

```typescript
export class SessionManager {
    private sessions: Map<string, ChatSession> = new Map();
    private currentSessionId: string | null = null;
    private storageKey: string = 'autotest.ai.sessions';

    getCurrentSession(): ChatSession | null;
    setCurrentSession(sessionId: string): ChatSession | null;
    getAllSessions(): ChatSession[];
    createSession(): ChatSession;
    deleteSession(sessionId: string): boolean;
    clearSession(sessionId: string): ChatSession | null;
    updateSession(sessionId: string, updates: Partial<ChatSession>): void;
}
```

## 5. 配置说明

### 5.1 基本配置

```json
{
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
    "defaultModel": "qwen-turbo"
  }
}
```

### 5.2 自部署模型配置

对于自部署的模型（如 Ollama、LocalAI），可以不配置 `apiKey`：

```json
{
  "ai": {
    "models": [
      {
        "name": "local-llm",
        "apiUrl": "http://localhost:8000/v1/chat/completions"
      }
    ],
    "defaultModel": "local-llm"
  }
}
```

### 5.3 代理配置

支持全局代理，适用于需要通过代理访问外网的内网环境：

```json
{
  "ai": {
    "models": [
      {
        "name": "gpt-4",
        "apiKey": "your-api-key"
      }
    ],
    "proxy": "proxy.company.com:8080"
  }
}
```

### 5.4 配置字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `models` | 是 | 模型配置列表 |
| `models[].name` | 是 | 模型名称，系统根据名称自动识别 API 格式 |
| `models[].apiKey` | 否 | API 密钥，自部署模型可能不需要 |
| `models[].apiUrl` | 否 | 自定义 API 地址 |
| `defaultModel` | 否 | 默认使用的模型名称，默认使用第一个模型 |
| `proxy` | 否 | 全局代理，格式 `host:port` |

## 6. 支持的模型

### 6.1 QWen 模型

| 模型名称 | 说明 | 适用场景 |
|----------|------|----------|
| qwen-turbo | 快速响应模型 | 日常对话、快速问答 |
| qwen-plus | 增强模型 | 复杂任务、代码生成 |
| qwen-max | 最强模型 | 高质量输出、复杂推理 |
| qwen-max-longcontext | 长上下文模型 | 长文档处理 |

### 6.2 OpenAI 模型

| 模型名称 | 说明 | 适用场景 |
|----------|------|----------|
| gpt-3.5-turbo | 快速响应模型 | 日常对话、快速问答 |
| gpt-4 | 高级模型 | 复杂推理、代码生成 |
| gpt-4-turbo | 最新模型 | 最新功能支持 |
| gpt-4o | 多模态模型 | 图文理解 |

### 6.3 自部署模型

支持任何 OpenAI 兼容的 API，包括：
- Ollama
- LocalAI
- vLLM
- 其他兼容服务

## 7. API 接口规范

### 7.1 QWen API

**请求地址**：
```
POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
```

**请求头**：
```
Authorization: Bearer {apiKey}
Content-Type: application/json
```

**请求体**：
```json
{
    "model": "qwen-turbo",
    "messages": [
        { "role": "user", "content": "你好" }
    ],
    "stream": true
}
```

### 7.2 OpenAI API

**请求地址**：
```
POST https://api.openai.com/v1/chat/completions
```

**请求头**：
```
Authorization: Bearer {apiKey}
Content-Type: application/json
```

**请求体**：
```json
{
    "model": "gpt-4",
    "messages": [
        { "role": "user", "content": "你好" }
    ],
    "stream": true
}
```

## 8. Webview 集成

AI 对话模块通过 Webview 在 VSCode 活动栏中显示。

### 8.1 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌────────────────────────────────────┐  │
│  │  模型选择     │  │           工具栏                   │  │
│  │  [下拉框]    │  │   [新对话] [历史]                  │  │
│  └──────────────┘  └────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              对话区域                                │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ 用户: 帮我分析测试结果                         │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ AI: 好的，我来分析...                         │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [输入消息...                                    ] [发送]   │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 消息通信

```typescript
// Webview 发送消息到扩展
webview.postMessage({
    command: 'sendMessage',
    data: userInput
});

// 扩展处理消息
webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
        case 'sendMessage':
            await handleSendMessage(message.data);
            break;
        case 'switchModel':
            aiChat.setModel(message.modelName);
            break;
        case 'getModels':
            sendAvailableModels();
            break;
        // ... 其他命令
    }
});
```

### 8.3 Markdown 渲染

AI 回复支持 Markdown 语法渲染，使用 `marked` 库：

| 语法 | 渲染效果 |
|------|----------|
| `**粗体**` | **粗体** |
| `*斜体*` | *斜体* |
| `` `代码` `` | `代码` |
| ` ```代码块``` ` | 代码块 |
| `# 标题` | H1-H4 标题 |
| `- 列表项` | 无序列表 |
| `> 引用` | 引用块 |
| `[链接](url)` | 超链接 |

## 9. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 未配置 AI 服务 | 返回错误提示 |
| API Key 未配置（需要时） | 返回具体提示 |
| API 请求超时 | 60 秒超时，返回错误 |
| API 返回错误 | 解析错误信息并返回 |
| 网络错误 | 捕获异常并返回错误信息 |
| 流式请求失败 | 回退到非流式请求 |

## 10. 扩展性设计

### 10.1 添加新模型

只需在配置文件中添加模型配置，系统会自动识别：

```json
{
  "ai": {
    "models": [
      {
        "name": "new-model",
        "apiKey": "your-api-key",
        "apiUrl": "https://api.example.com/v1/chat/completions"
      }
    ]
  }
}
```

### 10.2 Agent 模式预留

模块设计支持未来扩展为 Agent 模式：

- 消息历史管理已实现
- 可扩展工具调用接口
- 支持多轮对话

**Agent 模式设计（规划中）**：

```
┌───────────────────────────────────────────────────────────────────┐
│                      ToolRegistry (Agent Mode)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ FileTool    │  │ CommandTool │  │   LogTool               │   │
│  │ (文件操作)   │  │ (命令执行)   │  │   (日志分析)             │   │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

**可用工具（规划中）**：

| 工具名称 | 描述 | 参数 |
|----------|------|------|
| readFile | 读取文件内容 | path: string |
| writeFile | 写入文件内容 | path: string, content: string |
| executeCommand | 执行命令 | command: string |
| analyzeLog | 分析日志文件 | logPath: string, pattern: string |
| uploadFile | 上传文件到服务器 | localPath: string |
| downloadLog | 下载日志文件 | remotePath: string |

## 11. 性能考虑

- API 请求设置 60 秒超时
- 会话存储使用 VSCode 全局状态
- 支持流式响应，提升用户体验
- 使用异步请求不阻塞 UI
- 代理配置支持网络隔离环境

## 12. 测试覆盖

AI 模块测试覆盖以下场景：

- 模型配置验证测试
- QWen 提供商测试
- OpenAI 提供商测试
- 流式响应测试
- 会话管理测试
- 错误处理测试
- 代理配置测试
- 自部署模型测试

详见测试文件：
- `test/suite/ai.test.ts`
- `test/suite/aiChatView.test.ts`
- `test/suite/configValidator.test.ts`

## 11. 自定义系统 Prompt

### 11.1 功能概述

支持用户自定义系统 Prompt，可以：
- 直接在界面输入自定义 Prompt
- 从文件导入 Prompt（支持 .txt 和 .md 文件）

### 11.2 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌────────────────────────────────────┐  │
│  │  模型选择     │  │           工具栏                   │  │
│  │  [下拉框]    │  │   [新对话] [历史]                  │  │
│  └──────────────┘  └────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  系统提示词                                    [导入] │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ 你是一个测试助手，帮助用户分析测试结果...      │  │   │
│  │  │                                              │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              对话区域                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [输入消息...                                    ] [发送]   │
└─────────────────────────────────────────────────────────────┘
```

### 11.3 消息结构

发送消息时，系统会自动将自定义 Prompt 作为第一条 system 消息：

```typescript
const messages = [
    { role: 'system', content: customPrompt },  // 自定义系统提示
    { role: 'user', content: userMessage },
    // ... 历史消息
];
```

### 11.4 文件导入

支持导入 .txt 和 .md 格式的 Prompt 文件：
- 点击"导入"按钮选择文件
- 文件内容自动填充到 Prompt 输入框
- 可编辑后使用

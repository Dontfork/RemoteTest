# AI 对话模块 (AI Chat Module)

## 1. 模块概述

AI 对话模块提供与 AI 大模型进行对话交互的能力，支持多个 AI 提供商（QWen、OpenAI），可配置模型名称，维护对话历史，为用户提供智能问答和辅助功能。

## 2. 设计方案

### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Chat Module                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                     AIChat                          │    │
│  │  ┌──────────────┐  ┌──────────────┐                │    │
│  │  │ messages[]   │  │  provider    │                │    │
│  │  │ (消息历史)    │  │  (提供商实例) │                │    │
│  │  └──────────────┘  └──────────────┘                │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                AIProvider Interface                  │    │
│  │  ┌──────────────────┐  ┌──────────────────┐         │    │
│  │  │   QWenProvider   │  │   OpenAIProvider  │         │    │
│  │  │  (通义千问实现)   │  │   (OpenAI实现)    │         │    │
│  │  └──────────────────┘  └──────────────────┘         │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    AI APIs                           │    │
│  │  ┌──────────────────┐  ┌──────────────────┐         │    │
│  │  │ QWen API (阿里云) │  │ OpenAI API       │         │    │
│  │  │ dashscope        │  │ api.openai.com   │         │    │
│  │  └──────────────────┘  └──────────────────┘         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
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
AIChat.sendMessage(userMessage)
    │
    ├── 验证 API Key 配置
    │
    ├── 添加用户消息到历史
    │
    ├── 调用 provider.send(messages)
    │   │
    │   ├── 构建请求体 (包含 model)
    │   │
    │   ├── 发送 HTTP 请求
    │   │
    │   └── 解析响应
    │
    ├── 添加 AI 响应到历史
    │
    ▼
返回响应到 Webview 显示
```

### 2.3 Provider 模式

模块采用策略模式（Strategy Pattern）设计，通过 `AIProvider` 接口抽象不同 AI 提供商的实现：

```
         AIProvider (Interface)
                │
        ┌───────┴───────┐
        │               │
  QWenProvider    OpenAIProvider
        │               │
   QWen API        OpenAI API
```

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
}
```

### 3.4 配置接口

```typescript
interface AIConfig {
    provider: 'qwen' | 'openai';  // 当前使用的提供商
    qwen: QWenConfig;             // QWen 配置
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

## 4. 功能实现

### 4.1 AIChat 类

AIChat 是 AI 对话模块的核心类，负责管理对话历史和调用 AI 提供商。

```typescript
export class AIChat {
    private messages: AIMessage[] = [];
    private provider: AIProvider;

    constructor() {
        const config = getConfig();
        const aiConfig = config.ai;

        // 根据配置选择提供商
        if (aiConfig.provider === 'qwen') {
            this.provider = new QWenProvider(aiConfig.qwen);
        } else {
            this.provider = new OpenAIProvider(aiConfig.openai);
        }
    }

    // 切换提供商
    setProvider(provider: 'qwen' | 'openai'): void;

    // 消息管理
    addMessage(role: 'user' | 'assistant' | 'system', content: string): void;
    clearMessages(): void;
    getMessages(): AIMessage[];

    // 发送消息
    async sendMessage(userMessage: string): Promise<AIResponse>;
}
```

#### 构造函数

```typescript
constructor() {
    const config = getConfig();
    const aiConfig = config.ai;

    if (aiConfig.provider === 'qwen') {
        this.provider = new QWenProvider(aiConfig.qwen);
    } else {
        this.provider = new OpenAIProvider(aiConfig.openai);
    }
}
```

#### setProvider(provider: 'qwen' | 'openai'): void

切换 AI 提供商。

```typescript
setProvider(provider: 'qwen' | 'openai'): void {
    const config = getConfig();
    const aiConfig = config.ai;

    if (provider === 'qwen') {
        this.provider = new QWenProvider(aiConfig.qwen);
    } else {
        this.provider = new OpenAIProvider(aiConfig.openai);
    }
}
```

#### addMessage(role, content): void

添加消息到历史记录。

```typescript
addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    this.messages.push({ role, content });
}
```

#### clearMessages(): void

清空对话历史。

```typescript
clearMessages(): void {
    this.messages = [];
}
```

#### getMessages(): AIMessage[]

获取当前对话历史（返回副本）。

```typescript
getMessages(): AIMessage[] {
    return [...this.messages];
}
```

#### sendMessage(userMessage: string): Promise<AIResponse>

发送用户消息并获取 AI 响应。

```typescript
async sendMessage(userMessage: string): Promise<AIResponse> {
    const config = getConfig();
    
    // 1. 验证配置
    if (!config.ai) {
        return { content: '', error: '请先配置 AI 服务' };
    }

    if (config.ai.provider === 'qwen' && !config.ai.qwen?.apiKey) {
        return { content: '', error: '请配置 QWen API Key' };
    }

    if (config.ai.provider === 'openai' && !config.ai.openai?.apiKey) {
        return { content: '', error: '请配置 OpenAI API Key' };
    }

    // 2. 添加用户消息
    this.addMessage('user', userMessage);

    // 3. 调用 AI 提供商
    const response = await this.provider.send(this.messages);

    // 4. 添加 AI 响应（仅当成功时）
    if (response.content && !response.error) {
        this.addMessage('assistant', response.content);
    }

    return response;
}
```

### 4.2 QWenProvider 类

通义千问 API 实现。

```typescript
export class QWenProvider implements AIProvider {
    private config: QWenConfig;

    constructor(config: QWenConfig) {
        this.config = config;
    }

    async send(messages: AIMessage[]): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
        const model = this.config.model || 'qwen-turbo';

        try {
            const response = await axios.post(apiUrl, {
                model: model,
                input: { 
                    messages: messages.map(m => ({ 
                        role: m.role, 
                        content: m.content 
                    })) 
                },
                parameters: { result_format: 'message' }
            }, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            const content = response.data?.output?.choices?.[0]?.message?.content || '';
            return { content: content || 'AI 未返回有效响应' };
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }
}
```

### 4.3 OpenAIProvider 类

OpenAI API 实现。

```typescript
export class OpenAIProvider implements AIProvider {
    private config: OpenAIConfig;

    constructor(config: OpenAIConfig) {
        this.config = config;
    }

    async send(messages: AIMessage[]): Promise<AIResponse> {
        const apiUrl = this.config.apiUrl || 
            'https://api.openai.com/v1/chat/completions';
        const model = this.config.model || 'gpt-3.5-turbo';

        try {
            const response = await axios.post(apiUrl, {
                model: model,
                messages: messages.map(m => ({ 
                    role: m.role, 
                    content: m.content 
                }))
            }, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            });

            const content = response.data?.choices?.[0]?.message?.content || '';
            return { content: content || 'AI 未返回有效响应' };
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.message || '请求失败';
            return { content: '', error: errorMsg };
        }
    }
}
```

## 5. 支持的模型

### 5.1 QWen 模型

| 模型名称 | 说明 | 适用场景 |
|----------|------|----------|
| qwen-turbo | 快速响应模型 | 日常对话、快速问答 |
| qwen-plus | 增强模型 | 复杂任务、代码生成 |
| qwen-max | 最强模型 | 高质量输出、复杂推理 |
| qwen-max-longcontext | 长上下文模型 | 长文档处理 |

### 5.2 OpenAI 模型

| 模型名称 | 说明 | 适用场景 |
|----------|------|----------|
| gpt-3.5-turbo | 快速响应模型 | 日常对话、快速问答 |
| gpt-3.5-turbo-16k | 长上下文模型 | 中等长度文档 |
| gpt-4 | 高级模型 | 复杂推理、代码生成 |
| gpt-4-32k | 超长上下文模型 | 长文档处理 |
| gpt-4-turbo | 最新模型 | 最新功能支持 |

### 5.3 模型选择逻辑

```typescript
// 优先使用配置中的模型
const model = this.config.model || 'qwen-turbo';  // QWen 默认
const model = this.config.model || 'gpt-3.5-turbo';  // OpenAI 默认
```

## 6. API 接口规范

### 6.1 QWen API

**请求地址**：
```
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
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
    "input": {
        "messages": [
            { "role": "user", "content": "你好" }
        ]
    },
    "parameters": {
        "result_format": "message"
    }
}
```

**响应体**：
```json
{
    "output": {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "你好！有什么我可以帮助你的吗？"
                }
            }
        ]
    }
}
```

### 6.2 OpenAI API

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
    "model": "gpt-3.5-turbo",
    "messages": [
        { "role": "user", "content": "你好" }
    ]
}
```

**响应体**：
```json
{
    "choices": [
        {
            "message": {
                "role": "assistant",
                "content": "你好！有什么我可以帮助你的吗？"
            }
        }
    ]
}
```

## 7. 使用示例

### 7.1 基本使用

```typescript
import { AIChat } from './ai/chat';

const chat = new AIChat();

// 发送消息
const response = await chat.sendMessage('什么是 TypeScript？');
if (response.error) {
    console.error('Error:', response.error);
} else {
    console.log('AI:', response.content);
}
```

### 7.2 多轮对话

```typescript
const chat = new AIChat();

// 第一轮
await chat.sendMessage('我想学习 TypeScript');

// 第二轮（AI 会记住上下文）
await chat.sendMessage('从哪里开始？');

// 获取完整对话历史
const messages = chat.getMessages();
console.log('对话历史:', messages);
```

### 7.3 清空对话

```typescript
const chat = new AIChat();

// 开始新对话
await chat.sendMessage('你好');

// 清空历史，开始新话题
chat.clearMessages();

// 这是新的对话
await chat.sendMessage('请介绍一下自己');
```

### 7.4 切换提供商

```typescript
const chat = new AIChat();

// 使用 QWen
await chat.sendMessage('你好');

// 切换到 OpenAI
chat.setProvider('openai');
chat.clearMessages();  // 建议清空历史

await chat.sendMessage('你好');
```

### 7.5 添加系统消息

```typescript
const chat = new AIChat();

// 设置 AI 角色
chat.addMessage('system', '你是一个专业的 TypeScript 开发者，擅长解答编程问题。');

// 用户提问
await chat.sendMessage('如何定义接口？');
```

## 8. Webview 集成

AI 对话模块通过 Webview 在 VSCode 活动栏中显示。

### 8.1 消息通信

```typescript
// Webview 发送消息到扩展
webview.postMessage({
    type: 'sendMessage',
    message: userInput
});

// 扩展处理消息
webview.onDidReceiveMessage(async (message) => {
    if (message.type === 'sendMessage') {
        const response = await chat.sendMessage(message.message);
        webview.postMessage({
            type: 'response',
            content: response.content,
            error: response.error
        });
    }
});
```

### 8.2 UI 组件

- 消息列表区域：显示对话历史
- 输入框：用户输入消息
- 发送按钮：提交消息

### 8.3 Markdown 渲染

AI 回复支持 Markdown 语法渲染，包括：

| 语法 | 渲染效果 |
|------|----------|
| `**粗体**` | **粗体** |
| `*斜体*` | *斜体* |
| `` `代码` `` | `代码` |
| ` ```代码块``` ` | 代码块（带语法高亮） |
| `# 标题` | H1-H4 标题 |
| `- 列表项` | 无序列表 |
| `> 引用` | 引用块 |
| `[链接](url)` | 超链接 |
| `---` | 分隔线 |

**渲染实现**：
- 使用自定义 `renderMarkdown()` 函数解析 Markdown
- 支持 VSCode 主题变量，自动适配深色/浅色主题
- 代码块使用等宽字体和背景色区分
- 用户消息不渲染 Markdown，仅显示原始文本

## 9. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 未配置 AI 服务 | 返回错误提示 |
| API Key 未配置 | 返回具体提示 |
| API 请求超时 | 60 秒超时，返回错误 |
| API 返回错误 | 解析错误信息并返回 |
| 网络错误 | 捕获异常并返回错误信息 |

## 10. 扩展性设计

### 10.1 添加新提供商

1. 创建新的 Provider 类实现 `AIProvider` 接口：

```typescript
export class NewAIProvider implements AIProvider {
    private config: NewAIConfig;

    constructor(config: NewAIConfig) {
        this.config = config;
    }

    async send(messages: AIMessage[]): Promise<AIResponse> {
        // 实现调用逻辑
    }
}
```

2. 在类型定义中添加配置接口：

```typescript
interface NewAIConfig {
    apiKey: string;
    apiUrl: string;
    model: string;
}

interface AIConfig {
    provider: 'qwen' | 'openai' | 'newai';
    qwen: QWenConfig;
    openai: OpenAIConfig;
    newai: NewAIConfig;  // 新增
}
```

3. 在 AIChat 中添加路由：

```typescript
if (aiConfig.provider === 'newai') {
    this.provider = new NewAIProvider(aiConfig.newai);
}
```

### 10.2 Agent 模式预留

模块设计支持未来扩展为 Agent 模式：

- 消息历史管理已实现
- 可扩展工具调用接口
- 支持多轮对话

## 11. 性能考虑

- API 请求设置 60 秒超时
- 消息历史存储在内存中
- 支持清空历史释放内存
- 使用异步请求不阻塞 UI

## 12. 测试覆盖

AI 对话模块测试覆盖以下场景：

- 消息管理测试
- QWen 提供商测试
- OpenAI 提供商测试
- 响应处理测试
- 提供商选择测试
- API 配置测试
- 请求配置测试
- 错误处理测试
- 对话上下文测试

详见测试文件：`test/suite/ai.test.ts`

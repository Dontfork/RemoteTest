# AI 模块多模式架构设计

## 1. 设计目标

设计一个可扩展的 AI 模块架构，支持多种交互模式：
- **Chat 模式**：基础对话模式，提供问答能力
- **Agent 模式**：自主执行模式，可调用工具完成任务
- **Plan 模式**：规划模式，分解复杂任务并逐步执行

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
│  │  │ ModeSelector│  │  ChatPanel  │  │    MessageList          │   │   │
│  │  │  (模式选择)  │  │  (对话面板)  │  │    (消息列表)            │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                         ModeManager                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │ ChatMode    │  │ AgentMode   │  │    PlanMode             │   │   │
│  │  │ (对话模式)   │  │ (代理模式)   │  │    (规划模式)            │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                      AIProvider (Strategy Pattern)                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │ QWenProvider│  │OpenAIProvider│  │   Future Providers     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                    │                                      │
│                                    ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                      ToolRegistry (Agent Mode)                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │ FileTool    │  │ CommandTool │  │   LogTool               │   │   │
│  │  │ (文件操作)   │  │ (命令执行)   │  │   (日志分析)             │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模式切换流程

```
用户选择模式
    │
    ▼
ModeManager.setMode(mode)
    │
    ├── 保存当前模式状态
    │
    ├── 切换到新模式
    │
    ├── 更新 UI 显示
    │
    ▼
新模式就绪
```

## 3. 类型定义

### 3.1 模式类型

```typescript
type AIMode = 'chat' | 'agent' | 'plan';

interface ModeConfig {
    id: AIMode;
    name: string;
    icon: string;
    description: string;
    enabled: boolean;
}
```

### 3.2 消息类型扩展

```typescript
interface AIMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCalls?: ToolCall[];      // Agent 模式：工具调用
    toolCallId?: string;          // 工具调用 ID
    metadata?: MessageMetadata;   // 额外元数据
}

interface MessageMetadata {
    mode: AIMode;
    timestamp: number;
    status?: 'pending' | 'executing' | 'completed' | 'failed';
    planStep?: number;            // Plan 模式：当前步骤
}
```

### 3.3 工具定义（Agent 模式）

```typescript
interface ToolDefinition {
    name: string;
    description: string;
    parameters: JSONSchema;
    execute: (params: Record<string, any>) => Promise<ToolResult>;
}

interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}

interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
}
```

### 3.4 计划定义（Plan 模式）

```typescript
interface Plan {
    id: string;
    title: string;
    description: string;
    steps: PlanStep[];
    status: 'draft' | 'executing' | 'completed' | 'failed';
    createdAt: number;
}

interface PlanStep {
    id: string;
    order: number;
    description: string;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    result?: string;
    dependencies: string[];  // 依赖的步骤 ID
}

interface PlanExecutionResult {
    stepId: string;
    success: boolean;
    output: string;
    nextAction?: 'continue' | 'wait' | 'abort';
}
```

### 3.5 模式接口

```typescript
interface IAIMode {
    readonly id: AIMode;
    readonly name: string;
    
    initialize(): Promise<void>;
    handleMessage(message: string): Promise<AIResponse>;
    getSystemPrompt(): string;
    reset(): void;
    
    // 事件
    onProgress?: (progress: ModeProgress) => void;
    onToolCall?: (toolCall: ToolCall) => void;
    onPlanUpdate?: (plan: Plan) => void;
}

interface ModeProgress {
    status: 'thinking' | 'executing' | 'waiting';
    message: string;
    percentage?: number;
}
```

## 4. 模式详细设计

### 4.1 Chat 模式（对话模式）

**功能定位**：基础对话，问答交互

**特点**：
- 简单直接的用户-AI 对话
- 维护对话上下文
- 支持多轮对话

**系统提示词**：
```
你是一个专业的测试开发助手，帮助用户解答测试相关的问题。
你可以回答关于单元测试、集成测试、自动化测试等方面的问题。
请用简洁、专业的语言回答用户的问题。
```

**实现**：
```typescript
class ChatMode implements IAIMode {
    readonly id: AIMode = 'chat';
    readonly name: string = '对话';
    
    private messages: AIMessage[] = [];
    private provider: AIProvider;
    
    getSystemPrompt(): string {
        return `你是一个专业的测试开发助手...`;
    }
    
    async handleMessage(message: string): Promise<AIResponse> {
        this.messages.push({ role: 'user', content: message });
        
        const messagesWithSystem = [
            { role: 'system', content: this.getSystemPrompt() },
            ...this.messages
        ];
        
        const response = await this.provider.send(messagesWithSystem);
        
        if (response.content) {
            this.messages.push({ role: 'assistant', content: response.content });
        }
        
        return response;
    }
    
    reset(): void {
        this.messages = [];
    }
}
```

### 4.2 Agent 模式（代理模式）

**功能定位**：自主执行，工具调用

**特点**：
- AI 可以调用预定义的工具
- 自主决策执行步骤
- 支持多轮工具调用

**系统提示词**：
```
你是一个测试自动化代理，可以执行以下操作：
1. 读取和分析测试文件
2. 执行测试命令
3. 分析测试结果和日志
4. 生成测试报告

当需要执行操作时，请使用提供的工具。
每次只调用一个工具，等待结果后再决定下一步。
```

**可用工具**：

| 工具名称 | 描述 | 参数 |
|----------|------|------|
| readFile | 读取文件内容 | path: string |
| writeFile | 写入文件内容 | path: string, content: string |
| executeCommand | 执行命令 | command: string |
| analyzeLog | 分析日志文件 | logPath: string, pattern: string |
| uploadFile | 上传文件到服务器 | localPath: string |
| downloadLog | 下载日志文件 | remotePath: string |

**实现**：
```typescript
class AgentMode implements IAIMode {
    readonly id: AIMode = 'agent';
    readonly name: string = '代理';
    
    private tools: Map<string, ToolDefinition>;
    private conversationHistory: AIMessage[] = [];
    private maxToolCalls: number = 10;
    
    getSystemPrompt(): string {
        const toolDescriptions = Array.from(this.tools.values())
            .map(t => `- ${t.name}: ${t.description}`)
            .join('\n');
        
        return `你是一个测试自动化代理，可以使用以下工具：
${toolDescriptions}

当需要使用工具时，请按以下格式回复：
<tool_call name="工具名称">
{"参数名": "参数值"}
</tool_call}`;
    }
    
    async handleMessage(message: string): Promise<AIResponse> {
        this.conversationHistory.push({ role: 'user', content: message });
        
        let iterations = 0;
        let lastResponse: AIResponse = { content: '' };
        
        while (iterations < this.maxToolCalls) {
            const response = await this.provider.send([
                { role: 'system', content: this.getSystemPrompt() },
                ...this.conversationHistory
            ]);
            
            const toolCall = this.parseToolCall(response.content);
            
            if (!toolCall) {
                // 没有工具调用，返回最终响应
                this.conversationHistory.push({ 
                    role: 'assistant', 
                    content: response.content 
                });
                return response;
            }
            
            // 执行工具
            this.onToolCall?.(toolCall);
            const result = await this.executeTool(toolCall);
            
            // 添加工具调用和结果到历史
            this.conversationHistory.push(
                { role: 'assistant', content: response.content },
                { role: 'tool', content: result.output, toolCallId: toolCall.id }
            );
            
            iterations++;
        }
        
        return { content: '达到最大工具调用次数限制' };
    }
    
    private parseToolCall(content: string): ToolCall | null {
        // 解析工具调用
    }
    
    private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
        const tool = this.tools.get(toolCall.name);
        if (!tool) {
            return { success: false, output: '', error: '工具不存在' };
        }
        return tool.execute(toolCall.arguments);
    }
}
```

### 4.3 Plan 模式（规划模式）

**功能定位**：任务规划，分步执行

**特点**：
- AI 先制定执行计划
- 用户确认后逐步执行
- 支持暂停、继续、修改

**系统提示词**：
```
你是一个测试规划专家，帮助用户制定测试执行计划。
当用户描述一个任务时，请：
1. 分析任务目标
2. 分解为具体步骤
3. 确定步骤间的依赖关系
4. 生成可执行的计划

请使用以下格式输出计划：
<plan title="计划标题" description="计划描述">
<step id="1" description="步骤描述" dependencies=""/>
<step id="2" description="步骤描述" dependencies="1"/>
</plan>
```

**实现**：
```typescript
class PlanMode implements IAIMode {
    readonly id: AIMode = 'plan';
    readonly name: string = '规划';
    
    private currentPlan: Plan | null = null;
    private executionContext: Map<string, any> = new Map();
    
    getSystemPrompt(): string {
        return `你是一个测试规划专家...`;
    }
    
    async handleMessage(message: string): Promise<AIResponse> {
        if (!this.currentPlan) {
            // 生成计划
            const plan = await this.generatePlan(message);
            this.currentPlan = plan;
            this.onPlanUpdate?.(plan);
            
            return {
                content: this.formatPlanResponse(plan)
            };
        }
        
        // 执行或修改计划
        const action = this.parseUserAction(message);
        
        switch (action.type) {
            case 'execute':
                return this.executeNextStep();
            case 'modify':
                return this.modifyPlan(action.changes);
            case 'cancel':
                return this.cancelPlan();
        }
    }
    
    private async generatePlan(userGoal: string): Promise<Plan> {
        const response = await this.provider.send([
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: `请为以下目标制定执行计划：${userGoal}` }
        ]);
        
        return this.parsePlan(response.content);
    }
    
    private async executeNextStep(): Promise<AIResponse> {
        if (!this.currentPlan) {
            return { content: '没有活动计划' };
        }
        
        const nextStep = this.getNextPendingStep();
        if (!nextStep) {
            this.currentPlan.status = 'completed';
            this.onPlanUpdate?.(this.currentPlan);
            return { content: '计划已完成！' };
        }
        
        // 检查依赖
        if (!this.checkDependencies(nextStep)) {
            return { content: `步骤 ${nextStep.id} 的依赖未完成` };
        }
        
        nextStep.status = 'executing';
        this.onPlanUpdate?.(this.currentPlan);
        
        // 执行步骤
        const result = await this.executeStep(nextStep);
        
        nextStep.status = result.success ? 'completed' : 'failed';
        nextStep.result = result.output;
        this.onPlanUpdate?.(this.currentPlan);
        
        return {
            content: `步骤 ${nextStep.id} ${result.success ? '完成' : '失败'}：\n${result.output}`
        };
    }
}
```

## 5. UI 设计

### 5.1 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌────────────────────────────────────────┐  │
│  │  模式选择 │  │              对话区域                   │  │
│  │          │  │                                        │  │
│  │  💬 对话  │  │  ┌──────────────────────────────────┐ │  │
│  │  🤖 代理  │  │  │ 用户: 帮我分析测试结果            │ │  │
│  │  📋 规划  │  │  └──────────────────────────────────┘ │  │
│  │          │  │                                        │  │
│  │          │  │  ┌──────────────────────────────────┐ │  │
│  │          │  │  │ AI: 好的，我来分析...             │ │  │
│  │          │  │  └──────────────────────────────────┘ │  │
│  │          │  │                                        │  │
│  │          │  ├────────────────────────────────────────┤  │
│  │          │  │  [输入消息...              ] [发送]    │  │
│  └──────────┘  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 模式选择器样式

```css
.mode-selector {
    width: 48px;
    background: var(--vscode-sideBarSectionHeader-background);
    border-right: 1px solid var(--vscode-sideBar-border);
    display: flex;
    flex-direction: column;
    padding: 8px 0;
}

.mode-item {
    width: 48px;
    height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
}

.mode-item:hover {
    opacity: 0.8;
    background: var(--vscode-list-hoverBackground);
}

.mode-item.active {
    opacity: 1;
    background: var(--vscode-list-activeSelectionBackground);
    border-left: 2px solid var(--vscode-focusBorder);
}

.mode-icon {
    font-size: 18px;
    margin-bottom: 2px;
}

.mode-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
}
```

### 5.3 Agent 模式特殊 UI

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 代理模式                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户: 帮我运行测试并分析结果                                │
│                                                             │
│  AI: 好的，我来执行以下操作：                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔧 工具调用: uploadFile                              │   │
│  │ 参数: { "localPath": "tests/test_example.py" }      │   │
│  │ 状态: ✅ 完成                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔧 工具调用: executeCommand                          │   │
│  │ 参数: { "command": "pytest {filePath}" }            │   │
│  │ 状态: ⏳ 执行中...                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Plan 模式特殊 UI

```
┌─────────────────────────────────────────────────────────────┐
│  📋 规划模式                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  计划: 运行测试并生成报告                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 步骤 1: 上传测试文件                          ✅ 完成 │   │
│  │ 步骤 2: 执行测试命令                          ⏳ 执行中│   │
│  │ 步骤 3: 分析测试结果                          ⏸ 等待  │   │
│  │ 步骤 4: 生成测试报告                          ⏸ 等待  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [▶ 继续执行] [⏸ 暂停] [🔄 重新规划]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 6. 配置扩展

### 6.1 AI 配置更新

```typescript
interface AIConfig {
    provider: 'qwen' | 'openai';
    defaultMode: AIMode;           // 新增：默认模式
    agent: AgentConfig;            // 新增：Agent 配置
    plan: PlanConfig;              // 新增：Plan 配置
    qwen: QWenConfig;
    openai: OpenAIConfig;
}

interface AgentConfig {
    enabled: boolean;
    maxToolCalls: number;          // 最大工具调用次数
    allowedTools: string[];        // 允许使用的工具
    autoExecute: boolean;          // 是否自动执行
}

interface PlanConfig {
    enabled: boolean;
    requireConfirmation: boolean;  // 是否需要用户确认
    autoExecuteSteps: boolean;     // 是否自动执行步骤
}
```

### 6.2 配置示例

```json
{
    "ai": {
        "provider": "qwen",
        "defaultMode": "chat",
        "agent": {
            "enabled": true,
            "maxToolCalls": 10,
            "allowedTools": ["readFile", "executeCommand", "analyzeLog"],
            "autoExecute": false
        },
        "plan": {
            "enabled": true,
            "requireConfirmation": true,
            "autoExecuteSteps": false
        },
        "qwen": {
            "apiKey": "your-api-key",
            "apiUrl": "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
            "model": "qwen-turbo"
        },
        "openai": {
            "apiKey": "",
            "apiUrl": "https://api.openai.com/v1/chat/completions",
            "model": "gpt-3.5-turbo"
        }
    }
}
```

## 7. 文件结构

```
src/ai/
├── index.ts                 # 导出入口
├── chat.ts                  # AIChat 类（保留向后兼容）
├── providers.ts             # AI 提供商实现
├── modes/                   # 模式实现
│   ├── index.ts             # 模式管理器
│   ├── chatMode.ts          # Chat 模式
│   ├── agentMode.ts         # Agent 模式
│   └── planMode.ts          # Plan 模式
├── tools/                   # Agent 工具
│   ├── index.ts             # 工具注册表
│   ├── fileTool.ts          # 文件操作工具
│   ├── commandTool.ts       # 命令执行工具
│   └── logTool.ts           # 日志分析工具
└── types.ts                 # 类型定义

src/views/
├── aiChatView.ts            # 主视图（更新）
└── components/              # UI 组件
    ├── modeSelector.ts      # 模式选择器
    ├── messageList.ts       # 消息列表
    ├── toolCallDisplay.ts   # 工具调用显示
    └── planDisplay.ts       # 计划显示
```

## 8. 实现计划

### Phase 1: 基础架构（当前）
- [x] 设计多模式架构
- [ ] 实现模式接口和基础类
- [ ] 更新 UI 支持模式选择
- [ ] 保持 Chat 模式向后兼容

### Phase 2: Agent 模式
- [ ] 实现工具注册机制
- [ ] 开发核心工具（文件、命令、日志）
- [ ] 实现工具调用解析和执行
- [ ] 添加工具调用 UI 显示

### Phase 3: Plan 模式
- [ ] 实现计划生成和解析
- [ ] 实现步骤执行引擎
- [ ] 添加计划管理 UI
- [ ] 支持计划修改和重试

### Phase 4: 优化和扩展
- [ ] 添加更多工具
- [ ] 优化提示词
- [ ] 添加执行历史
- [ ] 支持模式间切换保持上下文

## 9. 扩展点

### 9.1 添加新模式

```typescript
class CustomMode implements IAIMode {
    readonly id: AIMode = 'custom';
    readonly name: string = '自定义';
    
    // 实现接口方法
}

// 注册模式
modeManager.registerMode(new CustomMode());
```

### 9.2 添加新工具

```typescript
const customTool: ToolDefinition = {
    name: 'customAction',
    description: '自定义工具描述',
    parameters: {
        type: 'object',
        properties: {
            param1: { type: 'string', description: '参数描述' }
        }
    },
    execute: async (params) => {
        // 实现工具逻辑
        return { success: true, output: '结果' };
    }
};

toolRegistry.register(customTool);
```

## 10. 安全考虑

### 10.1 Agent 模式安全

- 工具执行需要用户确认（可配置）
- 限制可访问的文件路径
- 限制可执行的命令
- 设置工具调用次数上限

### 10.2 Plan 模式安全

- 计划执行前需要用户确认
- 每个步骤可单独暂停
- 支持随时取消计划
- 敏感操作需要额外确认

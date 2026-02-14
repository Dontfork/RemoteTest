# AutoTest 插件功能文档

## 1. 功能概览

AutoTest 插件提供以下核心功能：

| 功能 | 描述 | 入口 |
|------|------|------|
| AI 对话 | 与 AI 助手进行对话交流 | 活动栏 AutoTest AI 图标 |
| 日志监控 | 查看和下载服务器日志 | 资源管理器 - 日志监控 |
| 文件上传 | 上传文件并执行命令 | 命令面板 (Ctrl+Shift+P) |

## 2. AI 对话功能

### 2.1 功能说明

AI 对话功能允许用户与 AI 助手进行自然语言交互，支持多种 AI 提供商和模型选择。

### 2.2 使用方法

1. 点击 VSCode 左侧活动栏的 AutoTest AI 图标
2. 在输入框中输入消息
3. 按 Enter 或点击发送按钮
4. 等待 AI 响应

### 2.3 配置要求

在 `.vscode/autotest-config.json` 中配置 AI 服务：

```json
{
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
  }
}
```

### 2.4 支持的 AI 提供商和模型

#### QWen (通义千问)

| 模型 | 说明 | 适用场景 |
|------|------|----------|
| qwen-turbo | 快速响应模型 | 日常对话、快速问答 |
| qwen-plus | 增强模型 | 复杂任务、代码生成 |
| qwen-max | 最强模型 | 高质量输出、复杂推理 |
| qwen-max-longcontext | 长上下文模型 | 长文档处理 |

#### OpenAI

| 模型 | 说明 | 适用场景 |
|------|------|----------|
| gpt-3.5-turbo | 快速响应模型 | 日常对话、快速问答 |
| gpt-3.5-turbo-16k | 长上下文模型 | 中等长度文档 |
| gpt-4 | 高级模型 | 复杂推理、代码生成 |
| gpt-4-32k | 超长上下文模型 | 长文档处理 |
| gpt-4-turbo | 最新模型 | 最新功能支持 |

### 2.5 模型选择说明

- **默认模型**: 如果未配置 `model` 字段，系统将使用默认模型
  - QWen 默认: `qwen-turbo`
  - OpenAI 默认: `gpt-3.5-turbo`
- **自定义模型**: 在配置文件中设置 `model` 字段即可使用指定模型

### 2.6 界面说明

```
┌─────────────────────────────┐
│                             │
│         💬 开始对话          │  ← 欢迎提示
│                             │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │  ← 用户消息
│  │ 你好                 │    │    (右对齐)
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │  ← AI 响应
│  │ 你好！有什么可以帮你的 │    │    (左对齐)
│  └─────────────────────┘    │
│                             │
├─────────────────────────────┤
│ 输入消息...            [➤] │  ← 输入区域
└─────────────────────────────┘
```

## 3. 日志监控功能

### 3.1 功能说明

日志监控功能允许用户查看远程服务器上的日志文件列表，并下载到本地进行分析。

### 3.2 使用方法

1. 打开 VSCode 资源管理器
2. 找到"日志监控"面板（位于文件、大纲、时间线下方）
3. 查看日志文件列表
4. 点击日志文件进行下载

### 3.3 配置要求

```json
{
  "logs": {
    "monitorDirectory": "/var/logs",
    "downloadPath": "./downloads",
    "refreshInterval": 5000
  },
  "server": {
    "host": "192.168.1.100",
    "executeCommand": "http://192.168.1.100:8080/execute"
  }
}
```

### 3.4 日志列表显示

```
日志监控                    [↻]
├── app.log        1.2 MB | 2024/1/15 10:30:00
├── error.log      256 KB | 2024/1/15 09:15:00
├── debug.log      3.5 MB | 2024/1/14 18:45:00
└── access.log     512 KB | 2024/1/15 11:00:00
```

### 3.5 操作说明

| 操作 | 说明 |
|------|------|
| 点击刷新按钮 | 重新获取日志列表 |
| 点击日志文件 | 下载到本地 |
| 悬停查看 | 显示完整路径 |

## 4. 文件上传与命令执行

### 4.1 功能说明

上传文件到服务器，并自动执行配置的命令。

### 4.2 使用方法

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 `AutoTest: 上传文件并执行命令`
3. 选择要上传的文件
4. 等待上传完成
5. 命令自动执行，输出显示在 OutputChannel

### 4.3 配置要求

```json
{
  "server": {
    "uploadUrl": "http://192.168.1.100:8080/upload"
  },
  "command": {
    "executeCommand": "python run_test.py",
    "filterPatterns": ["\\[error\\]", "\\[fail\\]"],
    "filterMode": "include"
  }
}
```

### 4.4 输出过滤

命令执行支持输出过滤：

| 过滤模式 | 说明 |
|----------|------|
| include | 只显示匹配的行 |
| exclude | 排除匹配的行 |

过滤使用正则表达式匹配。

### 4.5 执行流程

```
选择文件
    │
    ▼
上传到 server.uploadUrl
    │
    ▼
执行 command.executeCommand
    │
    ▼
过滤输出 (可选)
    │
    ▼
显示到 "autoTest" OutputChannel
```

## 5. 配置文件说明

### 5.1 配置文件位置

```
{workspace}/.vscode/autotest-config.json
```

### 5.2 配置动态刷新

插件支持配置文件的动态刷新，无需重启插件：

**自动刷新**：
- 修改配置文件后，插件会自动检测并刷新配置
- 刷新成功后会显示提示消息

**手动刷新**：
- 在日志监控视图工具栏点击刷新配置按钮 (🔄)
- 或使用命令面板执行 `AutoTest: 刷新配置`

**打开配置文件**：
- 在日志监控视图工具栏点击打开配置按钮 (⚙️)
- 或使用命令面板执行 `AutoTest: 打开配置文件`

### 5.3 完整配置示例

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
    "executeCommand": "echo 'Hello World'",
    "filterPatterns": [],
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

### 5.4 配置项说明

#### server 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| host | string | 服务器地址 |
| port | number | SSH 端口 |
| username | string | 用户名 |
| password | string | 密码 |
| uploadUrl | string | 文件上传 URL |
| executeCommand | string | 命令执行 API |
| logDirectory | string | 日志目录 |
| downloadPath | string | 下载路径 |

#### command 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| executeCommand | string | 要执行的命令 |
| filterPatterns | string[] | 过滤正则表达式数组 |
| filterMode | string | 过滤模式: include/exclude |

#### ai 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| provider | string | AI 提供商: qwen/openai |
| qwen.apiKey | string | QWen API Key |
| qwen.apiUrl | string | QWen API URL |
| qwen.model | string | QWen 模型名称 (默认: qwen-turbo) |
| openai.apiKey | string | OpenAI API Key |
| openai.apiUrl | string | OpenAI API URL |
| openai.model | string | OpenAI 模型名称 (默认: gpt-3.5-turbo) |

#### logs 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| monitorDirectory | string | 监控的日志目录 |
| downloadPath | string | 本地下载路径 |
| refreshInterval | number | 刷新间隔(毫秒) |

## 6. 快捷键

| 操作 | 快捷键 |
|------|--------|
| 打开命令面板 | Ctrl+Shift+P |
| 发送消息 | Enter |

## 7. 故障排除

### 7.1 AI 对话无响应

- 检查 API Key 是否配置
- 检查模型名称是否正确
- 检查网络连接
- 查看 VSCode 开发者控制台错误信息

### 7.2 日志列表为空

- 检查服务器连接配置
- 检查日志目录是否存在
- 检查 API 端点是否可用

### 7.3 文件上传失败

- 检查 uploadUrl 是否正确
- 检查服务器是否运行
- 检查文件大小限制

## 8. 未来规划

### 8.1 Agent 模式

计划支持 AI Agent 模式，允许 AI 自动执行任务：
- 自动分析日志
- 自动执行测试
- 自动生成报告

### 8.2 更多 AI 提供商

计划支持更多 AI 服务：
- Claude
- 本地模型
- 自定义 API

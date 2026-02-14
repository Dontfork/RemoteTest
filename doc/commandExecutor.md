# 命令执行模块 (CommandExecutor Module)

## 1. 模块概述

命令执行模块负责通过 SSH 在远程服务器上执行命令，捕获输出并进行过滤处理。模块支持命令变量替换，允许在命令中使用文件路径等变量，实现灵活的测试执行配置。模块使用 VSCode 的 OutputChannel 显示执行过程，支持正则表达式过滤输出内容。

## 2. 设计方案

### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                   CommandExecutor Module                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              replaceVariables()                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │    │
│  │  │ 原始命令  │→│ 变量替换  │→│ 替换后命令        │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   execute()                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │    │
│  │  │ SSH连接   │→│ 执行命令  │→│ 过滤输出          │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              OutputChannel (AutoTest)                │    │
│  │  [变量替换] 原始命令: pytest {filePath}               │    │
│  │  [变量替换] 替换后: pytest /tmp/test.py               │    │
│  │  [SSH连接] root@192.168.1.100:22                     │    │
│  │  ─────────────────────────────────────────           │    │
│  │  ... 输出内容 ...                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 执行流程

```
用户触发命令
    │
    ▼
构建命令变量 (buildCommandVariables)
    │
    ├── filePath: 远程文件完整路径
    ├── fileName: 远程文件名
    ├── fileDir: 远程文件所在目录
    ├── localPath: 本地文件完整路径
    ├── localDir: 本地文件所在目录
    ├── localFileName: 本地文件名
    └── remoteDir: 远程工程目录
    │
    ▼
变量替换 (replaceCommandVariables)
    │
    ├── 替换 {filePath}
    ├── 替换 {fileName}
    ├── 替换 {fileDir}
    ├── 替换 {localPath}
    ├── 替换 {localDir}
    ├── 替换 {localFileName}
    └── 替换 {remoteDir}
    │
    ▼
execute(command, filterConfig)
    │
    ├── 获取 SSH 配置
    │
    ├── 建立 SSH 连接
    │
    ├── 执行替换后的命令
    │
    ├── 捕获 stdout/stderr
    │
    ├── 过滤输出
    │
    ▼
返回过滤后的输出
```

### 2.3 SSH 连接机制

```
SSH 连接建立
    │
    ├── 检查 privateKeyPath 配置
    │   ├── 存在 → 读取私钥文件
    │   │          └── 使用私钥认证
    │   └── 不存在 → 使用 password 认证
    │
    ├── 建立 SSH 连接
    │
    ├── 创建 Shell 会话
    │
    └── 执行命令
```

### 2.4 过滤机制

```
原始输出
    │
    ▼
按行分割
    │
    ▼
遍历每一行
    │
    ├── 匹配正则表达式数组
    │
    ├── include 模式: 保留匹配行
    │   exclude 模式: 排除匹配行
    │
    ▼
合并过滤后的行
```

## 3. 类型定义

### 3.1 命令配置接口

```typescript
interface CommandConfig {
    executeCommand: string;              // 要执行的命令（支持变量）
    filterPatterns: string[];            // 过滤正则表达式数组
    filterMode: 'include' | 'exclude';   // 过滤模式
}
```

### 3.2 命令变量接口

```typescript
interface CommandVariables {
    filePath: string;       // 远程文件完整路径
    fileName: string;       // 远程文件名
    fileDir: string;        // 远程文件所在目录
    localPath: string;      // 本地文件完整路径
    localDir: string;       // 本地文件所在目录
    localFileName: string;  // 本地文件名
    remoteDir: string;      // 远程工程目录
}
```

### 3.3 支持的变量

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `{filePath}` | 远程文件完整路径 | `/tmp/autotest/tests/test_example.py` |
| `{fileName}` | 远程文件名 | `test_example.py` |
| `{fileDir}` | 远程文件所在目录 | `/tmp/autotest/tests` |
| `{localPath}` | 本地文件完整路径 | `D:\project\tests\test_example.py` |
| `{localDir}` | 本地文件所在目录 | `D:\project\tests` |
| `{localFileName}` | 本地文件名 | `test_example.py` |
| `{remoteDir}` | 远程工程目录 | `/tmp/autotest` |

### 3.4 过滤模式说明

| 模式 | 行为 | 使用场景 |
|------|------|----------|
| include | 只保留匹配正则的行 | 只查看错误和警告信息 |
| exclude | 排除匹配正则的行 | 过滤掉调试信息 |

## 4. 功能实现

### 4.1 类结构

```typescript
export class CommandExecutor {
    private terminalName = 'AutoTest';
    private outputChannel: vscode.OutputChannel;
    
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(this.terminalName);
    }
    
    // 变量替换
    replaceVariables(command: string, variables: CommandVariables): string;
    
    // 核心方法
    async execute(command: string, filterConfig?: Partial<CommandConfig>): Promise<string>;
    async executeWithConfig(variables?: CommandVariables): Promise<string>;
    
    // 输出控制
    showOutput(): void;
    clearOutput(): void;
    dispose(): void;
    
    // 私有方法
    private filterOutput(output: string, patterns: string[], filterMode: 'include' | 'exclude'): string;
}

// 导出函数
export function replaceCommandVariables(command: string, variables: CommandVariables): string;
export function buildCommandVariables(localFilePath: string, remoteFilePath: string, remoteDir: string): CommandVariables;
```

### 4.2 变量替换方法

#### replaceVariables(command: string, variables: CommandVariables): string

替换命令中的变量。

**参数**：
- `command`: 包含变量的命令字符串
- `variables`: 变量对象

**返回值**：
- `string`: 替换后的命令

**实现逻辑**：
```typescript
replaceVariables(command: string, variables: CommandVariables): string {
    let result = command;
    
    result = result.replace(/{filePath}/g, variables.filePath);
    result = result.replace(/{fileName}/g, variables.fileName);
    result = result.replace(/{fileDir}/g, variables.fileDir);
    result = result.replace(/{localPath}/g, variables.localPath);
    result = result.replace(/{localDir}/g, variables.localDir);
    result = result.replace(/{localFileName}/g, variables.localFileName);
    result = result.replace(/{remoteDir}/g, variables.remoteDir);
    
    return result;
}
```

#### buildCommandVariables(localFilePath: string, remoteFilePath: string, remoteDir: string): CommandVariables

构建命令变量对象。

**参数**：
- `localFilePath`: 本地文件路径
- `remoteFilePath`: 远程文件路径
- `remoteDir`: 远程工程目录

**返回值**：
- `CommandVariables`: 变量对象

**实现逻辑**：
```typescript
export function buildCommandVariables(
    localFilePath: string,
    remoteFilePath: string,
    remoteDir: string
): CommandVariables {
    const localDir = path.dirname(localFilePath);
    const localFileName = path.basename(localFilePath);
    const remoteFileDir = path.posix.dirname(remoteFilePath);
    
    return {
        filePath: remoteFilePath,
        fileName: path.posix.basename(remoteFilePath),
        fileDir: remoteFileDir,
        localPath: localFilePath,
        localDir: localDir,
        localFileName: localFileName,
        remoteDir: remoteDir
    };
}
```

### 4.3 核心方法

#### execute(command: string, filterConfig?: Partial<CommandConfig>): Promise<string>

执行指定命令并返回过滤后的输出。

**参数**：
- `command`: 要执行的命令字符串
- `filterConfig`: 可选的过滤配置，可覆盖默认配置

**返回值**：
- `Promise<string>`: 过滤后的输出内容

#### executeWithConfig(variables?: CommandVariables): Promise<string>

使用配置文件中的命令执行，支持变量替换。

**参数**：
- `variables`: 可选的变量对象，用于替换命令中的变量

**返回值**：
- `Promise<string>`: 过滤后的输出内容

**实现**：
```typescript
async executeWithConfig(variables?: CommandVariables): Promise<string> {
    const config = getConfig();
    let command = config.command.executeCommand;
    
    if (variables) {
        command = this.replaceVariables(command, variables);
        this.outputChannel.appendLine(`[变量替换] 原始命令: ${config.command.executeCommand}`);
        this.outputChannel.appendLine(`[变量替换] 替换后: ${command}`);
    }
    
    return this.execute(command);
}
```

### 4.4 过滤方法

#### filterOutput(output: string, patterns: string[], filterMode: 'include' | 'exclude'): string

过滤输出内容。

**参数**：
- `output`: 原始输出字符串
- `patterns`: 正则表达式数组
- `filterMode`: 过滤模式

**返回值**：
- `string`: 过滤后的输出

## 5. 使用示例

### 5.1 基本使用

```typescript
import { CommandExecutor } from './core/commandExecutor';

const executor = new CommandExecutor();

// 执行简单命令
const output = await executor.execute('npm test');
console.log('Filtered output:', output);

// 显示输出面板
executor.showOutput();
```

### 5.2 使用变量替换执行测试

```typescript
import { CommandExecutor, buildCommandVariables } from './core/commandExecutor';

const executor = new CommandExecutor();

// 本地文件: D:\project\tests\test_example.py
// 远程文件: /tmp/autotest/tests/test_example.py
const variables = buildCommandVariables(
    'D:\\project\\tests\\test_example.py',
    '/tmp/autotest/tests/test_example.py',
    '/tmp/autotest'
);

// 配置命令: pytest {filePath} -v
// 替换后: pytest /tmp/autotest/tests/test_example.py -v
const output = await executor.executeWithConfig(variables);
```

### 5.3 配置文件示例

```json
{
    "command": {
        "executeCommand": "pytest {filePath} -v --tb=short",
        "filterPatterns": ["PASSED", "FAILED", "ERROR"],
        "filterMode": "include"
    }
}
```

### 5.4 常用命令配置示例

**Python pytest**:
```json
{
    "executeCommand": "cd {remoteDir} && pytest {filePath} -v",
    "filterPatterns": ["PASSED", "FAILED", "ERROR"],
    "filterMode": "include"
}
```

**JavaScript Jest**:
```json
{
    "executeCommand": "cd {remoteDir} && npx jest {filePath} --coverage=false",
    "filterPatterns": ["PASS", "FAIL", "✓", "✕"],
    "filterMode": "include"
}
```

**Java Maven**:
```json
{
    "executeCommand": "cd {remoteDir} && mvn test -Dtest={fileName}",
    "filterPatterns": ["Tests run:", "FAILURE", "ERROR"],
    "filterMode": "include"
}
```

**Go test**:
```json
{
    "executeCommand": "cd {fileDir} && go test -v",
    "filterPatterns": ["PASS", "FAIL", "=== RUN"],
    "filterMode": "include"
}
```

### 5.5 使用自定义过滤配置

```typescript
const executor = new CommandExecutor();

// 只显示包含 error 或 fail 的行
const output = await executor.execute('npm run build', {
    filterPatterns: ['error', 'fail', 'FAILED'],
    filterMode: 'include'
});
```

### 5.6 排除调试信息

```typescript
const executor = new CommandExecutor();

// 排除包含 [debug] 的行
const output = await executor.execute('npm run dev', {
    filterPatterns: ['\\[debug\\]', '\\[trace\\]'],
    filterMode: 'exclude'
});
```

## 6. OutputChannel 输出格式

```
[变量替换] 原始命令: pytest {filePath} -v
[变量替换] 替换后: pytest /tmp/autotest/tests/test_example.py -v
[SSH连接] root@192.168.1.100:22
──────────────────────────────────────────────────
============================= test session starts ==============================
collected 3 items

test_example.py::test_add PASSED
test_example.py::test_subtract PASSED
test_example.py::test_multiply FAILED

============================= 2 passed, 1 failed in 0.05s ======================
──────────────────────────────────────────────────
[执行完成] 退出码: 0
```

## 7. 平台兼容性

| 平台 | Shell | 参数格式 |
|------|-------|----------|
| Windows | powershell.exe | `-Command "命令"` |
| Linux/macOS | bash | `-c "命令"` |

## 8. 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 命令不存在 | 进程返回非零退出码，输出错误信息 |
| 正则表达式无效 | 忽略该正则，继续处理其他正则 |
| 工作目录不存在 | 使用当前进程目录 |
| 进程启动失败 | 触发 error 事件，Promise reject |
| SSH 连接失败 | 显示错误消息，记录日志 |

## 9. 性能考虑

- 使用 spawn 而非 exec，支持流式输出
- 实时输出到 OutputChannel，避免内存堆积
- 正则匹配使用不区分大小写模式 (`'i'` 标志)
- 变量替换使用全局替换 (`/g` 标志)

## 10. 测试覆盖

命令执行模块测试覆盖以下场景：

- 变量替换功能测试
  - 单变量替换
  - 多变量替换
  - 重复变量替换
  - 无变量命令处理
- 构建命令变量测试
  - 路径提取
  - 目录层级处理
- 输出过滤功能测试
- include/exclude 模式测试
- 正则表达式匹配测试

详见测试文件：`test/suite/commandExecutor.test.ts`

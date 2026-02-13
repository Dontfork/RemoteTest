# 命令执行模块 (CommandExecutor Module)

## 1. 模块概述

命令执行模块负责在本地终端执行命令，捕获输出并进行过滤处理。模块使用 VSCode 的 OutputChannel 显示执行过程，支持正则表达式过滤输出内容。

## 2. 设计方案

### 2.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                   CommandExecutor Module                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   execute()                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │    │
│  │  │ 创建进程  │→│ 捕获输出  │→│ 过滤输出          │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              OutputChannel (AutoTest)                │    │
│  │  [执行命令] npm test                                  │    │
│  │  [工作目录] /path/to/workspace                        │    │
│  │  ─────────────────────────────────────────           │    │
│  │  ... 输出内容 ...                                     │    │
│  │  ─────────────────────────────────────────           │    │
│  │  [执行完成] 退出码: 0                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 执行流程

```
用户触发命令
    │
    ▼
execute(command, filterConfig)
    │
    ├── 获取配置
    │
    ├── 确定工作目录
    │
    ├── 选择 Shell (Windows: PowerShell, Unix: Bash)
    │
    ├── 创建子进程
    │
    ├── 捕获 stdout/stderr
    │
    ├── 实时输出到 OutputChannel
    │
    ├── 进程结束
    │
    ├── 过滤输出
    │
    ▼
返回过滤后的输出
```

### 2.3 过滤机制

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
    executeCommand: string;              // 要执行的命令
    filterPatterns: string[];            // 过滤正则表达式数组
    filterMode: 'include' | 'exclude';   // 过滤模式
}
```

### 3.2 过滤模式说明

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
    
    // 核心方法
    async execute(command: string, filterConfig?: Partial<CommandConfig>): Promise<string>;
    async executeWithConfig(): Promise<string>;
    
    // 输出控制
    showOutput(): void;
    clearOutput(): void;
    dispose(): void;
    
    // 私有方法
    private filterOutput(output: string, patterns: string[], filterMode: 'include' | 'exclude'): string;
}
```

### 4.2 核心方法

#### execute(command: string, filterConfig?: Partial<CommandConfig>): Promise<string>

执行指定命令并返回过滤后的输出。

**参数**：
- `command`: 要执行的命令字符串
- `filterConfig`: 可选的过滤配置，可覆盖默认配置

**返回值**：
- `Promise<string>`: 过滤后的输出内容

**实现细节**：

```typescript
async execute(command: string, filterConfig?: Partial<CommandConfig>): Promise<string> {
    const config = getConfig();
    const { filterPatterns = [], filterMode = 'include' } = filterConfig || config.command;

    return new Promise((resolve, reject) => {
        // 1. 确定工作目录
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath || process.cwd();
        
        // 2. 根据平台选择 Shell
        const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
        const shellArgs = process.platform === 'win32' 
            ? ['-Command', command] 
            : ['-c', command];

        // 3. 输出执行信息
        this.outputChannel.appendLine(`\n[执行命令] ${command}`);
        this.outputChannel.appendLine(`[工作目录] ${workspacePath}`);
        this.outputChannel.appendLine('─'.repeat(50));

        // 4. 创建子进程
        const proc = child_process.spawn(shell, shellArgs, { cwd: workspacePath });

        let rawOutput = '';

        // 5. 捕获标准输出
        proc.stdout?.on('data', (data: Buffer) => {
            const text = data.toString();
            rawOutput += text;
            this.outputChannel.append(text);
        });

        // 6. 捕获错误输出
        proc.stderr?.on('data', (data: Buffer) => {
            const text = data.toString();
            rawOutput += text;
            this.outputChannel.append(text);
        });

        // 7. 进程结束处理
        proc.on('close', (code: number | null) => {
            this.outputChannel.appendLine('\n' + '─'.repeat(50));
            this.outputChannel.appendLine(`[执行完成] 退出码: ${code}`);
            this.outputChannel.show();

            const filteredOutput = this.filterOutput(rawOutput, filterPatterns, filterMode);
            resolve(filteredOutput);
        });

        // 8. 错误处理
        proc.on('error', (err: Error) => {
            this.outputChannel.appendLine(`[执行错误] ${err.message}`);
            reject(err);
        });
    });
}
```

#### executeWithConfig(): Promise<string>

使用配置文件中的命令执行。

**返回值**：
- `Promise<string>`: 过滤后的输出内容

**实现**：
```typescript
async executeWithConfig(): Promise<string> {
    const config = getConfig();
    return this.execute(config.command.executeCommand);
}
```

### 4.3 过滤方法

#### filterOutput(output: string, patterns: string[], filterMode: 'include' | 'exclude'): string

过滤输出内容。

**参数**：
- `output`: 原始输出字符串
- `patterns`: 正则表达式数组
- `filterMode`: 过滤模式

**返回值**：
- `string`: 过滤后的输出

**实现逻辑**：
```typescript
private filterOutput(output: string, patterns: string[], filterMode: 'include' | 'exclude'): string {
    // 1. 无过滤模式，直接返回原输出
    if (!patterns || patterns.length === 0) {
        return output;
    }

    // 2. 按行分割
    const lines = output.split('\n');
    const filteredLines: string[] = [];

    // 3. 遍历每一行
    for (const line of lines) {
        // 检查是否匹配任一正则
        const matchesPattern = patterns.some(pattern => {
            try {
                const regex = new RegExp(pattern, 'i');
                return regex.test(line);
            } catch {
                return false;  // 正则无效时忽略
            }
        });

        // 4. 根据模式决定是否保留
        if (filterMode === 'include') {
            if (matchesPattern) {
                filteredLines.push(line);
            }
        } else {
            if (!matchesPattern) {
                filteredLines.push(line);
            }
        }
    }

    return filteredLines.join('\n');
}
```

### 4.4 输出控制方法

```typescript
// 显示输出面板
showOutput(): void {
    this.outputChannel.show();
}

// 清空输出内容
clearOutput(): void {
    this.outputChannel.clear();
}

// 释放资源
dispose(): void {
    this.outputChannel.dispose();
}
```

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

### 5.2 使用自定义过滤配置

```typescript
const executor = new CommandExecutor();

// 只显示包含 error 或 fail 的行
const output = await executor.execute('npm run build', {
    filterPatterns: ['error', 'fail', 'FAILED'],
    filterMode: 'include'
});
```

### 5.3 使用配置文件执行

```typescript
const executor = new CommandExecutor();

// 使用 autotest-config.json 中的命令配置
const output = await executor.executeWithConfig();
```

### 5.4 排除调试信息

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
[执行命令] npm test
[工作目录] D:\MyProject
──────────────────────────────────────────────────
> myproject@1.0.0 test
> jest

PASS src/utils.test.js
  ✓ should pass (5ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
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

## 9. 性能考虑

- 使用 spawn 而非 exec，支持流式输出
- 实时输出到 OutputChannel，避免内存堆积
- 正则匹配使用不区分大小写模式 (`'i'` 标志)

## 10. 测试覆盖

命令执行模块测试覆盖以下场景：

- 输出过滤功能测试
- include/exclude 模式测试
- 正则表达式匹配测试
- 多模式组合测试
- 边界情况测试

详见测试文件：`test/suite/commandExecutor.test.ts`

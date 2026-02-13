# AutoTest 开发流程文档

## 概述

本文档定义了 AutoTest 项目的标准开发流程。**所有功能开发必须严格遵循此流程**，确保代码质量和可维护性。

## 核心原则

1. **设计先行**: 任何代码修改前必须先更新设计文档
2. **文档同步**: 功能文档与代码必须保持一致
3. **测试驱动**: 所有修改必须有对应的测试用例
4. **验证通过**: 提交前必须通过所有测试

## 开发流程

### 完整开发流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                      功能开发流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ 1.分析   │───▶│ 2.设计   │───▶│ 3.编码   │───▶│ 4.测试   │  │
│  │   需求   │    │   文档   │    │   实现   │    │   验证   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │               │               │               │         │
│       ▼               ▼               ▼               ▼         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ 理解需求 │    │ 更新设计 │    │ 修改代码 │    │ 运行测试 │  │
│  │ 分析影响 │    │ 更新功能 │    │ 实现功能 │    │ 确保通过 │  │
│  │ 确定范围 │    │ 文档     │    │          │    │          │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 步骤详解

#### 第一步：需求分析

**目标**: 充分理解需求，确定修改范围

**检查清单**:
- [ ] 理解用户的具体需求
- [ ] 分析需求涉及的模块
- [ ] 确定需要修改的文件列表
- [ ] 评估对现有功能的影响

**输出**:
- 需求理解文档（可在对话中确认）
- 受影响的模块列表
- 预估的修改范围

#### 第二步：更新设计文档

**目标**: 在编码前完成设计，确保思路清晰

**必须更新的文档**:

| 修改类型 | 需要更新的文档 |
|----------|----------------|
| 新增配置项 | `doc/config.md`, `doc/Design.md` |
| 修改核心逻辑 | 对应模块文档 (如 `doc/ai.md`) |
| 新增功能 | `doc/Design.md`, `doc/FUNCTIONS.md`, 对应模块文档 |
| 修改接口 | `doc/Design.md`, 相关模块文档 |
| 修改 UI | `doc/Design.md`, `doc/FUNCTIONS.md` |

**文档更新顺序**:
1. `doc/Design.md` - 更新总览和配置结构
2. 对应模块文档 - 详细设计方案
3. `doc/FUNCTIONS.md` - 用户使用说明
4. `README.md` - 如有重大变更

**检查清单**:
- [ ] 设计文档已更新
- [ ] 功能文档已更新
- [ ] 配置示例已更新
- [ ] 类型定义已更新（如涉及）

#### 第三步：代码实现

**目标**: 按照设计文档实现功能

**实现顺序**:
1. **类型定义** (`src/types/index.ts`)
   - 添加或修改接口定义
   - 确保类型完整性

2. **核心逻辑** (对应模块文件)
   - 按设计文档实现功能
   - 遵循现有代码风格
   - 添加必要的错误处理

3. **配置更新** (`src/config/index.ts`)
   - 更新默认配置
   - 确保向后兼容

4. **UI 更新** (如涉及)
   - 更新 Webview 或 TreeView

**代码规范**:
- 不添加注释（除非用户要求）
- 遵循现有命名规范
- 保持代码简洁

**检查清单**:
- [ ] 类型定义已更新
- [ ] 核心代码已实现
- [ ] 默认配置已更新
- [ ] 代码风格一致

#### 第四步：更新测试用例

**目标**: 确保所有功能有测试覆盖

**测试文件对应关系**:

| 模块 | 测试文件 |
|------|----------|
| 类型定义 | `test/suite/types.test.ts` |
| 配置模块 | `test/suite/config.test.ts` |
| 命令执行 | `test/suite/commandExecutor.test.ts` |
| 日志监控 | `test/suite/logMonitor.test.ts` |
| AI 对话 | `test/suite/ai.test.ts` |

**测试用例规范**:
- 每个测试用例必须包含描述注释
- 注释格式：`测试场景描述 - 期望结果`
- 包含：输入、逻辑、期望输出

**测试用例模板**:
```typescript
it('测试场景描述 - 期望结果', () => {
    // 输入：描述测试输入
    const input = {...};
    
    // 逻辑：描述测试逻辑
    const result = someFunction(input);
    
    // 期望输出：描述期望结果
    assert.strictEqual(result, expectedValue);
});
```

**检查清单**:
- [ ] 新功能有对应测试用例
- [ ] 修改的功能有测试覆盖
- [ ] 测试用例有详细注释

#### 第五步：执行测试验证

**目标**: 确保所有测试通过

**执行命令**:
```bash
npm run test:unit
```

**验证要求**:
- 所有测试用例必须通过
- 无 TypeScript 编译错误
- 无运行时错误

**检查清单**:
- [ ] 所有测试通过
- [ ] 无编译错误
- [ ] 无运行时错误

## 文件修改检查表

### 新增配置项

- [ ] `src/types/index.ts` - 添加接口定义
- [ ] `src/config/index.ts` - 更新默认配置
- [ ] `doc/config.md` - 更新配置文档
- [ ] `doc/Design.md` - 更新配置结构
- [ ] `doc/FUNCTIONS.md` - 更新配置说明
- [ ] `autotest-config.json` - 更新示例配置
- [ ] `test/suite/types.test.ts` - 添加类型测试
- [ ] `test/suite/config.test.ts` - 添加配置测试

### 新增 AI 功能

- [ ] `src/types/index.ts` - 添加类型定义
- [ ] `src/ai/providers.ts` - 实现或修改 Provider
- [ ] `src/ai/chat.ts` - 更新聊天逻辑
- [ ] `src/config/index.ts` - 更新默认配置
- [ ] `doc/ai.md` - 更新 AI 模块文档
- [ ] `doc/Design.md` - 更新总览
- [ ] `doc/FUNCTIONS.md` - 更新功能说明
- [ ] `test/suite/ai.test.ts` - 添加测试用例

### 新增命令执行功能

- [ ] `src/types/index.ts` - 添加类型定义
- [ ] `src/core/commandExecutor.ts` - 实现功能
- [ ] `src/config/index.ts` - 更新默认配置
- [ ] `doc/commandExecutor.md` - 更新模块文档
- [ ] `doc/Design.md` - 更新总览
- [ ] `doc/FUNCTIONS.md` - 更新功能说明
- [ ] `test/suite/commandExecutor.test.ts` - 添加测试用例

### 新增日志监控功能

- [ ] `src/types/index.ts` - 添加类型定义
- [ ] `src/core/logMonitor.ts` - 实现功能
- [ ] `src/config/index.ts` - 更新默认配置
- [ ] `doc/logMonitor.md` - 更新模块文档
- [ ] `doc/Design.md` - 更新总览
- [ ] `doc/FUNCTIONS.md` - 更新功能说明
- [ ] `test/suite/logMonitor.test.ts` - 添加测试用例

## 禁止事项

1. **禁止跳过设计文档直接编码**
   - 必须先更新设计文档，再进行编码

2. **禁止修改代码后不更新文档**
   - 代码修改必须同步更新相关文档

3. **禁止跳过测试**
   - 所有修改必须有对应的测试用例

4. **禁止提交未通过测试的代码**
   - 提交前必须运行 `npm run test:unit` 并通过

5. **禁止随意修改接口定义**
   - 接口修改需评估影响范围，更新所有相关代码

## 示例：新增 AI 模型配置

以下是一个完整的开发流程示例：

### 1. 需求分析

**需求**: AI 模块需要支持配置模型名称，除了厂商可配置，模型名字也需要可配置

**影响范围**:
- 类型定义: `QWenConfig`, `OpenAIConfig`
- AI 模块: `providers.ts`
- 配置模块: `config/index.ts`
- 文档: `ai.md`, `config.md`, `Design.md`, `FUNCTIONS.md`
- 测试: `types.test.ts`, `config.test.ts`, `ai.test.ts`

### 2. 更新设计文档

**更新 `doc/ai.md`**:
- 添加模型配置说明
- 更新支持的模型列表
- 添加模型选择逻辑

**更新 `doc/config.md`**:
- 更新 `QWenConfig` 和 `OpenAIConfig` 接口
- 添加 `model` 字段说明

**更新 `doc/Design.md`**:
- 更新配置结构
- 更新配置示例

**更新 `doc/FUNCTIONS.md`**:
- 添加模型选择说明
- 更新配置示例

### 3. 代码实现

**更新 `src/types/index.ts`**:
```typescript
interface QWenConfig {
    apiKey: string;
    apiUrl: string;
    model: string;  // 新增
}

interface OpenAIConfig {
    apiKey: string;
    apiUrl: string;
    model: string;  // 新增
}
```

**更新 `src/ai/providers.ts`**:
```typescript
async send(messages: AIMessage[]): Promise<AIResponse> {
    const model = this.config.model || 'qwen-turbo';  // 使用配置的模型
    // ...
}
```

**更新 `src/config/index.ts`**:
```typescript
qwen: {
    apiKey: "",
    apiUrl: "...",
    model: "qwen-turbo"  // 新增默认值
}
```

### 4. 更新测试用例

**更新 `test/suite/types.test.ts`**:
- 添加模型字段验证测试

**更新 `test/suite/config.test.ts`**:
- 添加默认模型验证测试
- 添加模型修改测试

**更新 `test/suite/ai.test.ts`**:
- 添加模型配置测试
- 添加模型默认值测试

### 5. 执行测试验证

```bash
npm run test:unit
```

确保所有测试通过。

## 附录：文档结构

```
d:\AutoTest
├── README.md               # 项目说明（根目录）
├── DEVELOPMENT.md          # 开发流程文档（本文件）
├── autotest-config.json    # 默认配置示例
├── doc/
│   ├── Design.md           # 设计总览
│   ├── FUNCTIONS.md        # 功能使用文档
│   ├── config.md           # 配置模块详细文档
│   ├── commandExecutor.md  # 命令执行模块详细文档
│   ├── logMonitor.md       # 日志监控模块详细文档
│   └── ai.md               # AI对话模块详细文档
├── src/
│   ├── types/index.ts      # 类型定义
│   ├── config/index.ts     # 配置模块
│   ├── core/               # 核心功能模块
│   ├── ai/                 # AI 模块
│   └── views/              # UI 视图
└── test/
    └── suite/              # 测试用例
```

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2024-01-15 | 初始版本 |

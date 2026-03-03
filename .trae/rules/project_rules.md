## 项目路径
d:\code\RemoteTest

## 开发环境
Windows 11

## 核心原则

1. **设计先行**: 代码修改前必须先更新设计文档
2. **文档同步**: 功能文档与代码必须保持一致
3. **测试驱动**: 所有修改必须有对应的测试用例
4. **验证通过**: 提交前必须通过所有测试

## 开发流程

```
需求分析 → 更新文档 → 代码实现 → 测试验证
```

### 步骤详解

#### 1. 需求分析

- 理解用户的具体需求
- 分析需求涉及的模块
- 确定需要修改的文件列表

#### 2. 更新文档

| 修改类型 | 需要更新的文档 |
|----------|----------------|
| 新增配置项 | `doc/config.md`, `doc/Design.md` |
| 修改核心逻辑 | 对应模块文档 |
| 新增功能 | `doc/Design.md`, `doc/USER_GUIDE.md` |

#### 3. 代码实现

实现顺序：
1. 类型定义 (`src/types/index.ts`)
2. 核心逻辑 (对应模块文件)
3. 配置更新 (`src/config/index.ts`)

#### 4. 测试验证

```bash
npm test
```

## 文件修改检查表

### 新增配置项

- [ ] `src/types/index.ts` - 添加接口定义
- [ ] `src/config/index.ts` - 更新默认配置
- [ ] `src/config/validator.ts` - 更新验证规则
- [ ] `doc/config.md` - 更新配置文档
- [ ] `doc/Design.md` - 更新配置结构
- [ ] `RemoteTest-config.json` - 更新示例配置
- [ ] `test/suite/types.test.ts` - 添加类型测试

### 新增命令执行功能

- [ ] `src/types/index.ts` - 添加类型定义
- [ ] `src/core/commandExecutor.ts` - 实现功能
- [ ] `doc/commandExecutor.md` - 更新模块文档
- [ ] `test/suite/commandExecutor.test.ts` - 添加测试用例
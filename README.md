# RemoteTest

> VSCode 远程开发辅助插件 —— 通过 SSH/SFTP 将本地文件一键同步到远程服务器，自动执行测试命令，实时监控日志。

[![VS Code Version](https://img.shields.io/badge/VS%20Code-1.85%2B-blue)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| **文件上传 / 同步** | 右键菜单一键上传文件或整个目录到远程服务器，支持反向同步（下载） |
| **远程命令执行** | 上传后自动执行预定义命令（如编译、测试），支持命令变量替换 |
| **Git 变更检测** | 自动检测未提交变更和最近 commit 的文件变更，批量或逐个上传 |
| **远程日志监控** | 浏览远程目录下的日志文件，在线查看或下载到本地 |
| **快捷命令** | 可视化面板快速执行预设命令，支持输出过滤 |

## 📦 安装

### 从 VSIX 安装

1. 下载最新的 `.vsix` 文件
2. 在 VSCode 中按 `Ctrl+Shift+P` → 输入 `Extensions: Install from VSIX...`
3. 选择下载的文件即可

### 从源码构建

```bash
git clone https://github.com/Dontfork/RemoteTest.git
cd RemoteTest
npm install
npm run package        # 生成 .vsix
```

## 🚀 快速开始

### 1. 创建配置文件

在项目根目录的 `.vscode/` 下创建 `RemoteTest-config.json`：

```
你的项目/
├── .vscode/
│   └── RemoteTest-config.json   ← 在这里创建
├── src/
└── ...
```

### 2. 最小配置示例

```json
{
  "projects": [
    {
      "name": "我的项目",
      "localPath": "D:\\myproject",
      "server": {
        "host": "192.168.1.100",
        "port": 22,
        "username": "root",
        "password": "your-password",
        "remoteDirectory": "/home/user/myproject"
      },
      "commands": [
        {
          "name": "运行测试",
          "executeCommand": "pytest {filePath} -v",
          "runnable": true
        }
      ]
    }
  ]
}
```

### 3. 开始使用

- **右键文件** → `RemoteTest: 上传文件` — 上传单个文件
- **右键文件** → `RemoteTest: 运行` — 上传并执行命令
- **活动栏** → 点击 RemoteTest 图标 → 使用各功能面板

## ⚙️ 配置参考

### 完整配置示例

```json
{
  "projects": [
    {
      "name": "我的测试项目",
      "localPath": "D:\\myproject",
      "enabled": true,
      "server": {
        "host": "192.168.1.100",
        "port": 22,
        "username": "root",
        "password": "your-password",
        "privateKeyPath": "",
        "remoteDirectory": "/home/user/myproject"
      },
      "commands": [
        {
          "name": "运行测试",
          "executeCommand": "pytest {filePath} -v",
          "runnable": true,
          "clearOutputBeforeRun": true,
          "includePatterns": ["PASSED", "FAILED", "ERROR"],
          "excludePatterns": []
        },
        {
          "name": "清理缓存",
          "executeCommand": "rm -rf __pycache__",
          "runnable": false
        }
      ],
      "logs": {
        "directories": [
          {
            "name": "应用日志",
            "path": "/var/log/myapp"
          }
        ],
        "downloadPath": "D:\\downloads\\logs"
      },
      "textFileExtensions": [],
      "commitCount": 1
    }
  ],
  "refreshInterval": 0,
  "useLogOutputChannel": true,
  "textFileExtensions": [],
  "logViewer": "",
  "commitCount": 1
}
```

### 项目配置

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 项目名称，显示在面板中 |
| `localPath` | string | ✅ | 本地项目根路径 |
| `enabled` | boolean | | 是否启用该项目（默认 `true`） |
| `server` | object | ✅ | 服务器连接配置 |
| `commands` | array | | 快捷命令列表 |
| `logs` | object | | 日志监控配置 |
| `textFileExtensions` | string[] | | 额外的文本文件扩展名（上传时自动转换换行符） |
| `commitCount` | number | | 显示最近 N 个 commit 变更（默认 `1`，`0` 禁用） |

### 服务器配置 (`server`)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `host` | string | ✅ | 服务器地址 |
| `port` | number | | SSH 端口（默认 `22`） |
| `username` | string | ✅ | 登录用户名 |
| `password` | string | | 登录密码（与 `privateKeyPath` 二选一） |
| `privateKeyPath` | string | | SSH 私钥路径（与 `password` 二选一） |
| `remoteDirectory` | string | ✅ | 远程工作目录 |

### 命令配置 (`commands`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 命令显示名称 |
| `executeCommand` | string | 执行的命令，支持 [变量替换](#命令变量) |
| `runnable` | boolean | 是否可运行（`true` 时在右键菜单中显示） |
| `clearOutputBeforeRun` | boolean | 执行前清空输出面板（默认 `true`） |
| `includePatterns` | string[] | 只显示匹配的输出行（支持正则） |
| `excludePatterns` | string[] | 排除匹配的输出行（支持正则） |

#### 命令变量

在 `executeCommand` 中可使用以下占位符：

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `{filePath}` | 当前文件的远程完整路径 | `/home/user/project/src/main.py` |
| `{fileName}` | 文件名（含扩展名） | `main.py` |
| `{fileDir}` | 远程文件所在目录 | `/home/user/project/src` |
| `{localPath}` | 本地完整路径 | `D:\myproject\src\main.py` |
| `{localDir}` | 本地文件所在目录 | `D:\myproject\src` |
| `{localFileName}` | 本地文件名（不含扩展名） | `main` |
| `{remoteDir}` | 远程项目根目录 | `/home/user/myproject` |

### 日志配置 (`logs`)

| 字段 | 类型 | 说明 |
|------|------|------|
| `directories` | array | 远程日志目录列表 |
| `directories[].name` | string | 目录显示名称 |
| `directories[].path` | string | 远程日志目录路径 |
| `downloadPath` | string | 日志文件下载到本地的保存路径 |

### 全局配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `refreshInterval` | number | 日志自动刷新间隔（毫秒），`0` 禁用自动刷新 |
| `useLogOutputChannel` | boolean | 测试输出使用 LogOutputChannel（支持日志级别过滤） |
| `logViewer` | string | 自定义日志查看程序。留空使用 VSCode 打开；可设为 `notepad.exe` 等外部程序 |
| `commitCount` | number | 全局默认 commit 显示数量，项目级配置优先 |
| `textFileExtensions` | string[] | 全局额外文本扩展名，与项目级合并 |

## 🎮 使用指南

### 文件操作

在编辑器或资源管理器中**右键**：

| 操作 | 说明 |
|------|------|
| `RemoteTest: 上传文件` | 上传当前文件/目录到远程 |
| `RemoteTest: 下载文件` | 从远程下载文件/目录到本地 |
| `RemoteTest: 运行` | 上传后自动执行预设命令 |

### 修改监控面板

活动栏 → RemoteTest → **修改监控**：

- 📂 **项目级别** — 点击上传图标一键同步该项目的所有未提交变更
- 📝 **未提交变更** — 列出所有 Git 检测到的变更文件，可逐个上传
- 📋 **Commit 记录** — 展示最近 N 个 commit 的变更文件（由 `commitCount` 控制）
- 删除类型的文件会提示是否同步删除远程对应文件
- 重命名/移动的文件上传后会询问是否清理远程旧路径

### 日志监控面板

活动栏 → RemoteTest → **日志监控**：

- 浏览远程目录下的日志文件
- 点击眼睛图标在线查看日志
- 点击下载图标将日志保存到本地

### 快捷命令面板

活动栏 → RemoteTest → **快捷命令**：

- 点击播放图标执行预设命令
- 标记为 `runnable: true` 的命令会出现在右键菜单中

### 配置管理

所有面板标题栏均可：

- 🔄 **刷新** — 重新加载配置和数据
- ⚙️ **打开配置** — 在编辑器中编辑配置文件

## 🏗️ 项目架构

```
src/
├── extension.ts          # 插件入口（极简，委托 container 初始化）
├── container.ts          # DI 容器，管理服务生命周期与命令注册
│
├── pure/                 # 🧪 纯逻辑层（零 vscode 依赖，可单元测试）
│   ├── errors.ts         # 错误格式化
│   ├── outputFilter.ts   # 命令输出过滤与日志级别识别
│   ├── commandVariables.ts  # 命令变量替换
│   ├── textFile.ts       # 文本文件检测与换行符转换
│   ├── format.ts         # 尺寸/日期格式化
│   ├── pathUtil.ts       # 路径工具（规范化、远程路径计算）
│   ├── gitParser.ts      # Git 状态解析（status / diff-tree / log）
│   └── configSchema.ts   # 配置校验、深度合并、字段填充
│
├── services/             # 🔧 服务层（业务逻辑，可引用 vscode）
│   ├── ConfigStore.ts    # 配置管理（加载/校验/监听变更）
│   ├── CommandLock.ts    # 命令执行锁（防并发）
│   └── ChangesUploadService.ts  # 变更上传/删除逻辑
│
├── core/                 # 🔌 核心通信层
│   ├── sshClient.ts      # SSH 连接与命令执行
│   ├── scpClient.ts      # SFTP 文件传输
│   ├── uploader.ts       # 文件上传/同步/测试用例运行
│   ├── commandExecutor.ts # 命令执行器
│   ├── gitChangeDetector.ts  # Git 变更检测
│   ├── logMonitor.ts     # 远程日志监控
│   ├── quickCommandDetector.ts  # 快捷命令检测
│   └── connectionPool.ts # SSH 连接池
│
├── views/                # 🖥️ 视图层（Tree View 与 UI 交互）
│   ├── changesTreeView.ts    # 修改监控面板
│   ├── logTreeView.ts        # 日志监控面板
│   └── quickCommandsTreeView.ts  # 快捷命令面板
│
├── commands/             # 📋 命令注册
│   ├── registry.ts       # 统一注册所有命令
│   └── uriResolver.ts    # URI 解析工具
│
├── config/               # ⚙️ 配置子模块
│   ├── ConfigStore.ts    # (同 services/ConfigStore)
│   ├── validatorUI.ts    # 配置校验 UI 提示
│   └── index.ts          # 配置入口
│
├── types/                # 📐 类型定义
└── utils/                # 🔨 工具函数
    ├── auth.ts           # SSH 认证
    └── outputChannel.ts  # 统一输出通道
```

## 🧪 测试

项目采用 **纯逻辑层** 架构，核心业务代码位于 `src/pure/`，不依赖 VSCode API，可直接用 Mocha 运行单元测试：

```bash
npm run test:unit
```

当前测试覆盖 9 个模块，共 **162 个测试用例**：

| 测试模块 | 覆盖内容 |
|----------|----------|
| `errors` | formatError / fullErrorMessage |
| `outputFilter` | ANSI 去除、模式匹配、输出过滤、日志级别 |
| `commandVariables` | 变量构建与替换 |
| `textFile` | 文本文件检测、换行符转换 |
| `format` | 尺寸/日期格式化 |
| `pathUtil` | 路径规范化、远程路径计算 |
| `gitParser` | Git 状态/日志解析、相似度计算 |
| `configSchema` | 配置校验、深度合并、冲突检测 |
| `commandLock` | 并发锁机制 |

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 开发模式（监听变更）
npm run watch

# Webpack 开发构建
npm run webpack-dev

# 生产打包（生成 dist/）
npm run package

# 运行单元测试
npm run test:unit
```

### 调试

按 **F5** 启动 Extension Development Host，在新窗口中加载插件进行调试。

## ❓ 常见问题

<details>
<summary><b>配置文件应该放在哪里？</b></summary>

配置文件放在**当前打开的 VSCode 项目根目录**的 `.vscode/` 文件夹下，文件名必须为 `RemoteTest-config.json`。可通过 VSCode 设置 `RemoteTest.configPath` 修改文件名。
</details>

<details>
<summary><b>连接不上服务器？</b></summary>

1. 确认服务器地址和端口是否正确
2. 确认用户名和密码/私钥是否正确
3. 如果使用私钥认证，检查 `privateKeyPath` 路径是否有效
4. 尝试用 SSH 客户端手动连接以排除网络问题
</details>

<details>
<summary><b>上传文件失败？</b></summary>

1. 确认 `localPath` 配置正确且目录存在
2. 确认 `remoteDirectory` 在服务器上存在且有写入权限
3. 检查磁盘空间是否充足
</details>

<details>
<summary><b>修改监控面板看不到变更？</b></summary>

1. 确认项目目录是一个 Git 仓库
2. 确认有未提交的变更或 `commitCount` > 0
3. 点击刷新按钮重新检测
</details>

<details>
<summary><b>日志文件太大，VSCode 打开很慢？</b></summary>

配置 `logViewer` 为外部程序，如 `"notepad.exe"` 或 `"code.exe"`，日志将用指定程序打开。
</details>

## 📄 License

[MIT](LICENSE)

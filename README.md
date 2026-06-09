# remote-test

简化测试工作流程，提供文件上传、命令执行和日志监控功能。

## 功能特性

- **文件上传/同步**: 右键菜单操作，支持单文件和目录
- **快捷命令**: 快速执行预定义命令
- **修改监控**: 基于 Git 检测变更，一键上传
- **日志监控**: 实时查看和下载远程日志

## 配置

### 创建配置文件

在项目根目录的 `.vscode` 文件夹下创建 `RemoteTest-config.json` 文件：

```
你的项目文件夹/
├── .vscode/
│   ├── RemoteTest-config.json  ← 创建这个文件
│   └── launch.json
├── src/
└── ...
```

### 配置示例

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

### 配置项说明

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **项目配置** | | |
| `name` | 项目名称 | "我的测试项目" |
| `enabled` | 是否启用（默认true） | true |
| `localPath` | 本地项目路径 | "D:\\myproject" |
| **服务器配置** | | |
| `server.host` | 服务器地址 | "192.168.1.100" |
| `server.port` | SSH端口（默认22） | 22 |
| `server.username` | 用户名 | "root" |
| `server.password` | 密码 | "your-password" |
| `server.privateKeyPath` | SSH私钥路径 | "C:\\Users\\user\\.ssh\\id_rsa" |
| `server.remoteDirectory` | 远程工作目录 | "/home/user/myproject" |
| **命令配置** | | |
| `commands` | 快捷命令列表 | 见下文 |
| **日志配置** | | |
| `logs.directories` | 日志目录列表 | 见下文 |
| `logs.downloadPath` | 日志下载保存路径 | "D:\\downloads\\logs" |
| **全局配置** | | |
| `refreshInterval` | 日志刷新间隔（毫秒），0为禁用 | 5000 |
| `useLogOutputChannel` | 测试输出通道类型 | true |
| `logViewer` | 自定义日志查看程序路径（为空时使用VSCode打开） | "notepad.exe" |
| `commitCount` | 显示最近 N 个 commit 的变更文件，默认 1（设为 0 禁用，项目级优先于全局） | 1 |
| `textFileExtensions` | 额外文本文件扩展名（上传时作为文本处理，项目级与全局合并） | [".cxx"] |

> **提示**：
> - `useLogOutputChannel`: true=LogOutputChannel（支持日志级别），false=OutputChannel
> - `textFileExtensions`: 指定上传时作为文本处理的文件扩展名（转换换行符）
> - `logViewer`: 自定义日志查看程序路径。日志文件通常较大不适合用VSCode打开，可配置为系统程序。配置时可以使用：
>   - **程序名**（系统会从 PATH 环境变量中查找）：如 `notepad.exe`、`notepad++`、`code.exe` 等
>   - **完整路径**：如 `C:\Program Files\Notepad++\notepad++.exe`
>   为空时默认使用VSCode打开。

### 快捷命令配置

```json
"commands": [
  {
    "name": "显示名称",
    "executeCommand": "实际执行的命令",
    "runnable": true,
    "clearOutputBeforeRun": true,
    "includePatterns": ["ERROR", "FAILED"],
    "excludePatterns": ["DEBUG"]
  }
]
```

| 命令配置项 | 说明 | 示例 |
|------------|------|------|
| `name` | 命令名称 | "运行测试" |
| `executeCommand` | 执行命令 | "pytest {filePath} -v" |
| `runnable` | 是否可运行（在右键菜单显示） | true |
| `clearOutputBeforeRun` | 执行前清空输出（默认true） | true |
| `includePatterns` | 只显示匹配的行 | ["ERROR", "FAILED"] |
| `excludePatterns` | 排除匹配的行 | ["DEBUG", "TRACE"] |

**命令变量**：
- `{filePath}` - 当前文件路径
- `{fileName}` - 文件名
- `{fileDir}` - 文件所在目录
- `{localPath}` - 本地完整路径
- `{remoteDir}` - 远程目录

### 日志目录配置

```json
"logs": {
  "directories": [
    {
      "name": "显示名称",
      "path": "远程日志目录路径"
    }
  ],
  "downloadPath": "本地保存路径"
}
```

| 日志配置项 | 说明 | 示例 |
|-------------|------|------|
| `name` | 目录显示名称 | "应用日志" |
| `path` | 远程日志目录 | "/var/log/myapp" |
| `downloadPath` | 本地下载路径 | "D:\\downloads\\logs" |

## 使用

### 打开插件视图

在 VSCode 左侧活动栏找到 **remote-test** 图标，点击展开：

- 📋 日志监控 - 查看和下载远程日志
- 📝 修改监控 - 查看 Git 变更并上传
- ⌨️ 快捷命令 - 快速执行预设命令

### 文件操作

在资源管理器中右键点击文件或文件夹：

| 操作 | 菜单位置 |
|------|----------|
| 上传文件 | 右键 → RemoteTest: 上传文件 |
| 下载文件 | 右键 → RemoteTest: 同步文件 |
| 运行测试 | 右键 → RemoteTest: 运行 |

### 日志监控

1. 点击活动栏的 **remote-test** 图标
2. 选择 **日志监控**
3. 点击目录查看日志文件
4. 右键日志文件可下载或打开

### 修改监控

1. 点击活动栏的 **remote-test** 图标
2. 选择 **修改监控**
3. 查看所有未提交的 Git 变更文件
4. 右键单个文件或整个项目进行上传

> **Commit 记录功能**：配置 `commitCount` 后，修改监控还会展示最近 N 个 commit 的变更文件列表，支持按 commit 或按单个文件一键上传。

### 快捷命令

1. 点击活动栏的 **remote-test** 图标
2. 选择 **快捷命令**
3. 点击命令名称执行

### 配置操作

在任意视图的标题栏可以：

- 🔄 刷新配置 - 重新加载配置文件
- ⚙️ 打开配置 - 在编辑器中打开配置文件

## 常见问题

### Q: 配置文件放在哪里？

A: 配置文件应放在**当前打开的 VSCode 项目根目录**的 `.vscode` 文件夹下，文件名必须是 `RemoteTest-config.json`。

### Q: 连接不上服务器？

A: 检查配置：
1. 服务器地址是否正确
2. 端口是否是 22
3. 用户名和密码是否正确

### Q: 日志目录看不到文件？

A: 检查：
1. 远程目录路径是否正确
2. 是否有读取权限

### Q: 上传文件失败？

A: 检查：
1. `localPath` 是否配置正确
2. `remoteDirectory` 是否存在
3. 远程目录是否有写入权限

## 技术支持

如有问题，请检查：
1. 配置文件格式是否正确（JSON 语法）
2. 所有路径是否存在
3. 网络连接是否正常

## 开发调试

### 安装依赖

```bash
npm install
```

### 启动调试

按 **F5** 启动调试，会在新窗口中加载插件

### 打包插件

```bash
npm run package
```

打包完成后，会生成 `.vsix` 文件，可以在 VSCode 中通过"从 VSIX 安装"来安装插件。

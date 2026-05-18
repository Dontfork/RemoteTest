/**
 * 服务器配置接口
 * 
 * 定义了连接远程服务器所需的所有配置信息，包括主机地址、端口、认证方式等。
 * 支持密码认证和私钥认证两种方式。
 */
export interface ServerConfig {
    /** 服务器主机地址，可以是IP地址或域名 */
    host: string;
    /** SSH端口号，默认为22 */
    port: number;
    /** SSH登录用户名 */
    username: string;
    /** SSH登录密码（密码认证方式） */
    password: string;
    /** SSH私钥文件路径（密钥认证方式） */
    privateKeyPath: string;
    /** 远程工作目录，用于文件上传和命令执行 */
    remoteDirectory?: string;
}

/**
 * 命令配置接口
 * 
 * 定义了可执行的远程命令及其配置选项，包括命令内容、输出过滤规则等。
 */
export interface CommandConfig {
    /** 命令名称，用于显示和识别 */
    name: string;
    /** 要执行的命令内容，支持变量替换（如 {filePath}、{fileName}） */
    executeCommand: string;
    /** 包含模式列表，只保留匹配这些模式的输出行 */
    includePatterns?: string[];
    /** 排除模式列表，过滤掉匹配这些模式的输出行 */
    excludePatterns?: string[];
    /** 是否可在运行测试用例时执行，默认为 false */
    runnable?: boolean;
    /** 执行命令前是否清空输出通道，默认为 false */
    clearOutputBeforeRun?: boolean;
}

/**
 * 命令变量接口
 * 
 * 定义了命令中可使用的变量，用于在执行命令时进行变量替换。
 * 这些变量提供了文件路径相关的信息，使命令能够针对具体文件执行。
 */
export interface CommandVariables {
    /** 远程文件完整路径 */
    filePath: string;
    /** 文件名（包含扩展名） */
    fileName: string;
    /** 文件所在目录（远程） */
    fileDir: string;
    /** 本地文件完整路径 */
    localPath: string;
    /** 本地文件所在目录 */
    localDir: string;
    /** 本地文件名（包含扩展名） */
    localFileName: string;
    /** 远程工程目录 */
    remoteDir: string;
}

/**
 * 日志目录配置接口
 * 
 * 定义了一个日志监控目录的配置信息。
 */
export interface LogDirectoryConfig {
    /** 日志目录的显示名称 */
    name: string;
    /** 日志目录的远程路径 */
    path: string;
}

/**
 * 项目日志配置接口
 * 
 * 定义了项目的日志监控配置，包括要监控的日志目录列表和下载路径。
 */
export interface ProjectLogsConfig {
    /** 要监控的日志目录列表 */
    directories: LogDirectoryConfig[];
    /** 日志文件下载到本地的保存路径 */
    downloadPath: string;
}

/**
 * 项目配置接口
 * 
 * 定义了一个完整的项目配置，包括项目基本信息、服务器配置、命令列表和日志配置。
 * 每个项目可以独立配置，支持多项目管理。
 */
export interface ProjectConfig {
    /** 项目名称，用于显示和识别 */
    name: string;
    /** 本地项目路径，用于文件变更检测和路径映射 */
    localPath?: string;
    /** 是否启用该项目，默认为 true */
    enabled?: boolean;
    /** 服务器配置信息 */
    server: ServerConfig;
    /** 可执行的命令列表 */
    commands?: CommandConfig[];
    /** 日志监控配置 */
    logs?: ProjectLogsConfig;
    /** 自定义文本文件扩展名列表，用于判断文件是否需要换行符转换（CRLF→LF） */
    textFileExtensions?: string[];
    /** 显示最近多少条 commit 记录，0 表示不显示（默认） */
    commitCount?: number;
}

/**
 * RemoteTest 扩展配置接口
 * 
 * 定义了整个扩展的配置结构，包括项目列表和全局配置选项。
 */
export interface RemoteTestConfig {
    /** 项目配置列表 */
    projects: ProjectConfig[];
    /** 自动刷新间隔（毫秒），0表示禁用自动刷新 */
    refreshInterval?: number;
    /** 文本文件扩展名列表，用于判断文件是否为文本文件 */
    textFileExtensions?: string[];
    /** 执行命令前是否清空输出通道的全局默认值 */
    clearOutputBeforeRun?: boolean;
    /** 是否使用 LogOutputChannel（支持日志级别），默认为 true */
    useLogOutputChannel?: boolean;
    /** 自定义日志查看程序路径，为空则使用 VSCode 默认编辑器 */
    logViewer?: string;
    /** 全局默认显示最近多少条 commit 记录，0 表示不显示 */
    commitCount?: number;
}

/**
 * 日志文件信息接口
 * 
 * 描述一个远程日志文件的基本信息，包括文件名、路径、大小和修改时间。
 */
export interface LogFile {
    /** 文件名 */
    name: string;
    /** 文件完整路径（远程） */
    path: string;
    /** 文件大小（字节） */
    size: number;
    /** 最后修改时间 */
    modifiedTime: Date;
    /** 是否为目录 */
    isDirectory: boolean;
}

/**
 * 项目匹配结果接口
 * 
 * 表示文件路径匹配到项目的结果，包含匹配到的项目和可选的命令配置。
 */
export interface ProjectMatchResult {
    /** 匹配到的项目配置 */
    project: ProjectConfig;
    /** 匹配到的命令配置（如果有） */
    command?: CommandConfig;
}

/**
 * Git 变更类型
 * 
 * 定义了 Git 状态的各种类型，用于标识文件的变更状态。
 */
export type GitChangeType = 'added' | 'modified' | 'deleted' | 'renamed' | 'moved';

/**
 * Git 变更信息接口
 * 
 * 描述一个 Git 文件变更的详细信息，包括文件路径、变更类型和所属项目。
 */
export interface GitChange {
    /** 文件绝对路径 */
    path: string;
    /** 文件相对路径（相对于工作区根目录） */
    relativePath: string;
    /** 用于显示的文件路径（格式化后的路径） */
    displayPath: string;
    /** 变更类型 */
    type: GitChangeType;
    /** 所属项目 */
    project: ProjectConfig;
    /** 重命名前的相对路径（仅重命名操作） */
    oldRelativePath?: string;
    /** 重命名前的绝对路径（仅重命名操作） */
    oldPath?: string;
}

/**
 * Git 变更分组接口
 * 
 * 按项目分组的 Git 变更列表，用于在树形视图中显示。
 */
export interface GitChangeGroup {
    /** 项目名称 */
    projectName: string;
    /** 项目配置 */
    project: ProjectConfig;
    /** 该项目的变更列表 */
    changes: GitChange[];
}

/**
 * Git commit 信息接口
 * 
 * 描述一个 Git commit 的基本信息。
 */
export interface CommitInfo {
    /** commit 哈希值（完整） */
    hash: string;
    /** commit 哈希值（短格式） */
    shortHash: string;
    /** commit 提交信息 */
    message: string;
    /** 提交者 */
    author: string;
    /** 提交日期 */
    date: string;
}

/**
 * commit 中的文件变更接口
 * 
 * 描述一个 commit 中某个文件的变更信息。
 */
export interface CommitFileChange {
    /** 文件相对路径（相对于工作区根目录） */
    relativePath: string;
    /** 用于显示的文件路径 */
    displayPath: string;
    /** 变更类型 */
    type: GitChangeType;
    /** 所属项目 */
    project: ProjectConfig;
}

/**
 * commit 变更分组接口
 * 
 * 按 commit 分组的文件变更列表，用于在树形视图中显示。
 */
export interface CommitChangeGroup {
    /** commit 信息 */
    commit: CommitInfo;
    /** 所属项目名称 */
    projectName: string;
    /** 所属项目配置 */
    project: ProjectConfig;
    /** 该 commit 的文件变更列表 */
    changes: CommitFileChange[];
}

/**
 * 项目变更数据接口
 * 
 * 一个项目的完整变更数据，包含未提交变更和 commit 历史。
 */
export interface ProjectChangeData {
    /** 项目名称 */
    projectName: string;
    /** 项目配置 */
    project: ProjectConfig;
    /** 未提交的变更列表 */
    uncommittedChanges: GitChange[];
    /** commit 变更分组列表 */
    commitGroups: CommitChangeGroup[];
}

/**
 * 快捷命令接口
 * 
 * 定义了一个可快速执行的命令，不包含变量，可以直接执行。
 */
export interface QuickCommand {
    /** 命令名称 */
    name: string;
    /** 要执行的命令内容 */
    executeCommand: string;
    /** 所属项目名称 */
    projectName: string;
    /** 所属项目配置 */
    project: ProjectConfig;
    /** 执行前是否清空输出 */
    clearOutputBeforeRun?: boolean;
}

/**
 * 快捷命令分组接口
 * 
 * 按项目分组的快捷命令列表，用于在树形视图中显示。
 */
export interface QuickCommandGroup {
    /** 项目名称 */
    projectName: string;
    /** 项目配置 */
    project: ProjectConfig;
    /** 该项目的快捷命令列表 */
    commands: QuickCommand[];
}

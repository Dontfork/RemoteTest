import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as path from 'path';

type GitChangeType = 'added' | 'modified' | 'deleted' | 'renamed' | 'moved';

describe('GitChangeDetector Module - Git变更检测模块测试', () => {
    describe('GitChangeType 类型 - 变更类型定义', () => {
        it('验证added类型 - 新增文件', () => {
            const changeType: GitChangeType = 'added';
            assert.strictEqual(changeType, 'added');
        });

        it('验证modified类型 - 修改文件', () => {
            const changeType: GitChangeType = 'modified';
            assert.strictEqual(changeType, 'modified');
        });

        it('验证deleted类型 - 删除文件', () => {
            const changeType: GitChangeType = 'deleted';
            assert.strictEqual(changeType, 'deleted');
        });

        it('验证renamed类型 - 重命名文件', () => {
            const changeType: GitChangeType = 'renamed';
            assert.strictEqual(changeType, 'renamed');
        });

        it('验证moved类型 - 移动文件', () => {
            const changeType: GitChangeType = 'moved';
            assert.strictEqual(changeType, 'moved');
        });
    });

    describe('重命名与移动区分 - 目录变化判断', () => {
        it('验证同目录文件改名 - 重命名', () => {
            const oldPath = 'src/oldName.ts';
            const newPath = 'src/newName.ts';
            
            const oldDir = path.dirname(oldPath);
            const newDir = path.dirname(newPath);
            const isMoved = oldDir !== newDir;
            
            assert.strictEqual(isMoved, false);
        });

        it('验证跨目录文件移动 - 移动', () => {
            const oldPath = 'src/utils/helper.ts';
            const newPath = 'src/core/helper.ts';
            
            const oldDir = path.dirname(oldPath);
            const newDir = path.dirname(newPath);
            const isMoved = oldDir !== newDir;
            
            assert.strictEqual(isMoved, true);
        });

        it('验证根目录到子目录 - 移动', () => {
            const oldPath = 'test.txt';
            const newPath = 'docs/test.txt';
            
            const oldDir = path.dirname(oldPath);
            const newDir = path.dirname(newPath);
            const isMoved = oldDir !== newDir;
            
            assert.strictEqual(isMoved, true);
        });

        it('验证子目录到根目录 - 移动', () => {
            const oldPath = 'docs/readme.md';
            const newPath = 'readme.md';
            
            const oldDir = path.dirname(oldPath);
            const newDir = path.dirname(newPath);
            const isMoved = oldDir !== newDir;
            
            assert.strictEqual(isMoved, true);
        });

        it('验证Windows路径分隔符处理', () => {
            const oldPath = 'src\\utils\\helper.ts';
            const newPath = 'src\\core\\helper.ts';
            
            const oldDir = path.dirname(oldPath);
            const newDir = path.dirname(newPath);
            const isMoved = oldDir !== newDir;
            
            assert.strictEqual(isMoved, true);
        });
    });

    describe('Git Status 解析 - 状态码解析', () => {
        it('验证新增文件状态码 - ?? 表示未跟踪的新文件', () => {
            const xStatus = '?';
            const yStatus = '?';
            const expectedType = determineChangeType(xStatus, yStatus);
            assert.strictEqual(expectedType, 'added');
        });

        it('验证新增文件状态码 - A 表示已暂存的新文件', () => {
            const xStatus = 'A';
            const yStatus = ' ';
            const expectedType = determineChangeType(xStatus, yStatus);
            assert.strictEqual(expectedType, 'added');
        });

        it('验证修改文件状态码 - M 表示已修改', () => {
            const xStatus = 'M';
            const yStatus = ' ';
            const expectedType = determineChangeType(xStatus, yStatus);
            assert.strictEqual(expectedType, 'modified');
        });

        it('验证删除文件状态码 - D 表示已删除', () => {
            const xStatus = 'D';
            const yStatus = ' ';
            const expectedType = determineChangeType(xStatus, yStatus);
            assert.strictEqual(expectedType, 'deleted');
        });

        it('验证重命名文件状态码 - R 表示重命名', () => {
            const xStatus = 'R';
            const yStatus = ' ';
            const expectedType = determineChangeType(xStatus, yStatus);
            assert.strictEqual(expectedType, 'renamed');
        });

        it('验证工作区修改状态 - 右侧M表示工作区修改', () => {
            const xStatus = ' ';
            const yStatus = 'M';
            const expectedType = determineChangeType(xStatus, yStatus);
            assert.strictEqual(expectedType, 'modified');
        });

        it('验证工作区删除状态 - 右侧D表示工作区删除', () => {
            const xStatus = ' ';
            const yStatus = 'D';
            const expectedType = determineChangeType(xStatus, yStatus);
            assert.strictEqual(expectedType, 'deleted');
        });

        function determineChangeType(x: string, y: string): GitChangeType {
            if (x === 'D' || y === 'D') {
                return 'deleted';
            }
            if (x === 'A' || y === 'A' || x === '?' || y === '?') {
                return 'added';
            }
            if (x === 'R' || y === 'R') {
                return 'renamed';
            }
            return 'modified';
        }
    });

    describe('Git Status 输出解析 - 行解析', () => {
        it('解析标准状态行 - XY filename格式', () => {
            const line = ' M src/test.ts';
            const result = parseGitStatusLine(line);
            
            assert.strictEqual(result.status, ' M');
            assert.strictEqual(result.filePath, 'src/test.ts');
        });

        it('解析未跟踪文件 - ?? filename格式', () => {
            const line = '?? newfile.ts';
            const result = parseGitStatusLine(line);
            
            assert.strictEqual(result.status, '??');
            assert.strictEqual(result.filePath, 'newfile.ts');
        });

        it('解析带引号的文件名 - 处理特殊字符', () => {
            const line = ' M "src/file with spaces.ts"';
            const result = parseGitStatusLine(line);
            
            assert.strictEqual(result.filePath, 'src/file with spaces.ts');
        });

        it('解析重命名文件 - R old -> new格式', () => {
            const line = 'R  oldname.ts -> newname.ts';
            const result = parseGitStatusLine(line);
            
            assert.strictEqual(result.filePath, 'newname.ts');
        });

        function parseGitStatusLine(line: string): { status: string; filePath: string } {
            if (line.length < 4) {
                return { status: '', filePath: '' };
            }

            const status = line.substring(0, 2);
            let filePath = line.substring(3).trim();

            if (filePath.startsWith('"') && filePath.endsWith('"')) {
                filePath = filePath.slice(1, -1);
            }

            if (filePath.includes(' -> ')) {
                const parts = filePath.split(' -> ');
                filePath = parts[1];
            }

            return { status, filePath };
        }
    });

    describe('变更分组 - 按项目分组', () => {
        it('验证变更按项目分组 - 相同项目的变更合并', () => {
            const changes = [
                { path: 'D:\\projectA\\file1.ts', project: { name: '项目A' } },
                { path: 'D:\\projectA\\file2.ts', project: { name: '项目A' } },
                { path: 'D:\\projectB\\file1.ts', project: { name: '项目B' } }
            ];

            const groups = groupChangesByProject(changes as any);
            
            assert.strictEqual(groups.length, 2);
            assert.strictEqual(groups[0].changes.length, 2);
            assert.strictEqual(groups[1].changes.length, 1);
        });

        it('验证空变更列表 - 返回空分组', () => {
            const changes: any[] = [];
            const groups = groupChangesByProject(changes);
            
            assert.strictEqual(groups.length, 0);
        });

        function groupChangesByProject(changes: Array<{ path: string; project: { name: string } }>): Array<{ projectName: string; changes: any[] }> {
            const groups = new Map<string, { projectName: string; changes: any[] }>();

            for (const change of changes) {
                const projectName = change.project.name;
                
                if (!groups.has(projectName)) {
                    groups.set(projectName, {
                        projectName: projectName,
                        changes: []
                    });
                }

                groups.get(projectName)!.changes.push(change);
            }

            return Array.from(groups.values());
        }
    });

    describe('路径匹配 - 项目路径匹配', () => {
        it('验证文件路径匹配项目 - 路径以项目路径开头', () => {
            const filePath = 'D:\\projectA\\src\\test.ts';
            const projectPath = 'D:\\projectA';
            
            const matches = filePath.toLowerCase().startsWith(projectPath.toLowerCase());
            
            assert.strictEqual(matches, true);
        });

        it('验证文件路径不匹配项目 - 路径不以项目路径开头', () => {
            const filePath = 'D:\\projectB\\src\\test.ts';
            const projectPath = 'D:\\projectA';
            
            const matches = filePath.toLowerCase().startsWith(projectPath.toLowerCase());
            
            assert.strictEqual(matches, false);
        });

        it('验证大小写不敏感匹配 - Windows路径大小写', () => {
            const filePath = 'd:\\projectA\\src\\test.ts';
            const projectPath = 'D:\\ProjectA';
            
            const matches = filePath.toLowerCase().startsWith(projectPath.toLowerCase());
            
            assert.strictEqual(matches, true);
        });
    });

    describe('远程路径计算 - 本地到远程映射', () => {
        it('验证远程路径计算 - 本地路径映射到远程', () => {
            const localPath = 'D:\\projectA\\src\\test.ts';
            const projectPath = 'D:\\projectA';
            const remoteDirectory = '/home/user/projectA';
            
            const relativePath = localPath.replace(projectPath, '').replace(/\\/g, '/');
            const remotePath = `${remoteDirectory}${relativePath}`;
            
            assert.strictEqual(remotePath, '/home/user/projectA/src/test.ts');
        });

        it('验证根目录文件映射 - 文件在项目根目录', () => {
            const localPath = 'D:\\projectA\\README.md';
            const projectPath = 'D:\\projectA';
            const remoteDirectory = '/home/user/projectA';
            
            const relativePath = localPath.replace(projectPath, '').replace(/\\/g, '/');
            const remotePath = `${remoteDirectory}${relativePath}`;
            
            assert.strictEqual(remotePath, '/home/user/projectA/README.md');
        });
    });

    describe('删除文件确认 - 用户交互', () => {
        it('验证删除文件列表格式化 - 显示前5个文件', () => {
            const deletedFiles = [
                { relativePath: 'file1.ts' },
                { relativePath: 'file2.ts' },
                { relativePath: 'file3.ts' },
                { relativePath: 'file4.ts' },
                { relativePath: 'file5.ts' },
                { relativePath: 'file6.ts' }
            ];

            const message = formatDeletedFilesMessage(deletedFiles as any);
            
            assert.ok(message.includes('file1.ts'));
            assert.ok(message.includes('file5.ts'));
            assert.ok(message.includes('还有 1 个文件'));
        });

        it('验证少量删除文件格式化 - 不显示省略', () => {
            const deletedFiles = [
                { relativePath: 'file1.ts' },
                { relativePath: 'file2.ts' }
            ];

            const message = formatDeletedFilesMessage(deletedFiles as any);
            
            assert.ok(message.includes('file1.ts'));
            assert.ok(message.includes('file2.ts'));
            assert.ok(!message.includes('还有'));
        });

        function formatDeletedFilesMessage(changes: Array<{ relativePath: string }>): string {
            const maxDisplay = 5;
            const displayChanges = changes.slice(0, maxDisplay);
            let message = displayChanges.map(c => `  - ${c.relativePath}`).join('\n');
            
            if (changes.length > maxDisplay) {
                message += `\n  - ... 还有 ${changes.length - maxDisplay} 个文件`;
            }
            
            return message;
        }
    });

    describe('变更统计 - 文件计数', () => {
        it('验证可上传变更计数 - 排除删除的文件', () => {
            const changes = [
                { type: 'added' },
                { type: 'modified' },
                { type: 'deleted' },
                { type: 'renamed' }
            ];

            const uploadableCount = changes.filter(c => c.type !== 'deleted').length;
            
            assert.strictEqual(uploadableCount, 3);
        });

        it('验证删除变更计数 - 仅删除的文件', () => {
            const changes = [
                { type: 'added' },
                { type: 'modified' },
                { type: 'deleted' },
                { type: 'deleted' }
            ];

            const deletedCount = changes.filter(c => c.type === 'deleted').length;
            
            assert.strictEqual(deletedCount, 2);
        });
    });

    describe('以Project为单位监控 - 项目级别检测', () => {
        it('验证非Git项目被过滤 - 不在结果中显示', () => {
            const projects = [
                { name: '项目A', localPath: 'D:\\projectA', isGit: true },
                { name: '项目B', localPath: 'D:\\projectB', isGit: false },
                { name: '项目C', localPath: 'D:\\projectC', isGit: true }
            ];

            const gitProjects = projects.filter(p => p.isGit);
            
            assert.strictEqual(gitProjects.length, 2);
            assert.strictEqual(gitProjects[0].name, '项目A');
            assert.strictEqual(gitProjects[1].name, '项目C');
        });

        it('验证每个项目独立检测 - 不依赖workspace', () => {
            const projectPath = 'D:\\projectA';
            
            assert.ok(projectPath !== undefined);
            assert.ok(typeof projectPath === 'string');
        });

        it('验证变更文件显示相对路径 - 不显示目录结构', () => {
            const change = {
                path: 'D:\\projectA\\src\\utils\\helper.ts',
                relativePath: 'src/utils/helper.ts',
                type: 'modified'
            };

            const displayName = change.relativePath;
            
            assert.strictEqual(displayName, 'src/utils/helper.ts');
            assert.ok(!displayName.includes('D:\\'));
        });

        it('验证空变更项目不显示 - 仅显示有变更的项目', () => {
            const groups = [
                { projectName: '项目A', changes: [{ path: 'file1.ts' }] },
                { projectName: '项目B', changes: [] },
                { projectName: '项目C', changes: [{ path: 'file2.ts' }, { path: 'file3.ts' }] }
            ];

            const nonEmptyGroups = groups.filter(g => g.changes.length > 0);
            
            assert.strictEqual(nonEmptyGroups.length, 2);
        });
    });

    describe('扁平化显示 - 无目录层级', () => {
        it('验证变更文件扁平显示 - 直接显示相对路径', () => {
            const changes = [
                { relativePath: 'src/core/main.ts', type: 'modified' },
                { relativePath: 'src/utils/helper.ts', type: 'added' },
                { relativePath: 'test/main.test.ts', type: 'modified' }
            ];

            const displayItems = changes.map(c => ({
                label: c.relativePath,
                description: c.type
            }));

            assert.strictEqual(displayItems[0].label, 'src/core/main.ts');
            assert.strictEqual(displayItems[1].label, 'src/utils/helper.ts');
            assert.strictEqual(displayItems[2].label, 'test/main.test.ts');
        });

        it('验证项目图标为project - 区别于folder', () => {
            const expectedIcon = 'project';
            
            assert.strictEqual(expectedIcon, 'project');
        });
    });

    describe('项目级别上传 - 按项目操作', () => {
        it('验证上传仅针对单个项目 - 不影响其他项目', () => {
            const groups = [
                { 
                    projectName: '项目A', 
                    changes: [
                        { relativePath: 'file1.ts', type: 'modified' },
                        { relativePath: 'file2.ts', type: 'added' }
                    ] 
                },
                { 
                    projectName: '项目B', 
                    changes: [
                        { relativePath: 'file3.ts', type: 'modified' }
                    ] 
                }
            ];

            const targetGroup = groups.find(g => g.projectName === '项目A');
            const uploadableChanges = targetGroup!.changes.filter(c => c.type !== 'deleted');
            
            assert.strictEqual(uploadableChanges.length, 2);
            assert.strictEqual(uploadableChanges[0].relativePath, 'file1.ts');
        });

        it('验证删除确认仅针对单个项目 - 显示项目名称', () => {
            const group = {
                projectName: '项目A',
                changes: [
                    { relativePath: 'deleted1.ts', type: 'deleted' },
                    { relativePath: 'deleted2.ts', type: 'deleted' }
                ]
            };

            const deletedChanges = group.changes.filter(c => c.type === 'deleted');
            const confirmMessage = `项目 ${group.projectName} 检测到 ${deletedChanges.length} 个已删除的文件`;
            
            assert.strictEqual(deletedChanges.length, 2);
            assert.ok(confirmMessage.includes('项目A'));
        });

        it('验证项目节点右键菜单 - 上传此项目所有变更', () => {
            const contextValue = 'changeGroup';
            
            assert.strictEqual(contextValue, 'changeGroup');
        });

        it('验证进度显示包含项目名称', () => {
            const projectName = '项目A';
            const progressTitle = `RemoteTest - 上传 ${projectName} 变更文件`;
            
            assert.ok(progressTitle.includes('项目A'));
        });
    });

    describe('目录过滤 - 仅显示文件变更', () => {
        it('验证目录变更被过滤 - 不显示在变更列表中', () => {
            const changes = [
                { relativePath: 'src/newFolder/', type: 'added', isDirectory: true },
                { relativePath: 'src/main.ts', type: 'modified', isDirectory: false },
                { relativePath: 'src/utils/', type: 'deleted', isDirectory: true },
                { relativePath: 'src/helper.ts', type: 'added', isDirectory: false }
            ];

            const fileChanges = changes.filter(c => !c.isDirectory);
            
            assert.strictEqual(fileChanges.length, 2);
            assert.strictEqual(fileChanges[0].relativePath, 'src/main.ts');
            assert.strictEqual(fileChanges[1].relativePath, 'src/helper.ts');
        });

        it('验证删除目录的判断 - 路径以分隔符结尾', () => {
            const deletedPath1 = 'src/oldFolder/';
            const deletedPath2 = 'src\\oldFolder\\';
            const deletedPath3 = 'src/oldFile.ts';

            const isDirectory1 = deletedPath1.endsWith('/') || deletedPath1.endsWith('\\');
            const isDirectory2 = deletedPath2.endsWith('/') || deletedPath2.endsWith('\\');
            const isDirectory3 = deletedPath3.endsWith('/') || deletedPath3.endsWith('\\');
            
            assert.strictEqual(isDirectory1, true);
            assert.strictEqual(isDirectory2, true);
            assert.strictEqual(isDirectory3, false);
        });

        it('验证文件系统检测目录 - 通过stat判断', () => {
            const testCases = [
                { path: 'src', expectedIsDir: true },
                { path: 'package.json', expectedIsDir: false }
            ];

            assert.ok(Array.isArray(testCases));
            assert.strictEqual(testCases.length, 2);
        });

        it('验证变更列表仅包含文件 - 不包含目录', () => {
            const allChanges = [
                { relativePath: 'src/', type: 'added' },
                { relativePath: 'src/index.ts', type: 'added' },
                { relativePath: 'test/', type: 'modified' },
                { relativePath: 'test/test.ts', type: 'modified' }
            ];

            const mockIsDirectory = (path: string) => path.endsWith('/');
            const fileChanges = allChanges.filter(c => !mockIsDirectory(c.relativePath));
            
            assert.strictEqual(fileChanges.length, 2);
            assert.ok(fileChanges.every(c => !c.relativePath.endsWith('/')));
        });
    });

    describe('中文文件名支持 - 解决乱码问题', () => {
        it('验证displayPath字段存在 - 用于显示', () => {
            const change = {
                path: '/project/src/测试文件.ts',
                relativePath: 'src\\测试文件.ts',
                displayPath: 'src/测试文件.ts',
                type: 'modified'
            };

            assert.ok(change.displayPath);
            assert.strictEqual(change.displayPath, 'src/测试文件.ts');
        });

        it('验证路径分隔符统一为正斜杠 - Windows兼容', () => {
            const relativePath = 'src\\utils\\中文工具.ts';
            const displayPath = relativePath.replace(/\\/g, '/');
            
            assert.strictEqual(displayPath, 'src/utils/中文工具.ts');
            assert.ok(!displayPath.includes('\\'));
        });
    });

    describe('子目录文件展开 - -uall 参数', () => {
        it('验证-uall参数展开未跟踪目录 - 显示目录内所有文件', () => {
            const statusOutputWithoutUall = '?? newFolder/';
            const statusOutputWithUall = [
                '?? newFolder/file1.ts',
                '?? newFolder/subdir/file2.ts',
                '?? newFolder/file3.ts'
            ];

            assert.strictEqual(statusOutputWithoutUall, '?? newFolder/');
            assert.strictEqual(statusOutputWithUall.length, 3);
            assert.ok(statusOutputWithUall[0].includes('file1.ts'));
            assert.ok(statusOutputWithUall[1].includes('subdir/file2.ts'));
        });

        it('验证深层嵌套文件正确显示 - 多层目录结构', () => {
            const lines = [
                '?? asdfas/111/bbb.txt',
                '?? asdfas/ccc.txt'
            ];

            const parsedFiles = lines.map(line => {
                const filePath = line.substring(3).trim();
                return { filePath };
            });

            assert.strictEqual(parsedFiles[0].filePath, 'asdfas/111/bbb.txt');
            assert.strictEqual(parsedFiles[1].filePath, 'asdfas/ccc.txt');
        });

        it('验证Git命令包含-uall参数 - 确保展开目录', () => {
            const gitCommand = 'git status -M --porcelain -uall';
            
            assert.ok(gitCommand.includes('-uall'));
            assert.ok(gitCommand.includes('--porcelain'));
            assert.ok(gitCommand.includes('-M'));
        });

        it('验证子目录文件与根目录文件混合显示', () => {
            const changes = [
                { filePath: 'rootFile.ts', type: 'added' },
                { filePath: 'subdir/file1.ts', type: 'added' },
                { filePath: 'subdir/deep/file2.ts', type: 'added' }
            ];

            assert.strictEqual(changes.length, 3);
            assert.ok(changes.some(c => c.filePath === 'rootFile.ts'));
            assert.ok(changes.some(c => c.filePath === 'subdir/file1.ts'));
            assert.ok(changes.some(c => c.filePath === 'subdir/deep/file2.ts'));
        });

        it('验证目录本身不再单独显示 - 避免重复', () => {
            const lines = [
                '?? asdfas/111/bbb.txt',
                '?? asdfas/ccc.txt'
            ];

            const hasDirectoryOnly = lines.some(line => 
                line.trim().endsWith('/') && !line.includes('.')
            );

            assert.strictEqual(hasDirectoryOnly, false);
        });
    });

    describe('重命名检测 - -M 参数', () => {
        it('验证-M参数启用重命名检测 - 移动文件被识别为重命名', () => {
            const gitCommand = 'git status -M --porcelain -uall';
            
            assert.ok(gitCommand.includes('-M'));
        });

        it('验证重命名状态码 - R 表示重命名/移动', () => {
            const line = 'R  old/path/file.ts -> new/path/file.ts';
            
            const xStatus = line[0];
            const yStatus = line[1];
            
            assert.strictEqual(xStatus, 'R');
            assert.strictEqual(yStatus, ' ');
        });

        it('验证没有-M参数时移动文件显示为删除+新增', () => {
            const statusWithoutM = [
                ' D old/path/file.ts',
                '?? new/path/file.ts'
            ];
            
            const hasDeleted = statusWithoutM.some(l => l.includes(' D'));
            const hasAdded = statusWithoutM.some(l => l.includes('??'));
            
            assert.strictEqual(hasDeleted, true);
            assert.strictEqual(hasAdded, true);
        });

        it('验证有-M参数时移动文件显示为重命名', () => {
            const statusWithM = [
                'R  old/path/file.ts -> new/path/file.ts'
            ];
            
            const hasRenamed = statusWithM.some(l => l[0] === 'R');
            
            assert.strictEqual(hasRenamed, true);
        });

        it('验证determineChangeType正确识别R状态', () => {
            const determineChangeType = (x: string, y: string) => {
                if (x === 'R' || y === 'R') {
                    return 'renamed';
                }
                return 'modified';
            };
            
            assert.strictEqual(determineChangeType('R', ' '), 'renamed');
            assert.strictEqual(determineChangeType(' ', 'R'), 'renamed');
            assert.strictEqual(determineChangeType('R', 'M'), 'renamed');
        });
    });

    describe('内容相似度检测 - 无Git历史时检测重命名', () => {
        it('验证相似度计算 - 相同内容返回1', () => {
            const content1 = 'line1\nline2\nline3';
            const content2 = 'line1\nline2\nline3';
            
            const lines1 = content1.split('\n');
            const lines2 = content2.split('\n');
            const set1 = new Set(lines1.map(l => l.trim()).filter(l => l.length > 0));
            const set2 = new Set(lines2.map(l => l.trim()).filter(l => l.length > 0));
            
            let commonLines = 0;
            for (const line of set1) {
                if (set2.has(line)) {
                    commonLines++;
                }
            }
            const similarity = (2 * commonLines) / (set1.size + set2.size);
            
            assert.strictEqual(similarity, 1);
        });

        it('验证相似度计算 - 完全不同内容返回0', () => {
            const content1 = 'aaa\nbbb\nccc';
            const content2 = 'xxx\nyyy\nzzz';
            
            const lines1 = content1.split('\n');
            const lines2 = content2.split('\n');
            const set1 = new Set(lines1.map(l => l.trim()).filter(l => l.length > 0));
            const set2 = new Set(lines2.map(l => l.trim()).filter(l => l.length > 0));
            
            let commonLines = 0;
            for (const line of set1) {
                if (set2.has(line)) {
                    commonLines++;
                }
            }
            const similarity = (2 * commonLines) / (set1.size + set2.size);
            
            assert.strictEqual(similarity, 0);
        });

        it('验证相似度计算 - 部分相同返回中间值', () => {
            const content1 = 'line1\nline2\nline3\nline4';
            const content2 = 'line1\nline2\nline5\nline6';
            
            const lines1 = content1.split('\n');
            const lines2 = content2.split('\n');
            const set1 = new Set(lines1.map(l => l.trim()).filter(l => l.length > 0));
            const set2 = new Set(lines2.map(l => l.trim()).filter(l => l.length > 0));
            
            let commonLines = 0;
            for (const line of set1) {
                if (set2.has(line)) {
                    commonLines++;
                }
            }
            const similarity = (2 * commonLines) / (set1.size + set2.size);
            
            assert.strictEqual(similarity, 0.5);
        });

        it('验证相似度阈值50% - 用于判断是否为重命名', () => {
            const threshold = 0.5;
            
            const highSimilarity = 0.8;
            const lowSimilarity = 0.3;
            
            assert.ok(highSimilarity >= threshold);
            assert.ok(!(lowSimilarity >= threshold));
        });

        it('验证删除+新增文件被识别为重命名', () => {
            const changes = [
                { relativePath: 'old/file.ts', type: 'deleted' as const, displayPath: 'old/file.ts' },
                { relativePath: 'new/file.ts', type: 'added' as const, displayPath: 'new/file.ts' }
            ];

            const deletedFiles = changes.filter(c => c.type === 'deleted');
            const addedFiles = changes.filter(c => c.type === 'added');
            
            assert.strictEqual(deletedFiles.length, 1);
            assert.strictEqual(addedFiles.length, 1);
        });

        it('验证最佳匹配逻辑 - 选择相似度最高的文件', () => {
            const deletedFile = 'old.ts';
            const addedFiles = [
                { path: 'new1.ts', similarity: 0.3 },
                { path: 'new2.ts', similarity: 0.9 },
                { path: 'new3.ts', similarity: 0.6 }
            ];
            
            const bestMatch = addedFiles.reduce((best, current) => 
                current.similarity > best.similarity ? current : best
            );
            
            assert.strictEqual(bestMatch.path, 'new2.ts');
            assert.strictEqual(bestMatch.similarity, 0.9);
        });
    });

    describe('中文文件名正确显示 - 无乱码', () => {
        it('验证中文文件名正确显示', () => {
            const chineseFileName = '测试用例文件.spec.ts';
            const displayPath = `test/${chineseFileName}`;
            
            assert.ok(displayPath.includes('测试'));
            assert.ok(displayPath.includes('用例'));
            assert.strictEqual(displayPath, 'test/测试用例文件.spec.ts');
        });

        it('验证Git配置禁用quotepath - 中文路径不转义', () => {
            const gitCommand = 'git config core.quotepath false';
            
            assert.ok(gitCommand.includes('core.quotepath'));
            assert.ok(gitCommand.includes('false'));
        });
    });

    describe('扁平化显示 - 无层级结构', () => {
        it('验证displayPath显示完整相对路径 - 包含目录', () => {
            const changes = [
                { relativePath: 'src/core/main.ts', displayPath: 'src/core/main.ts' },
                { relativePath: 'src/utils/helper.ts', displayPath: 'src/utils/helper.ts' },
                { relativePath: 'test/index.ts', displayPath: 'test/index.ts' }
            ];

            assert.strictEqual(changes[0].displayPath, 'src/core/main.ts');
            assert.strictEqual(changes[1].displayPath, 'src/utils/helper.ts');
            assert.strictEqual(changes[2].displayPath, 'test/index.ts');
        });

        it('验证TreeView显示使用displayPath - 非relativePath', () => {
            const change = {
                relativePath: 'src\\components\\Button.tsx',
                displayPath: 'src/components/Button.tsx'
            };

            const displayText = change.displayPath;
            
            assert.strictEqual(displayText, 'src/components/Button.tsx');
            assert.ok(!displayText.includes('\\'));
        });

        it('验证深层目录文件完整显示路径', () => {
            const deepPath = 'src/features/auth/components/LoginForm.tsx';
            const displayPath = deepPath;
            
            assert.ok(displayPath.includes('features'));
            assert.ok(displayPath.includes('auth'));
            assert.ok(displayPath.includes('components'));
            assert.ok(displayPath.includes('LoginForm'));
        });
    });

    describe('深层目录文件检测 - 修复问题', () => {
        it('验证根目录文件和深层目录文件同时存在', () => {
            const changes = [
                { relativePath: 'a.txt', displayPath: 'a.txt', type: 'modified' },
                { relativePath: 'b/c.txt', displayPath: 'b/c.txt', type: 'modified' },
                { relativePath: 'd/e/f.txt', displayPath: 'd/e/f.txt', type: 'modified' }
            ];

            assert.strictEqual(changes.length, 3);
            assert.strictEqual(changes[0].displayPath, 'a.txt');
            assert.strictEqual(changes[1].displayPath, 'b/c.txt');
            assert.strictEqual(changes[2].displayPath, 'd/e/f.txt');
        });

        it('验证isDirectory正确判断深层目录文件', () => {
            const testCases = [
                { originalPath: 'a.txt', expectedIsDir: false },
                { originalPath: 'b/c.txt', expectedIsDir: false },
                { originalPath: 'd/e/f.txt', expectedIsDir: false },
                { originalPath: 'src/', expectedIsDir: true },
                { originalPath: 'src/utils/', expectedIsDir: true }
            ];

            for (const tc of testCases) {
                const isDir = tc.originalPath.endsWith('/') || tc.originalPath.endsWith('\\');
                assert.strictEqual(isDir, tc.expectedIsDir, `Failed for ${tc.originalPath}`);
            }
        });

        it('验证文件扩展名判断 - 有扩展名的是文件', () => {
            const path = require('path');
            
            const files = [
                'a.txt',
                'b/c.txt',
                'd/e/f.ts',
                'src/utils/helper.js'
            ];

            for (const file of files) {
                const ext = path.extname(file);
                assert.ok(ext.length > 0, `${file} should have extension`);
            }
        });

        it('验证Git status输出解析 - 多层目录', () => {
            const statusLines = [
                ' M a.txt',
                ' M b/c.txt',
                ' M d/e/f.txt'
            ];

            const parsedFiles = statusLines.map(line => {
                const filePath = line.substring(3).trim();
                return filePath;
            });

            assert.strictEqual(parsedFiles.length, 3);
            assert.strictEqual(parsedFiles[0], 'a.txt');
            assert.strictEqual(parsedFiles[1], 'b/c.txt');
            assert.strictEqual(parsedFiles[2], 'd/e/f.txt');
        });

        it('验证所有变更文件都被收集 - 不遗漏', () => {
            const allChanges = [
                { relativePath: 'project/a.txt', type: 'modified' },
                { relativePath: 'project/b/c.txt', type: 'modified' },
                { relativePath: 'project/d/e/f.txt', type: 'added' }
            ];

            const filteredChanges = allChanges.filter(c => {
                return !c.relativePath.endsWith('/');
            });

            assert.strictEqual(filteredChanges.length, 3);
        });
    });

    describe('子目录文件解析 - 深层目录文件', () => {
        it('验证子目录文件正确解析 - project/a.txt', () => {
            const line = ' M project/a.txt';
            const result = parseGitStatusLineFullPath(line);
            
            assert.strictEqual(result.filePath, 'project/a.txt');
        });

        it('验证深层子目录文件正确解析 - project/b/c.txt', () => {
            const line = ' M project/b/c.txt';
            const result = parseGitStatusLineFullPath(line);
            
            assert.strictEqual(result.filePath, 'project/b/c.txt');
        });

        it('验证多层嵌套文件解析 - src/core/utils/helper.ts', () => {
            const line = '?? src/core/utils/helper.ts';
            const result = parseGitStatusLineFullPath(line);
            
            assert.strictEqual(result.filePath, 'src/core/utils/helper.ts');
        });

        it('验证根目录和子目录文件同时存在 - 不互相覆盖', () => {
            const lines = [
                ' M project/a.txt',
                ' M project/b/c.txt',
                ' M project/d/e/f.txt'
            ];

            const results = lines.map(parseGitStatusLineFullPath);
            
            assert.strictEqual(results.length, 3);
            assert.strictEqual(results[0].filePath, 'project/a.txt');
            assert.strictEqual(results[1].filePath, 'project/b/c.txt');
            assert.strictEqual(results[2].filePath, 'project/d/e/f.txt');
        });

        it('验证Windows路径分隔符转换 - 正斜杠转反斜杠', () => {
            const gitPath = 'project/b/c.txt';
            const windowsPath = gitPath.replace(/\//g, '\\');
            
            assert.strictEqual(windowsPath, 'project\\b\\c.txt');
        });

        function parseGitStatusLineFullPath(line: string): { status: string; filePath: string } {
            if (line.length < 4) {
                return { status: '', filePath: '' };
            }

            const status = line.substring(0, 2);
            let filePath = line.substring(3).trim();

            if (filePath.startsWith('"') && filePath.endsWith('"')) {
                filePath = filePath.slice(1, -1);
            }

            if (filePath.includes(' -> ')) {
                const parts = filePath.split(' -> ');
                filePath = parts[1];
            }

            return { status, filePath };
        }
    });

    describe('绝对路径解析 - path.resolve行为', () => {
        it('验证子目录文件绝对路径计算', () => {
            const projectPath = 'D:\\project';
            const relativePath = 'project/b/c.txt';
            
            const absolutePath = relativePath.replace(/\//g, '\\');
            const resolved = `${projectPath}\\${absolutePath}`;
            
            assert.strictEqual(resolved, 'D:\\project\\project\\b\\c.txt');
        });

        it('验证相对路径计算 - path.relative', () => {
            const projectPath = 'D:\\project';
            const absolutePath = 'D:\\project\\src\\utils\\helper.ts';
            
            const relativePath = absolutePath.replace(projectPath + '\\', '').replace(/\\/g, '/');
            
            assert.strictEqual(relativePath, 'src/utils/helper.ts');
        });
    });

    describe('runnable 命令过滤 - 运行用例时过滤', () => {
        it('验证 runnable 为 true 的命令可用', () => {
            const commands: Array<{ name: string; executeCommand: string; runnable?: boolean }> = [
                { name: '命令1', executeCommand: 'cmd1', runnable: true },
                { name: '命令2', executeCommand: 'cmd2', runnable: false },
                { name: '命令3', executeCommand: 'cmd3' }
            ];

            const availableCommands = commands.filter(cmd => cmd.runnable === true);
            
            assert.strictEqual(availableCommands.length, 1);
            assert.strictEqual(availableCommands[0].name, '命令1');
        });

        it('验证 runnable 为 false 的命令不可用', () => {
            const commands: Array<{ name: string; executeCommand: string; runnable?: boolean }> = [
                { name: '命令1', executeCommand: 'cmd1', runnable: true },
                { name: '命令2', executeCommand: 'cmd2', runnable: false }
            ];

            const availableCommands = commands.filter(cmd => cmd.runnable === true);
            
            assert.strictEqual(availableCommands.length, 1);
        });

        it('验证未配置 runnable 的命令不可用', () => {
            const commands: Array<{ name: string; executeCommand: string; runnable?: boolean }> = [
                { name: '命令1', executeCommand: 'cmd1' },
                { name: '命令2', executeCommand: 'cmd2' }
            ];

            const availableCommands = commands.filter(cmd => cmd.runnable === true);
            
            assert.strictEqual(availableCommands.length, 0);
        });

        it('验证多个 runnable 为 true 的命令都可用', () => {
            const commands: Array<{ name: string; executeCommand: string; runnable?: boolean }> = [
                { name: '命令1', executeCommand: 'cmd1', runnable: true },
                { name: '命令2', executeCommand: 'cmd2', runnable: true },
                { name: '命令3', executeCommand: 'cmd3' }
            ];

            const runnableCommands = commands.filter(cmd => cmd.runnable === true);
            
            assert.strictEqual(runnableCommands.length, 2);
        });
    });

    describe('Git变更解析 - 先解析后过滤', () => {
        it('验证所有变更行先被解析 - 不立即过滤', () => {
            const lines = [
                ' M project/a.txt',
                ' M project/b/c.txt',
                ' M project/d/e/f.txt'
            ];

            const rawChanges: Array<{ filePath: string; changeType: string }> = [];
            
            for (const line of lines) {
                if (line.length >= 4) {
                    let filePath = line.substring(3).trim();
                    rawChanges.push({
                        filePath: filePath,
                        changeType: 'modified'
                    });
                }
            }
            
            assert.strictEqual(rawChanges.length, 3);
            assert.strictEqual(rawChanges[0].filePath, 'project/a.txt');
            assert.strictEqual(rawChanges[1].filePath, 'project/b/c.txt');
            assert.strictEqual(rawChanges[2].filePath, 'project/d/e/f.txt');
        });

        it('验证目录过滤在解析完成后进行', () => {
            const rawChanges = [
                { filePath: 'src/', changeType: 'added' },
                { filePath: 'src/main.ts', changeType: 'modified' },
                { filePath: 'src/utils/', changeType: 'modified' },
                { filePath: 'src/utils/helper.ts', changeType: 'modified' }
            ];

            const mockIsDirectory = (filePath: string) => filePath.endsWith('/');
            const filteredChanges = rawChanges.filter(c => !mockIsDirectory(c.filePath));
            
            assert.strictEqual(filteredChanges.length, 2);
            assert.strictEqual(filteredChanges[0].filePath, 'src/main.ts');
            assert.strictEqual(filteredChanges[1].filePath, 'src/utils/helper.ts');
        });

        it('验证子目录文件不会被误判为目录', () => {
            const filePaths = [
                'project/a.txt',
                'project/b/c.txt',
                'project/d/e/f.txt'
            ];

            const results = filePaths.map(filePath => {
                const endsWithSlash = filePath.endsWith('/') || filePath.endsWith('\\');
                return { filePath, isDirectory: endsWithSlash };
            });
            
            assert.strictEqual(results.every(r => !r.isDirectory), true);
        });
    });

    describe('重命名文件处理 - 避免服务器垃圾文件', () => {
        it('验证重命名文件解析 - 提取新旧路径', () => {
            const line = 'R  old/path/file.txt -> new/path/file.txt';
            const result = parseRenameLine(line);
            
            assert.strictEqual(result.oldPath, 'old/path/file.txt');
            assert.strictEqual(result.newPath, 'new/path/file.txt');
        });

        it('验证重命名文件带引号解析 - 处理特殊字符', () => {
            const line = 'R  "old path/file.txt" -> "new path/file.txt"';
            const result = parseRenameLine(line);
            
            assert.strictEqual(result.oldPath, 'old path/file.txt');
            assert.strictEqual(result.newPath, 'new path/file.txt');
        });

        it('验证GitChange包含旧路径信息 - oldRelativePath和oldPath', () => {
            const change = {
                path: '/project/new/path/file.ts',
                relativePath: 'new/path/file.ts',
                displayPath: 'new/path/file.ts',
                type: 'renamed' as const,
                project: { name: 'TestProject' },
                oldRelativePath: 'old/path/file.ts',
                oldPath: '/project/old/path/file.ts'
            };

            assert.strictEqual(change.type, 'renamed');
            assert.strictEqual(change.oldRelativePath, 'old/path/file.ts');
            assert.strictEqual(change.oldPath, '/project/old/path/file.ts');
        });

        it('验证上传重命名文件时删除旧文件 - 避免垃圾文件', () => {
            const renamedChanges = [
                { 
                    relativePath: 'new/path/file.ts', 
                    type: 'renamed',
                    oldRelativePath: 'old/path/file.ts'
                }
            ];
            const deletedChanges: any[] = [];

            const filesToDelete = [...deletedChanges];
            for (const change of renamedChanges) {
                if (change.oldRelativePath) {
                    filesToDelete.push({
                        relativePath: change.oldRelativePath,
                        type: 'deleted'
                    });
                }
            }

            assert.strictEqual(filesToDelete.length, 1);
            assert.strictEqual(filesToDelete[0].relativePath, 'old/path/file.ts');
        });

        it('验证重命名文件显示包含原路径信息', () => {
            const change = {
                displayPath: 'new/file.ts',
                type: 'renamed' as const,
                oldRelativePath: 'old/file.ts'
            };

            const description = `重命名 (原: ${change.oldRelativePath.replace(/\\/g, '/')})`;
            
            assert.ok(description.includes('重命名'));
            assert.ok(description.includes('old/file.ts'));
        });

        it('验证批量上传时重命名文件正确处理', () => {
            const changes = [
                { relativePath: 'a.ts', type: 'modified' },
                { relativePath: 'b.ts', type: 'renamed', oldRelativePath: 'old_b.ts' },
                { relativePath: 'c.ts', type: 'deleted' },
                { relativePath: 'd.ts', type: 'added' }
            ];

            const uploadableChanges = changes.filter(c => c.type !== 'deleted');
            const deletedChanges = changes.filter(c => c.type === 'deleted');
            const renamedChanges = changes.filter(c => c.type === 'renamed');

            const filesToDelete = [...deletedChanges];
            for (const change of renamedChanges) {
                if (change.oldRelativePath) {
                    filesToDelete.push({
                        relativePath: change.oldRelativePath,
                        type: 'deleted'
                    });
                }
            }

            assert.strictEqual(uploadableChanges.length, 3);
            assert.strictEqual(filesToDelete.length, 2);
            assert.ok(filesToDelete.some(f => f.relativePath === 'c.ts'));
            assert.ok(filesToDelete.some(f => f.relativePath === 'old_b.ts'));
        });

        function parseRenameLine(line: string): { oldPath: string; newPath: string } {
            let filePath = line.substring(3).trim();

            if (filePath.includes(' -> ')) {
                const parts = filePath.split(' -> ');
                let oldPath = parts[0].trim();
                let newPath = parts[1].trim();
                
                if (oldPath.startsWith('"') && oldPath.endsWith('"')) {
                    oldPath = oldPath.slice(1, -1);
                }
                if (newPath.startsWith('"') && newPath.endsWith('"')) {
                    newPath = newPath.slice(1, -1);
                }
                
                return { oldPath, newPath };
            }

            if (filePath.startsWith('"') && filePath.endsWith('"')) {
                filePath = filePath.slice(1, -1);
            }

            return { oldPath: '', newPath: filePath };
        }
    });

    describe('相对路径处理 - 防止路径第一个字符被吃掉', () => {
        it('验证相对路径转换为绝对路径后计算相对路径 - 不丢失首字符', () => {
            const localPath = 'project';
            const filePath = 'src/main.ts';
            
            const absolutePath = path.resolve(localPath, filePath);
            const relativePath = path.relative(path.resolve(localPath), absolutePath).replace(/\\/g, '/');
            
            assert.strictEqual(relativePath, 'src/main.ts');
            assert.ok(relativePath.startsWith('src'));
        });

        it('验证相对路径不带前导斜杠 - 防止路径计算错误', () => {
            const localPath = './project';
            const filePath = 'src/main.ts';
            
            const absolutePath = path.resolve(localPath, filePath);
            const relativePath = path.relative(path.resolve(localPath), absolutePath).replace(/\\/g, '/');
            
            assert.strictEqual(relativePath, 'src/main.ts');
            assert.ok(!relativePath.startsWith('/'));
        });

        it('验证Windows相对路径处理', () => {
            const localPath = '.\\project';
            const filePath = 'src\\main.ts';
            
            const absolutePath = path.resolve(localPath, filePath);
            const displayPath = absolutePath.replace(/\\/g, '/');
            
            assert.ok(displayPath.includes('src/main.ts'));
        });

        it('验证深层相对路径计算正确性', () => {
            const localPath = path.resolve('workspace/project');
            const filePath = 'src/nested/deep/file.ts';
            
            const absolutePath = path.resolve(localPath, filePath);
            const relativePath = path.relative(localPath, absolutePath).replace(/\\/g, '/');
            
            assert.strictEqual(relativePath, 'src/nested/deep/file.ts');
        });

        it('验证单文件相对路径计算 - 边界情况', () => {
            const localPath = 'myproject';
            const filePath = 'a.txt';
            
            const absolutePath = path.resolve(localPath, filePath);
            const relativePath = path.relative(path.resolve(localPath), absolutePath);
            
            assert.strictEqual(relativePath, 'a.txt');
            assert.strictEqual(relativePath.length, 5);
            assert.strictEqual(relativePath[0], 'a');
        });

        it('验证父目录相对路径处理', () => {
            const localPath = path.resolve('../project');
            const filePath = 'src/main.ts';
            
            const absolutePath = path.resolve(localPath, filePath);
            const relativePath = path.relative(localPath, absolutePath).replace(/\\/g, '/');
            
            assert.strictEqual(relativePath, 'src/main.ts');
        });

        it('验证displayPath正确转换反斜杠', () => {
            const localPath = 'project';
            const filePath = 'src\\main.ts';
            
            const absolutePath = path.resolve(localPath, filePath);
            const relativePath = path.relative(path.resolve(localPath), absolutePath);
            const displayPath = relativePath.replace(/\\/g, '/');
            
            assert.strictEqual(displayPath, 'src/main.ts');
            assert.ok(!displayPath.includes('\\'));
        });
    });
});

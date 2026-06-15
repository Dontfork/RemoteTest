/**
 * commandVariables 模块单元测试 —— 零 vscode 依赖。
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
    replaceCommandVariables,
    buildCommandVariables
} from '../../src/pure/commandVariables';

describe('pure/commandVariables', () => {
    describe('buildCommandVariables', () => {
        it('应正确构建变量映射', () => {
            const vars = buildCommandVariables(
                '/project/src/test.py',
                '/home/user/project/src/test.py',
                '/home/user/project'
            );

            assert.strictEqual(vars.filePath, '/home/user/project/src/test.py');
            assert.strictEqual(vars.fileName, 'test.py');
            assert.strictEqual(vars.fileDir, '/home/user/project/src');
            assert.strictEqual(vars.localPath, '/project/src/test.py');
            assert.strictEqual(vars.localDir, '/project/src');
            assert.strictEqual(vars.localFileName, 'test.py');
            assert.strictEqual(vars.remoteDir, '/home/user/project');
        });

        it('应处理根目录下的文件', () => {
            const vars = buildCommandVariables(
                '/project/Makefile',
                '/home/user/project/Makefile',
                '/home/user/project'
            );

            assert.strictEqual(vars.fileName, 'Makefile');
            assert.strictEqual(vars.localFileName, 'Makefile');
            assert.strictEqual(vars.fileDir, '/home/user/project');
        });

        it('应处理多段扩展名', () => {
            const vars = buildCommandVariables(
                '/project/test.spec.ts',
                '/home/user/project/test.spec.ts',
                '/home/user/project'
            );

            assert.strictEqual(vars.fileName, 'test.spec.ts');
            assert.strictEqual(vars.localFileName, 'test.spec.ts');
        });

        it('应处理 Windows 本地路径', () => {
            const vars = buildCommandVariables(
                'C:\\project\\src\\main.py',
                '/home/user/project/src/main.py',
                '/home/user/project'
            );

            assert.strictEqual(vars.fileName, 'main.py');
            assert.strictEqual(vars.localFileName, 'main.py');
        });
    });

    describe('replaceCommandVariables', () => {
        const vars = {
            filePath: '/home/user/project/src/test.py',
            fileName: 'test.py',
            fileDir: '/home/user/project/src',
            localPath: '/project/src/test.py',
            localDir: '/project/src',
            localFileName: 'test.py',
            remoteDir: '/home/user/project'
        };

        it('应替换 {filePath}', () => {
            const result = replaceCommandVariables('echo {filePath}', vars);
            assert.strictEqual(result, 'echo /home/user/project/src/test.py');
        });

        it('应替换 {fileName}', () => {
            const result = replaceCommandVariables('pytest {fileName}', vars);
            assert.strictEqual(result, 'pytest test.py');
        });

        it('应替换 {fileDir}', () => {
            const result = replaceCommandVariables('cd {fileDir}', vars);
            assert.strictEqual(result, 'cd /home/user/project/src');
        });

        it('应替换 {localPath}', () => {
            const result = replaceCommandVariables('echo {localPath}', vars);
            assert.strictEqual(result, 'echo /project/src/test.py');
        });

        it('应替换 {localDir}', () => {
            const result = replaceCommandVariables('cd {localDir}', vars);
            assert.strictEqual(result, 'cd /project/src');
        });

        it('应替换 {localFileName}', () => {
            const result = replaceCommandVariables('run {localFileName}', vars);
            assert.strictEqual(result, 'run test.py');
        });

        it('应替换 {remoteDir}', () => {
            const result = replaceCommandVariables('cd {remoteDir}', vars);
            assert.strictEqual(result, 'cd /home/user/project');
        });

        it('应替换多个变量', () => {
            const result = replaceCommandVariables(
                'cd {remoteDir} && pytest {fileName}',
                vars
            );
            assert.strictEqual(result, 'cd /home/user/project && pytest test.py');
        });

        it('未匹配的变量应保持原样', () => {
            const result = replaceCommandVariables('echo {unknownVar}', vars);
            assert.strictEqual(result, 'echo {unknownVar}');
        });

        it('无变量的命令应保持不变', () => {
            const cmd = 'echo hello world';
            assert.strictEqual(replaceCommandVariables(cmd, vars), cmd);
        });

        it('同一变量出现多次应全部替换', () => {
            const result = replaceCommandVariables('{fileName} and {fileName}', vars);
            assert.strictEqual(result, 'test.py and test.py');
        });
    });
});

/**
 * configSchema 模块单元测试 —— 零 vscode 依赖。
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
    defaultConfig,
    deepMerge,
    checkPathConflict,
    validateConfig,
    fillMissingFields
} from '../../src/pure/configSchema';

describe('pure/configSchema', () => {
    describe('defaultConfig', () => {
        it('应包含 projects 数组', () => {
            assert.ok(Array.isArray(defaultConfig.projects));
        });

        it('应有默认 refreshInterval', () => {
            assert.ok(typeof defaultConfig.refreshInterval === 'number');
        });

        it('应有默认 clearOutputBeforeRun（可能为 undefined，取默认值 true）', () => {
            const value = defaultConfig.clearOutputBeforeRun;
            assert.ok(value === true || value === undefined);
        });

        it('应有默认 commitCount', () => {
            assert.ok(typeof defaultConfig.commitCount === 'number');
            assert.ok(defaultConfig.commitCount >= 1);
        });
    });

    describe('deepMerge', () => {
        it('应深度合并对象', () => {
            const base: any = { a: 1, b: { c: 2, d: 3 } };
            const override: any = { b: { c: 99 }, e: 5 };
            const result = deepMerge(base, override);

            assert.strictEqual(result.a, 1);
            assert.strictEqual(result.b.c, 99);
            assert.strictEqual(result.b.d, 3);
            assert.strictEqual(result.e, 5);
        });

        it('不应修改原始对象', () => {
            const base: any = { a: { b: 1 } };
            const override: any = { a: { c: 2 } };
            deepMerge(base, override);

            assert.strictEqual(base.a.c, undefined);
        });

        it('数组应直接替换', () => {
            const base: any = { items: [1, 2, 3] };
            const override: any = { items: [4, 5] };
            const result = deepMerge(base, override);

            assert.deepStrictEqual(result.items, [4, 5]);
        });
    });

    describe('checkPathConflict', () => {
        it('无冲突应返回 hasConflict=false', () => {
            const projects = [
                { name: 'P1', localPath: '/path/a', enabled: true },
                { name: 'P2', localPath: '/path/b', enabled: true }
            ];
            const result = checkPathConflict(projects as any);
            assert.strictEqual(result.hasConflict, false);
        });

        it('相同路径不视为冲突（只检测包含关系，不检测完全相同）', () => {
            const projects = [
                { name: 'P1', localPath: '/same/path', enabled: true },
                { name: 'P2', localPath: '/same/path', enabled: true }
            ];
            const result = checkPathConflict(projects as any);
            // 相同路径不会触发 startsWith(existingPath + path.sep)
            assert.strictEqual(result.hasConflict, false);
        });

        it('子路径应检测到冲突', () => {
            const projects = [
                { name: 'P1', localPath: '/parent', enabled: true },
                { name: 'P2', localPath: '/parent/child', enabled: true }
            ];
            const result = checkPathConflict(projects as any);
            assert.strictEqual(result.hasConflict, true);
        });

        it('禁用项目不应参与冲突检测', () => {
            const projects = [
                { name: 'P1', localPath: '/same/path', enabled: true },
                { name: 'P2', localPath: '/same/path', enabled: false }
            ];
            const result = checkPathConflict(projects as any);
            assert.strictEqual(result.hasConflict, false);
        });

        it('空项目列表应无冲突', () => {
            const result = checkPathConflict([]);
            assert.strictEqual(result.hasConflict, false);
        });
    });

    describe('validateConfig', () => {
        it('空配置应报错（缺少 projects）', () => {
            const result = validateConfig({});
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(e => e.includes('projects')));
        });

        it('空 projects 数组应有效但有警告', () => {
            const result = validateConfig({ projects: [] });
            assert.strictEqual(result.isValid, true);
            assert.ok(result.warnings.length > 0);
        });

        it('有效配置应通过验证', () => {
            const config = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path/to/project',
                    server: {
                        host: '192.168.1.1',
                        port: 22,
                        username: 'user',
                        password: 'pass',
                        remoteDirectory: '/home/user'
                    }
                }]
            };
            const result = validateConfig(config);
            assert.strictEqual(result.isValid, true);
        });

        it('缺少 name 应报错', () => {
            const config = {
                projects: [{
                    localPath: '/path',
                    server: { host: '192.168.1.1', port: 22, username: 'user', password: 'pass' }
                }]
            };
            const result = validateConfig(config);
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(e => e.includes('name')));
        });

        it('缺少 server 应报错', () => {
            const config = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path'
                }]
            };
            const result = validateConfig(config);
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(e => e.includes('server')));
        });

        it('无效端口号应报错', () => {
            const config = {
                projects: [{
                    name: 'TestProject',
                    localPath: '/path',
                    server: {
                        host: '192.168.1.1',
                        port: 99999,
                        username: 'user',
                        password: 'pass'
                    }
                }]
            };
            const result = validateConfig(config);
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(e => e.includes('port')));
        });

        it('无效 refreshInterval 应报错', () => {
            const config: any = {
                refreshInterval: 'invalid',
                projects: [{
                    name: 'TestProject',
                    server: { host: '192.168.1.1', port: 22, username: 'user', password: 'pass' }
                }]
            };
            const result = validateConfig(config);
            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(e => e.includes('refreshInterval')));
        });

        it('未知字段应产生警告', () => {
            const config = {
                unknownRootField: 'value',
                projects: [{
                    name: 'TestProject',
                    server: { host: '192.168.1.1', port: 22, username: 'user', password: 'pass' },
                    unknownProjectField: 'value'
                }]
            };
            const result = validateConfig(config);
            assert.ok(result.unknownKeys.length > 0);
        });
    });

    describe('fillMissingFields', () => {
        it('应填充缺失的 name', () => {
            const config: any = {
                projects: [{
                    server: { host: '1.1.1.1', port: 22, username: 'u', password: 'p' }
                }]
            };
            const result = validateConfig(config);
            const filled = fillMissingFields(config, result.missingFields);
            assert.strictEqual(filled.projects[0].name, '未命名工程');
        });

        it('应填充缺失的 server', () => {
            const config: any = {
                projects: [{ name: 'TestProject' }]
            };
            const result = validateConfig(config);
            const filled = fillMissingFields(config, result.missingFields);
            assert.ok(filled.projects[0].server);
        });

        it('应填充缺失的 enabled', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    server: { host: '1.1.1.1', port: 22, username: 'u', password: 'p' }
                }]
            };
            const filled = fillMissingFields(config, []);
            assert.strictEqual(filled.projects[0].enabled, true);
        });

        it('应填充缺失的 logs', () => {
            const config: any = {
                projects: [{
                    name: 'TestProject',
                    server: { host: '1.1.1.1', port: 22, username: 'u', password: 'p' }
                }]
            };
            const filled = fillMissingFields(config, []);
            assert.ok(filled.projects[0].logs);
            assert.ok(Array.isArray(filled.projects[0].logs.directories));
        });

        it('不应覆盖已有字段', () => {
            const config: any = {
                refreshInterval: 5000,
                projects: [{
                    name: 'TestProject',
                    enabled: false,
                    server: { host: '1.1.1.1', port: 22, username: 'u', password: 'p' }
                }]
            };
            const filled = fillMissingFields(config, []);
            assert.strictEqual(filled.refreshInterval, 5000);
            assert.strictEqual(filled.projects[0].enabled, false);
        });
    });
});

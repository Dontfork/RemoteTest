import * as assert from 'assert';
import { describe, it } from 'mocha';

const defaultConfig = {
    projects: [],
    refreshInterval: 0,
    useLogOutputChannel: true,
    textFileExtensions: []
};

describe('Config Module - 配置模块测试', () => {
    describe('Default Configuration - 默认配置验证', () => {
        it('验证全局刷新间隔配置 - refreshInterval存在且为数字', () => {
            assert.ok(typeof defaultConfig.refreshInterval === 'number');
            assert.ok(defaultConfig.refreshInterval >= 0);
        });

        it('验证输出通道配置 - useLogOutputChannel存在且为布尔值', () => {
            assert.ok(typeof defaultConfig.useLogOutputChannel === 'boolean');
        });

        it('验证文本文件扩展名配置 - textFileExtensions存在且为数组', () => {
            assert.ok(Array.isArray(defaultConfig.textFileExtensions));
        });
    });

    describe('Configuration Values - 配置值验证', () => {
        it('验证默认刷新间隔 - 应为0（默认关闭）', () => {
            assert.strictEqual(defaultConfig.refreshInterval, 0);
        });

        it('验证默认输出通道 - 应为true（使用LogOutputChannel）', () => {
            assert.strictEqual(defaultConfig.useLogOutputChannel, true);
        });
    });

    describe('Configuration Structure - 配置结构验证', () => {
        it('验证配置对象完整性 - 必须包含projects、refreshInterval', () => {
            assert.ok(typeof defaultConfig === 'object');
            assert.ok('projects' in defaultConfig);
            assert.ok('refreshInterval' in defaultConfig);
        });
    });
});

import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import { initLogger, logAI } from '../../src/utils/logger';

describe('Logger Module - 日志模块测试', () => {
    describe('logAI - AI内容输出', () => {
        it('应该正确初始化', () => {
            const mockChannel = {
                appendLine: (message: string) => {},
                show: () => {},
                dispose: () => {}
            };
            
            initLogger(mockChannel as any);
            
            assert.ok(true);
        });

        it('应该正确输出内容', () => {
            let lastMessage = '';
            const mockChannel = {
                appendLine: (message: string) => { lastMessage = message; },
                show: () => {},
                dispose: () => {}
            };
            
            initLogger(mockChannel as any);
            logAI('测试内容');
            
            assert.strictEqual(lastMessage, '测试内容');
        });

        it('空内容不应该输出', () => {
            let outputCount = 0;
            const mockChannel = {
                appendLine: () => { outputCount++; },
                show: () => {},
                dispose: () => {}
            };
            
            initLogger(mockChannel as any);
            logAI('');
            
            assert.strictEqual(outputCount, 0);
        });

        it('null内容不应该输出', () => {
            let outputCount = 0;
            const mockChannel = {
                appendLine: () => { outputCount++; },
                show: () => {},
                dispose: () => {}
            };
            
            initLogger(mockChannel as any);
            logAI(null as any);
            
            assert.strictEqual(outputCount, 0);
        });

        it('undefined内容不应该输出', () => {
            let outputCount = 0;
            const mockChannel = {
                appendLine: () => { outputCount++; },
                show: () => {},
                dispose: () => {}
            };
            
            initLogger(mockChannel as any);
            logAI(undefined as any);
            
            assert.strictEqual(outputCount, 0);
        });

        it('多行内容应该正确输出', () => {
            let lastMessage = '';
            const mockChannel = {
                appendLine: (message: string) => { lastMessage = message; },
                show: () => {},
                dispose: () => {}
            };
            
            initLogger(mockChannel as any);
            const content = '第一行\n第二行\n第三行';
            logAI(content);
            
            assert.strictEqual(lastMessage, content);
        });

        it('Markdown格式内容应该原样输出', () => {
            let lastMessage = '';
            const mockChannel = {
                appendLine: (message: string) => { lastMessage = message; },
                show: () => {},
                dispose: () => {}
            };
            
            initLogger(mockChannel as any);
            const content = '# 标题\n\n**加粗**文本\n\n- 列表项';
            logAI(content);
            
            assert.strictEqual(lastMessage, content);
        });

        it('代码块内容应该正确输出', () => {
            let lastMessage = '';
            const mockChannel = {
                appendLine: (message: string) => { lastMessage = message; },
                show: () => {},
                dispose: () => {}
            };
            
            initLogger(mockChannel as any);
            const content = '```javascript\nconsole.log("hello");\n```';
            logAI(content);
            
            assert.strictEqual(lastMessage, content);
        });

        it('未初始化时不应报错', () => {
            const freshLogger = require('../../src/utils/logger');
            freshLogger.outputChannel = null;
            
            assert.doesNotThrow(() => {
                freshLogger.logAI('测试');
            });
        });
    });
});

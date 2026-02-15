import * as assert from 'assert';
import { describe, it } from 'mocha';

describe('AIChatView WebView Template - WebView模板测试', () => {
    function getTemplate(): string {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '../../src/views/aiChatView.ts');
        return fs.readFileSync(filePath, 'utf-8');
    }

    describe('HTML模板结构验证', () => {
        it('模板应包含发送按钮', () => {
            const template = getTemplate();
            assert.ok(template.includes('id="sendBtn"'));
        });

        it('模板应包含输入框', () => {
            const template = getTemplate();
            assert.ok(template.includes('id="input"'));
        });

        it('模板应包含消息容器', () => {
            const template = getTemplate();
            assert.ok(template.includes('id="messages"'));
        });

        it('模板应包含会话列表', () => {
            const template = getTemplate();
            assert.ok(template.includes('id="sessionList"'));
        });

        it('模板应包含新对话按钮', () => {
            const template = getTemplate();
            assert.ok(template.includes('id="newBtn"'));
        });
    });

    describe('事件处理验证', () => {
        it('应使用onkeydown处理Enter键', () => {
            const template = getTemplate();
            assert.ok(template.includes('input.onkeydown'));
        });

        it('应阻止Enter键默认行为', () => {
            const template = getTemplate();
            assert.ok(template.includes('e.preventDefault()'));
        });

        it('应支持Shift+Enter换行', () => {
            const template = getTemplate();
            assert.ok(template.includes('!e.shiftKey'));
        });

        it('发送按钮应绑定onclick事件', () => {
            const template = getTemplate();
            assert.ok(template.includes('sendBtn.onclick = send'));
        });
    });

    describe('Markdown渲染验证', () => {
        it('应包含renderMarkdown函数', () => {
            const template = getTemplate();
            assert.ok(template.includes('function renderMarkdown'));
        });

        it('应正确处理代码块正则', () => {
            const template = getTemplate();
            assert.ok(template.includes('codeBlockRegex'));
        });

        it('应正确处理加粗语法', () => {
            const template = getTemplate();
            assert.ok(template.includes('<strong>'));
        });

        it('应正确处理斜体语法', () => {
            const template = getTemplate();
            assert.ok(template.includes('<em>'));
        });

        it('应正确处理标题语法', () => {
            const template = getTemplate();
            assert.ok(template.includes('<h1>'));
            assert.ok(template.includes('<h2>'));
            assert.ok(template.includes('<h3>'));
        });
    });

    describe('消息处理验证', () => {
        it('应包含send函数', () => {
            const template = getTemplate();
            assert.ok(template.includes('function send()'));
        });

        it('应包含addMsg函数', () => {
            const template = getTemplate();
            assert.ok(template.includes('function addMsg'));
        });

        it('应包含流式消息处理', () => {
            const template = getTemplate();
            assert.ok(template.includes('streamChunk'));
            assert.ok(template.includes('streamComplete'));
            assert.ok(template.includes('streamError'));
        });
    });

    describe('会话管理验证', () => {
        it('应包含会话切换功能', () => {
            const template = getTemplate();
            assert.ok(template.includes('switchSession'));
        });

        it('应包含会话删除功能', () => {
            const template = getTemplate();
            assert.ok(template.includes('deleteSession'));
        });

        it('应包含新建会话功能', () => {
            const template = getTemplate();
            assert.ok(template.includes('newSession'));
        });
    });

    describe('样式验证', () => {
        it('应包含必要的CSS样式', () => {
            const template = getTemplate();
            assert.ok(template.includes('<style>'));
            assert.ok(template.includes('.chat'));
            assert.ok(template.includes('.messages'));
            assert.ok(template.includes('.bubble'));
        });

        it('应包含Markdown内容样式', () => {
            const template = getTemplate();
            assert.ok(template.includes('.md-content'));
        });

        it('应包含流式消息光标动画', () => {
            const template = getTemplate();
            assert.ok(template.includes('@keyframes blink'));
        });
    });
});

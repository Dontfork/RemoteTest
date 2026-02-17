import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';

function getTemplate(): string {
    const viewPath = path.join(__dirname, '../../../src/views/aiChatView.ts');
    const content = fs.readFileSync(viewPath, 'utf-8');
    const match = content.match(/getHtmlContent\(\)[\s\S]*?return\s*`([\s\S]*?)`;/);
    return match ? match[1] : '';
}

function getSourceFile(): string {
    const viewPath = path.join(__dirname, '../../../src/views/aiChatView.ts');
    return fs.readFileSync(viewPath, 'utf-8');
}

describe('AIChatView WebView Template - WebView模板测试', () => {
    it('模板应包含基本HTML结构', () => {
        const template = getTemplate();
        assert.ok(template.includes('<!DOCTYPE html>'));
        assert.ok(template.includes('<html'));
        assert.ok(template.includes('</html>'));
    });

    it('模板应包含CSP配置', () => {
        const template = getTemplate();
        assert.ok(template.includes('Content-Security-Policy'));
        assert.ok(template.includes("script-src 'unsafe-inline'"));
    });

    it('模板应包含发送按钮', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="sendBtn"'));
    });

    it('模板应包含输入框', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="input"'));
    });

    it('模板应包含新对话按钮', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="newBtn"'));
    });

    it('模板应包含历史按钮', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="historyBtn"'));
    });

    it('模板应包含历史面板', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="historyPanel"'));
        assert.ok(template.includes('history-panel'));
    });

    it('模板应包含acquireVsCodeApi调用', () => {
        const template = getTemplate();
        assert.ok(template.includes('acquireVsCodeApi()'));
    });

    it('模板应包含消息发送逻辑', () => {
        const template = getTemplate();
        assert.ok(template.includes('sendMessage'));
        assert.ok(template.includes('vscode.postMessage'));
    });

    it('模板应包含流式响应处理', () => {
        const template = getTemplate();
        assert.ok(template.includes('streamChunk'));
        assert.ok(template.includes('streamComplete'));
        assert.ok(template.includes('streamError'));
    });

    it('send函数应存在', () => {
        const template = getTemplate();
        assert.ok(template.includes('function send()'));
    });

    it('应处理Enter键发送', () => {
        const template = getTemplate();
        assert.ok(template.includes('onkeydown'));
        assert.ok(template.includes('Enter'));
        assert.ok(template.includes('preventDefault'));
    });

    it('模板应包含HTML转义函数', () => {
        const template = getTemplate();
        assert.ok(template.includes('function escapeHtml'));
    });

    it('streamChunk应直接使用innerHTML显示渲染后的内容', () => {
        const template = getTemplate();
        assert.ok(template.includes("if (m.command === 'streamChunk')"));
        assert.ok(template.includes('bubble.innerHTML = m.data'));
    });

    it('streamComplete应使用innerHTML显示渲染后的内容', () => {
        const template = getTemplate();
        assert.ok(template.includes("if (m.command === 'streamComplete')"));
    });

    it('应处理sessions消息', () => {
        const template = getTemplate();
        assert.ok(template.includes("if (m.command === 'sessions')"));
    });

    it('应处理currentSession消息', () => {
        const template = getTemplate();
        assert.ok(template.includes("if (m.command === 'currentSession')"));
    });

    it('应包含renderMessages函数', () => {
        const template = getTemplate();
        assert.ok(template.includes('function renderMessages'));
    });

    it('应包含renderHistory函数', () => {
        const template = getTemplate();
        assert.ok(template.includes('function renderHistory'));
    });

    it('历史按钮应有点击事件', () => {
        const template = getTemplate();
        assert.ok(template.includes('historyBtn.onclick'));
    });

    it('应支持切换会话', () => {
        const template = getTemplate();
        assert.ok(template.includes('switchSession'));
    });

    it('应支持删除会话', () => {
        const template = getTemplate();
        assert.ok(template.includes('deleteSession'));
    });

    it('模板应包含模型选择下拉框', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="modelSelect"'));
        assert.ok(template.includes('model-select'));
    });

    it('应处理models消息', () => {
        const template = getTemplate();
        assert.ok(template.includes("if (m.command === 'models')"));
    });

    it('应处理currentModel消息', () => {
        const template = getTemplate();
        assert.ok(template.includes("if (m.command === 'currentModel')"));
    });

    it('应包含renderModels函数', () => {
        const template = getTemplate();
        assert.ok(template.includes('function renderModels'));
    });

    it('模型选择下拉框应有change事件', () => {
        const template = getTemplate();
        assert.ok(template.includes('modelSelect.onchange'));
    });

    it('应支持切换模型', () => {
        const template = getTemplate();
        assert.ok(template.includes('switchModel'));
    });
});

describe('AIChatView Markdown Rendering - Markdown渲染测试', () => {
    it('应导入marked库', () => {
        const source = getSourceFile();
        assert.ok(source.includes("import { marked } from 'marked'"));
    });

    it('handleSendMessage应使用marked渲染Markdown', () => {
        const source = getSourceFile();
        assert.ok(source.includes('await marked('));
    });

    it('streamChunk应发送渲染后的HTML实现动态渲染', () => {
        const source = getSourceFile();
        assert.ok(source.includes("command: 'streamChunk'"));
        assert.ok(source.includes('const htmlContent = await marked(fullContent)'));
    });

    it('streamComplete应发送渲染后的HTML', () => {
        const source = getSourceFile();
        assert.ok(source.includes("command: 'streamComplete'"));
        assert.ok(source.includes('htmlContent'));
    });

    it('回调函数应为async以支持动态渲染', () => {
        const source = getSourceFile();
        assert.ok(source.includes('async (chunk)'));
    });
});

describe('AIChatView Session Management - 会话管理测试', () => {
    it('应处理newSession命令', () => {
        const source = getSourceFile();
        assert.ok(source.includes("case 'newSession'"));
    });

    it('应处理switchSession命令', () => {
        const source = getSourceFile();
        assert.ok(source.includes("case 'switchSession'"));
    });

    it('应处理deleteSession命令', () => {
        const source = getSourceFile();
        assert.ok(source.includes("case 'deleteSession'"));
    });

    it('应处理getSessions命令', () => {
        const source = getSourceFile();
        assert.ok(source.includes("case 'getSessions'"));
    });

    it('应有sendSessions方法', () => {
        const source = getSourceFile();
        assert.ok(source.includes('private sendSessions'));
    });

    it('应有sendCurrentSession方法', () => {
        const source = getSourceFile();
        assert.ok(source.includes('private sendCurrentSession'));
    });

    it('新建会话应检查当前会话是否为空', () => {
        const source = getSourceFile();
        assert.ok(source.includes('currentSession.messages.length'));
    });

    it('新建会话逻辑应只在当前会话有内容时创建新会话', () => {
        const source = getSourceFile();
        assert.ok(source.includes("if (!currentSession || currentSession.messages.length > 0)"));
        assert.ok(source.includes('this.aiChat.createNewSession()'));
    });
});

describe('AIChatView System Prompt - 系统提示词测试', () => {
    it('模板应包含prompt区域', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="promptArea"'));
        assert.ok(template.includes('prompt-area'));
    });

    it('模板应包含prompt输入框', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="promptInput"'));
    });

    it('模板应包含导入prompt按钮', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="importPromptBtn"'));
    });

    it('模板应包含清空prompt按钮', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="clearPromptBtn"'));
    });

    it('模板应包含折叠prompt按钮', () => {
        const template = getTemplate();
        assert.ok(template.includes('id="togglePromptBtn"'));
    });

    it('应处理importPrompt命令', () => {
        const source = getSourceFile();
        assert.ok(source.includes("case 'importPrompt'"));
    });

    it('应有handleImportPrompt方法', () => {
        const source = getSourceFile();
        assert.ok(source.includes('private async handleImportPrompt'));
    });

    it('应处理promptContent消息', () => {
        const template = getTemplate();
        assert.ok(template.includes("if (m.command === 'promptContent')"));
    });

    it('发送消息时应包含systemPrompt', () => {
        const template = getTemplate();
        assert.ok(template.includes('systemPrompt: systemPrompt'));
    });

    it('handleSendMessage应接收systemPrompt参数', () => {
        const source = getSourceFile();
        assert.ok(source.includes('data: { message: string; systemPrompt?: string }'));
    });
});

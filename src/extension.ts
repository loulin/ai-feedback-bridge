import * as vscode from 'vscode';
import { McpWebviewProvider } from './webview/provider';
import { MCPFeedbackServer } from './server';

let mcpServer: MCPFeedbackServer | undefined;
let webviewProvider: McpWebviewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Feedback Bridge is now active!');

    // 创建Webview Provider
    webviewProvider = new McpWebviewProvider(context.extensionUri);
    
    // 注册Webview Provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'mcpPanel',
            webviewProvider
        )
    );

    // 注册命令
    const startCommand = vscode.commands.registerCommand('mcpExtension.start', async () => {
        try {
            await startMcpServer(context);
            vscode.window.showInformationMessage('MCP Server started successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start MCP Server: ${error}`);
        }
    });

    const stopCommand = vscode.commands.registerCommand('mcpExtension.stop', async () => {
        try {
            await stopMcpServer();
            vscode.window.showInformationMessage('MCP Server stopped successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to stop MCP Server: ${error}`);
        }
    });

    const restartCommand = vscode.commands.registerCommand('mcpExtension.restart', async () => {
        try {
            await stopMcpServer();
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒确保完全停止
            await startMcpServer(context);
            vscode.window.showInformationMessage('MCP Server restarted successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to restart MCP Server: ${error}`);
        }
    });

    const openPanelCommand = vscode.commands.registerCommand('mcpExtension.openPanel', () => {
        vscode.commands.executeCommand('mcpPanel.focus');
    });

    context.subscriptions.push(startCommand, stopCommand, restartCommand, openPanelCommand);

    // 自动启动MCP服务器（如果配置启用）
    const config = vscode.workspace.getConfiguration('mcpExtension');
    if (config.get<boolean>('ui.autoOpen', true)) {
        startMcpServer(context);
    }
}

export function deactivate() {
    console.log('AI Feedback Bridge is being deactivated...');
    return stopMcpServer();
}

async function startMcpServer(context: vscode.ExtensionContext): Promise<void> {
    if (mcpServer) {
        console.log('MCP Server is already running');
        return;
    }

    const config = vscode.workspace.getConfiguration('mcpExtension');
    const port = config.get<number>('server.port', 8765);

    mcpServer = new MCPFeedbackServer();
    
    // 连接webview provider和MCP服务器
    if (webviewProvider) {
        webviewProvider.setMcpServer(mcpServer);
    }
    
    const baseUrl = await mcpServer.start(port);

    console.log(`MCP Server started at ${baseUrl}`);
}

async function stopMcpServer(): Promise<void> {
    if (mcpServer) {
        await mcpServer.stop();
        mcpServer = undefined;
    }

    if (webviewProvider) {
        webviewProvider.setMcpServer(undefined);
    }

    console.log('MCP Server stopped');
} 
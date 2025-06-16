import * as vscode from 'vscode';
import { McpWebviewProvider } from './webview/provider';
import { MCPFeedbackServer } from './server';
import { Messages, I18nManager } from './i18n';

let mcpServer: MCPFeedbackServer | undefined;
let webviewProvider: McpWebviewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
    // Initialize i18n manager
    const i18nManager = I18nManager.getInstance();
    console.log('AI Feedback Bridge is now active!');
    console.log(`Language detected: ${i18nManager.getCurrentLanguage()}`);

    // Create Webview Provider
    webviewProvider = new McpWebviewProvider(context.extensionUri);
    
    // Register Webview Provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'mcpPanel',
            webviewProvider,
            { webviewOptions: { retainContextWhenHidden: true } },
        )
    );

    // Register commands
    const startCommand = vscode.commands.registerCommand('mcpExtension.start', async () => {
        try {
            await startMcpServer(context);
            vscode.window.showInformationMessage(Messages.serverStarted());
        } catch (error) {
            vscode.window.showErrorMessage(Messages.serverStartFailed(String(error)));
        }
    });

    const stopCommand = vscode.commands.registerCommand('mcpExtension.stop', async () => {
        try {
            await stopMcpServer();
            vscode.window.showInformationMessage(Messages.serverStoppedSuccess());
        } catch (error) {
            vscode.window.showErrorMessage(Messages.serverStopFailed(String(error)));
        }
    });

    const restartCommand = vscode.commands.registerCommand('mcpExtension.restart', async () => {
        try {
            await stopMcpServer();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second to ensure complete shutdown
            await startMcpServer(context);
            vscode.window.showInformationMessage(Messages.serverRestarted());
        } catch (error) {
            vscode.window.showErrorMessage(Messages.serverRestartFailed(String(error)));
        }
    });

    const openPanelCommand = vscode.commands.registerCommand('mcpExtension.openPanel', () => {
        vscode.commands.executeCommand('mcpPanel.focus');
    });

    context.subscriptions.push(startCommand, stopCommand, restartCommand, openPanelCommand);

    // Auto-start MCP server (if enabled in configuration)
    const config = vscode.workspace.getConfiguration('mcpExtension');
    if (config.get<boolean>('ui.autoOpen', true)) {
        startMcpServer(context);
    }
}

export function deactivate() {
    console.log('AI Feedback Bridge is being deactivated...');
    return stopMcpServer();
}

async function startMcpServer(_context: vscode.ExtensionContext): Promise<void> {
    if (mcpServer) {
        console.log('MCP Server is already running');
        return;
    }

    const config = vscode.workspace.getConfiguration('mcpExtension');
    const port = config.get<number>('server.port', 8765);

    mcpServer = new MCPFeedbackServer();
    
    // Connect webview provider and MCP server
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
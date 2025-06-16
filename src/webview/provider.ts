import * as vscode from 'vscode';
import { MCPFeedbackServer, UserFeedbackRequest, UserFeedbackResponse } from '../mcpServer/server';

interface PendingRequest {
    id: string;
    summary: string;
    timestamp: Date;
    startTime: Date;
    timeoutMs: number;
}

export class McpWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'mcpPanel';
    
    private _view?: vscode.WebviewView;
    private mcpServer?: MCPFeedbackServer;
    private pendingRequests: Map<string, PendingRequest> = new Map();

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public setMcpServer(server: MCPFeedbackServer | undefined): void {
        // Cleanup previous server listeners
        if (this.mcpServer) {
            this.mcpServer.removeAllListeners('feedbackRequest');
        }

        this.mcpServer = server;
        
        // Setup new server listeners
        if (this.mcpServer) {
            this.mcpServer.on('feedbackRequest', (request: UserFeedbackRequest) => {
                this.handleFeedbackRequestFromServer(request);
            });
        }
        
        this.updateServerStatus();
    }

    private handleFeedbackRequestFromServer(request: UserFeedbackRequest): void {
        const pendingRequest: PendingRequest = {
            id: request.id,
            summary: request.summary,
            timestamp: request.timestamp,
            startTime: new Date(),
            timeoutMs: 600000 // 10 minutes
        };

        this.pendingRequests.set(request.id, pendingRequest);

        // 显示请求给用户
        if (this._view) {
            this._view.webview.postMessage({
                type: 'feedbackRequest',
                id: request.id,
                summary: request.summary,
                timestamp: request.timestamp.toISOString(),
                startTime: pendingRequest.startTime.toISOString(),
                timeoutMs: pendingRequest.timeoutMs
            });

            // 焦点到面板
            this._view.show();
        }
    }

    private updateServerStatus(): void {
        if (this._view) {
            const isServerRunning = this.mcpServer && this.mcpServer.getBaseUrl() !== null;
            this._view.webview.postMessage({ 
                type: 'serverStatus', 
                running: isServerRunning 
            });
        }
    }

    // 这个方法现在不再需要，因为我们使用事件模式
    public async handleInteractiveFeedback(
        id: string, 
        summary: string, 
        timeout: number = 600000
    ): Promise<any> {
        // 这个方法保留兼容性，但实际上不会被调用
        throw new Error('This method is deprecated - use event-based approach instead');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // 监听webview可见性变化，重新同步状态
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                console.log('[WebviewProvider] Webview became visible, updating server status');
                this.updateServerStatus();
            }
        });

        // 处理来自Webview的消息
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'respondToFeedback':
                    await this.handleFeedbackResponse(data.id, data.response);
                    break;
                case 'requestClearHistory':
                    await this.handleRequestClearHistory();
                    break;
                case 'restartServer':
                    await this.handleRestartServer();
                    break;
                case 'requestServerStatus':
                    this.updateServerStatus();
                    break;
            }
        });

        // 发送服务器状态 - 检查服务器是否真正在运行
        const isServerRunning = this.mcpServer && this.mcpServer.getBaseUrl() !== null;
        webviewView.webview.postMessage({
            type: 'serverStatus',
            running: isServerRunning
        });
    }

    private async handleFeedbackResponse(id: string, response: string): Promise<void> {
        const request = this.pendingRequests.get(id);
        if (!request) {
            this._view?.webview.postMessage({
                type: 'error',
                message: 'Request not found or expired'
            });
            return;
        }

        if (!this.mcpServer) {
            this._view?.webview.postMessage({
                type: 'error',
                message: 'MCP Server not available'
            });
            return;
        }

        try {
            // 构建回复内容
            const content: any[] = [];
            
            if (response.trim()) {
                content.push({
                    type: 'text',
                    text: response
                });
            }

            // 创建用户反馈响应
            const userResponse: UserFeedbackResponse = {
                id: id,
                content: content,
                timestamp: new Date()
            };

            // 通过MCP服务器发送响应
            this.mcpServer.respondToFeedback(id, userResponse);

            // 清理请求
            this.pendingRequests.delete(id);

            // 通知UI请求已完成，并传递用户回复内容
            this._view?.webview.postMessage({
                type: 'requestCompleted',
                id: id,
                userResponse: response,
                responseTime: new Date().toISOString()
            });

        } catch (error) {
            this._view?.webview.postMessage({
                type: 'error',
                message: `Failed to send response: ${error}`
            });
        }
    }

    private async handleRequestClearHistory(): Promise<void> {
        console.log('handleRequestClearHistory called');
        
        const result = await vscode.window.showInformationMessage(
            '确定要清空所有对话历史记录吗？此操作不可撤销。',
            { modal: true },
            '确定'
        );
        
        if (result === '确定') {
            console.log('User confirmed, clearing history');
            await this.handleClearHistory();
        } else {
            console.log('User cancelled clear history');
        }
    }

    private async handleClearHistory(): Promise<void> {
        console.log('handleClearHistory called');
        
        // 清理所有待处理请求
        for (const [id] of this.pendingRequests) {
            // 通知MCP服务器取消请求
            if (this.mcpServer) {
                this.mcpServer.cancelFeedback(id, 'Cancelled by user');
            }
            this.pendingRequests.delete(id);
        }
        console.log('Pending requests cleared');

        this._view?.webview.postMessage({
            type: 'historyCleared'
        });
        console.log('historyCleared message sent to webview');
    }

    private async handleRestartServer(): Promise<void> {
        console.log('handleRestartServer called');
        
        // 直接调用VSCode命令来重启服务器
        try {
            await vscode.commands.executeCommand('mcpExtension.restart');
        } catch (error) {
            console.error('Failed to restart server:', error);
            this._view?.webview.postMessage({
                type: 'error',
                message: `Failed to restart server: ${error}`
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // 获取 JS 文件的 URI（从 media 目录）
        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'panel.js')
        );
        
        // 读取 HTML 文件内容（从 media 目录）
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'panel.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        // 替换 JS 文件路径为正确的 webview URI
        html = html.replace('src="panel.js"', `src="${jsUri}"`);
        
        return html;
    }
}
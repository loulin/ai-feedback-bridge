import * as vscode from 'vscode';
import { MCPFeedbackServer } from '../server';
import { UserFeedbackRequest, UserFeedbackResponse } from '../server/types.js';

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
            timeoutMs: 300000 // 5 minutes
        };

        this.pendingRequests.set(request.id, pendingRequest);

        // Display request to user
        if (this._view) {
            this._view.webview.postMessage({
                type: 'feedbackRequest',
                id: request.id,
                summary: request.summary,
                timestamp: request.timestamp.toISOString(),
                startTime: pendingRequest.startTime.toISOString(),
                timeoutMs: pendingRequest.timeoutMs
            });

            // Focus to panel
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

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
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

        // Listen for webview visibility changes, re-sync status
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                console.log('[WebviewProvider] Webview became visible, updating server status');
                this.updateServerStatus();
            }
        });

        // Handle messages from Webview
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

        // Send server status - check if server is actually running
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
            // Build reply content
            const content: any[] = [];
            
            if (response.trim()) {
                content.push({
                    type: 'text',
                    text: response
                });
            }

            // Create user feedback response
            const userResponse: UserFeedbackResponse = {
                id: id,
                content: content,
                timestamp: new Date()
            };

            // Send response through MCP server
            this.mcpServer.respondToFeedback(id, userResponse);

            // Clean up request
            this.pendingRequests.delete(id);

            // Notify UI that request is completed and pass user reply content
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
            'Are you sure you want to clear all conversation history? This action cannot be undone.',
            { modal: true },
            'Confirm'
        );
        
        if (result === 'Confirm') {
            console.log('User confirmed, clearing history');
            await this.handleClearHistory();
        } else {
            console.log('User cancelled clear history');
        }
    }

    private async handleClearHistory(): Promise<void> {
        console.log('handleClearHistory called');
        
        // Clean up all pending requests
        for (const [id] of this.pendingRequests) {
            // Notify MCP server to cancel request
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
        
        // Directly call VSCode command to restart server
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
        // Get JS file URI (from media directory)
        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'panel.js')
        );
        
        // Read HTML file content (from media directory)
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'panel.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        // Replace JS file path with correct webview URI
        html = html.replace('src="panel.js"', `src="${jsUri}"`);
        
        return html;
    }
}
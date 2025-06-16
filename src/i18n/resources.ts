/**
 * Localization resources for runtime messages
 * These will be used with vscode-nls for message localization
 */

// English resources (default)
export const EnglishResources = {
    // Server status messages
    'status.serverRunning': 'Server: Running on port {0}',
    'status.serverStopped': 'Server: Stopped',
    
    // Success messages
    'info.serverStarted': 'MCP Server started successfully!',
    'info.serverStopped': 'MCP Server stopped successfully!',
    'info.serverRestarted': 'MCP Server restarted successfully!',
    'info.extensionActivated': 'AI Feedback Bridge is now active!',
    
    // Error messages
    'error.serverStartFailed': 'Failed to start MCP Server: {0}',
    'error.serverStopFailed': 'Failed to stop MCP Server: {0}',
    'error.serverRestartFailed': 'Failed to restart MCP Server: {0}',
    'error.portOccupied': 'Port {0} is already in use. Please choose a different port.',
    'error.configurationError': 'Configuration error: {0}',
    
    // Webview messages (for future use)
    'webview.waitingForAI': 'Waiting for AI feedback requests...',
    'webview.aiWillShow': 'AI requests will appear here when tasks are completed',
    'webview.completed': 'Completed',
    'webview.cancelled': 'Cancelled',
    'webview.restart': 'Restart',
    'webview.send': 'Send',
    'webview.clear': 'Clear History',
    'webview.placeholder': 'Type your response here...',
};

// Chinese resources
export const ChineseResources = {
    // Server status messages
    'status.serverRunning': '服务器：运行在端口 {0}',
    'status.serverStopped': '服务器：已停止',
    
    // Success messages
    'info.serverStarted': 'MCP服务器启动成功！',
    'info.serverStopped': 'MCP服务器停止成功！',
    'info.serverRestarted': 'MCP服务器重启成功！',
    'info.extensionActivated': 'AI反馈桥接器已激活！',
    
    // Error messages
    'error.serverStartFailed': '启动MCP服务器失败：{0}',
    'error.serverStopFailed': '停止MCP服务器失败：{0}',
    'error.serverRestartFailed': '重启MCP服务器失败：{0}',
    'error.portOccupied': '端口 {0} 已被占用，请选择其他端口。',
    'error.configurationError': '配置错误：{0}',
    
    // Webview messages (for future use)
    'webview.waitingForAI': '等待AI反馈请求...',
    'webview.aiWillShow': '当AI完成任务时会在这里显示',
    'webview.completed': '已完成',
    'webview.cancelled': '已取消',
    'webview.restart': '重启',
    'webview.send': '发送',
    'webview.clear': '清除历史',
    'webview.placeholder': '在此输入您的回复...',
};

/**
 * Get resources for a given language
 */
export function getResources(language: string): Record<string, string> {
    switch (language) {
        case 'zh-cn':
            return ChineseResources;
        case 'en':
        default:
            return EnglishResources;
    }
} 
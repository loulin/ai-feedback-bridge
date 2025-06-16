import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

// Configure vscode-nls
const localize = nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

/**
 * i18n Manager for handling internationalization
 */
export class I18nManager {
    private static instance: I18nManager;
    private currentLanguage = 'en';

    private constructor() {
        this.detectLanguage();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): I18nManager {
        if (!I18nManager.instance) {
            I18nManager.instance = new I18nManager();
        }
        return I18nManager.instance;
    }

    /**
     * Detect current language from VSCode environment
     */
    private detectLanguage(): void {
        // Priority: User setting > VSCode language > System language > English default
        const config = vscode.workspace.getConfiguration('mcpExtension');
        const userLanguage = config.get<string>('i18n.language');
        
        if (userLanguage && userLanguage !== 'auto') {
            this.currentLanguage = userLanguage;
        } else {
            // Get VSCode language
            const vscodeLanguage = vscode.env.language;
            this.currentLanguage = this.normalizeLanguageCode(vscodeLanguage);
        }
    }

    /**
     * Normalize language code to supported languages
     */
    private normalizeLanguageCode(langCode: string): string {
        // Supported languages
        const supported = ['en', 'zh-cn'];
        
        // Direct match
        if (supported.includes(langCode)) {
            return langCode;
        }
        
        // Handle variants
        if (langCode.startsWith('zh')) {
            return 'zh-cn';
        }
        
        // Default to English
        return 'en';
    }

    /**
     * Get current language
     */
    public getCurrentLanguage(): string {
        return this.currentLanguage;
    }

    /**
     * Check if a language is supported
     */
    public isLanguageSupported(langCode: string): boolean {
        return ['en', 'zh-cn'].includes(langCode);
    }
}

// Export localize function for direct use
export { localize };

// Export common messages for runtime use
export const Messages = {
    // Server status messages
    serverRunning: (port: number) => localize('status.serverRunning', 'Server: Running on port {0}', port),
    serverStopped: () => localize('status.serverStopped', 'Server: Stopped'),
    
    // Success messages
    serverStarted: () => localize('info.serverStarted', 'MCP Server started successfully!'),
    serverStoppedSuccess: () => localize('info.serverStopped', 'MCP Server stopped successfully!'),
    serverRestarted: () => localize('info.serverRestarted', 'MCP Server restarted successfully!'),
    
    // Error messages
    serverStartFailed: (error: string) => localize('error.serverStartFailed', 'Failed to start MCP Server: {0}', error),
    serverStopFailed: (error: string) => localize('error.serverStopFailed', 'Failed to stop MCP Server: {0}', error),
    serverRestartFailed: (error: string) => localize('error.serverRestartFailed', 'Failed to restart MCP Server: {0}', error),
    
    // General messages
    extensionActivated: () => localize('info.extensionActivated', 'AI Feedback Bridge is now active!'),
    portOccupied: (port: number) => localize('error.portOccupied', 'Port {0} is already in use. Please choose a different port.', port),
    configurationError: (message: string) => localize('error.configurationError', 'Configuration error: {0}', message),
}; 
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IncomingMessage, ServerResponse } from 'node:http';

/**
 * SSE-specific MCP Server Implementation
 * Handles Server-Sent Events transport for MCP protocol
 */
export class MCPSSEServer {
    private transports: Map<string, SSEServerTransport> = new Map();
    /**
     * Handle SSE connection establishment (GET /sse)
     */
  async handleSSEConnection(req: IncomingMessage, res: ServerResponse, mcpServer: McpServer): Promise<void> {
        console.log('Establishing SSE connection');
        
        try {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            const sessionId = url.searchParams.get('sessionId');
            
            let transport: SSEServerTransport;
            
            if (sessionId && this.transports.has(sessionId)) {
                // Reconnecting to existing session
                transport = this.transports.get(sessionId)!;
                console.log(`SSE client reconnecting to session: ${sessionId}`);
                
                // Set session ID header for reconnection
                if (!res.headersSent) {
                    res.setHeader('mcp-session-id', sessionId);
                }
            } else {
                // Create new SSE transport
                transport = new SSEServerTransport("/message", res);
                
                if (transport.sessionId) {
                    this.transports.set(transport.sessionId, transport);
                    console.log(`SSE session created: ${transport.sessionId}`);
                    
                    // Set session ID header for new connection
                    if (!res.headersSent) {
                        res.setHeader('mcp-session-id', transport.sessionId);
                    }
                }

                // Set up cleanup when transport closes
                const originalOnClose = transport.onclose;
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid && this.transports.has(sid)) {
                        console.log(`SSE transport closed for session ${sid}, removing from transports map`);
                        this.transports.delete(sid);
                    }
                    if (originalOnClose) {
                        originalOnClose();
                    }
                };

                await mcpServer.connect(transport);
            }
            
        } catch (error) {
            console.error('Error handling SSE connection:', error);
            if (!res.headersSent) {
                res.writeHead(500).end();
            }
        }
    }

    /**
     * Handle SSE message (POST /message)
     */
    async handleSSEMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
        console.log('Received SSE message');
        
        try {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            const sessionId = url.searchParams.get('sessionId');
            
            if (!sessionId || !this.transports.has(sessionId)) {
                res.writeHead(400).end('Invalid or missing session ID');
                return;
            }

            const transport = this.transports.get(sessionId)!;
            await transport.handlePostMessage(req, res);
            
        } catch (error) {
            console.error('Error handling SSE message:', error);
            if (!res.headersSent) {
                res.writeHead(500).end();
            }
        }
    }

    /**
     * Get all active session IDs
     */
    getActiveSessions(): string[] {
        return Array.from(this.transports.keys());
    }

    /**
     * Get transport for a specific session
     */
    getTransportForSession(sessionId: string): SSEServerTransport | null {
        return this.transports.get(sessionId) || null;
    }

    /**
     * Close all transports and cleanup
     */
    async cleanup(): Promise<void> {
        for (const [sessionId, transport] of this.transports) {
            try {
                console.log(`Closing SSE transport for session ${sessionId}`);
                if (transport.onclose) {
                    transport.onclose();
                }
            } catch (error) {
                console.error(`Error closing SSE transport for session ${sessionId}:`, error);
            }
        }
        this.transports.clear();
    }
}

// Export singleton instance
export const mcpSSEServer = new MCPSSEServer(); 
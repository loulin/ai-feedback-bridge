import { createServer, IncomingMessage, ServerResponse, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from "events";
import { mcpSSEServer } from './sseServer.js';
import { createMcpServerWithFeedback } from './mcpServer.js';
import { UserFeedbackResponse, PendingRequest } from './types.js';

/**
 * MCP Server Implementation supporting multiple client connections
 * Each client gets its own session and transport instance
 * Uses EventEmitter pattern to decouple from UI layer
 */
export class MCPFeedbackServer extends EventEmitter {
    private server: Server | null = null;
    private baseUrl: URL | null = null;
    private mcpServer: McpServer | null = null;
    // Map to store transports by session ID for multi-client support
    private transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
    
    // Map to store pending feedback requests
    private pendingRequests: Map<string, PendingRequest> = new Map();

    constructor() {
        super();
    }

    /**
     * Register a feedback response handler
     */
    public respondToFeedback(requestId: string, response: UserFeedbackResponse): boolean {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(requestId);
            pending.resolve({
                content: response.content
            });
            return true;
        }
        return false;
    }

    /**
     * Cancel a pending feedback request
     */
    public cancelFeedback(requestId: string, error: string = 'Request cancelled'): boolean {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(requestId);
            pending.reject(new Error(error));
            return true;
        }
        return false;
    }

    async start(port: number = 0, host: string = "127.0.0.1"): Promise<URL> {
        this.mcpServer = createMcpServerWithFeedback(
            this,
            this.pendingRequests,
        );
        // Create HTTP server
        this.server = createServer(async (req, res) => {
            try {
                // Add CORS headers
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization');
                res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

                // Handle preflight requests
                if (req.method === 'OPTIONS') {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                // Route based on URL path for SSE support
                const url = new URL(req.url || '/', `http://${req.headers.host}`);
                
                if (url.pathname === '/sse' && req.method === 'GET') {
                    // SSE connection establishment
                    await mcpSSEServer.handleSSEConnection(req, res, this.mcpServer!);
                } else if (url.pathname === '/message' && req.method === 'POST') {
                    // SSE message handling
                    await mcpSSEServer.handleSSEMessage(req, res);
                } else if (req.method === 'POST') {
                    await this.handlePostRequest(req, res);
                } else if (req.method === 'GET') {
                    await this.handleGetRequest(req, res);
                } else if (req.method === 'DELETE') {
                    await this.handleDeleteRequest(req, res);
                } else {
                    res.writeHead(405).end(JSON.stringify({
                        jsonrpc: "2.0",
                        error: {
                            code: -32000,
                            message: "Method Not Allowed"
                        },
                        id: null
                    }));
                }
            } catch (error) {
                console.error("Error handling request:", error);
                if (!res.headersSent) {
                    res.writeHead(500).end();
                }
            }
        });

        // Start server
        this.baseUrl = await new Promise<URL>((resolve) => {
            this.server!.listen(port, host, () => {
                const addr = this.server!.address() as AddressInfo;
                resolve(new URL(`http://${host}:${addr.port}`));
            });
        });

        console.log(`MCP Feedback Server started at ${this.baseUrl}`);
        console.log(`  - Stream HTTP: ${this.baseUrl}`);
        console.log(`  - SSE: ${this.baseUrl}sse`);
        return this.baseUrl;
    }

    private async handlePostRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        console.log('Received MCP POST request');
        
        try {
            // Parse request body
            let body = '';
            req.on('data', (chunk: Buffer) => {
                body += chunk.toString();
            });

            await new Promise((resolve) => {
                req.on('end', resolve);
            });

            const requestBody = JSON.parse(body);
            
            // Check for existing session ID
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            let transport: StreamableHTTPServerTransport;

            if (sessionId && this.transports[sessionId]) {
                // Reuse existing transport
                transport = this.transports[sessionId];
                console.log(`Using existing transport for session: ${sessionId}`);
            } else if (!sessionId && isInitializeRequest(requestBody)) {
                // New initialization request - create new transport and server
                console.log('Creating new transport for initialization request');
                
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    enableJsonResponse: false,
                    onsessioninitialized: (sessionId) => {
                        console.log(`Session initialized with ID: ${sessionId}`);
                        this.transports[sessionId] = transport;
                    }
                });

                // Set up cleanup when transport closes
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid && this.transports[sid]) {
                        console.log(`Transport closed for session ${sid}, removing from transports map`);
                        delete this.transports[sid];
                    }
                };

                await this.mcpServer!.connect(transport);

                // Handle the initialization request
                await transport.handleRequest(req, res, requestBody);
                return;
            } else if (sessionId && !this.transports[sessionId]) {
                // Invalid session ID
                res.writeHead(404).end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: {
                        code: -32001,
                        message: 'Session not found',
                    },
                    id: null,
                }));
                return;
            } else {
                // No session ID for non-initialization request
                res.writeHead(400).end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: 'Bad Request: No valid session ID provided or invalid request',
                    },
                    id: null,
                }));
                return;
            }

            // Handle the request with existing transport
            await transport.handleRequest(req, res, requestBody);
            
        } catch (error) {
            console.error('Error handling POST request:', error);
            if (!res.headersSent) {
                res.writeHead(500).end(JSON.stringify({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error',
                    },
                    id: null,
                }));
            }
        }
    }

    private async handleGetRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        
        if (!sessionId || !this.transports[sessionId]) {
            res.writeHead(400).end('Invalid or missing session ID');
            return;
        }

        console.log(`Handling GET request for session: ${sessionId}`);
        const transport = this.transports[sessionId];
        await transport.handleRequest(req, res);
    }

    private async handleDeleteRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        
        if (!sessionId || !this.transports[sessionId]) {
            res.writeHead(400).end('Invalid or missing session ID');
            return;
        }

        console.log(`Handling DELETE request for session: ${sessionId}`);
        const transport = this.transports[sessionId];
        
        try {
            // Let transport handle the DELETE request
            await transport.handleRequest(req, res);
            
            // Manually clean up our transport mapping
            delete this.transports[sessionId];
            console.log(`Session ${sessionId} removed from transport mapping`);
        } catch (error) {
            console.error(`Error handling DELETE request for session ${sessionId}:`, error);
            // Clean up even if there was an error
            delete this.transports[sessionId];
            throw error;
        }
    }

    async stop(): Promise<void> {
        // Close all active transports
        for (const sessionId in this.transports) {
            try {
                console.log(`Closing transport for session ${sessionId}`);
                await this.transports[sessionId].close();
                delete this.transports[sessionId];
            } catch (error) {
                console.error(`Error closing transport for session ${sessionId}:`, error);
            }
        }

        // Clear pending requests
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Server shutting down'));
        }
        this.pendingRequests.clear();

        // Close SSE server
        await mcpSSEServer.cleanup();

        if (this.server) {
            this.server.close();
            this.server = null;
        }

        this.baseUrl = null;
        console.log("MCP Feedback Server stopped");
    }

    getBaseUrl(): URL | null {
        return this.baseUrl;
    }

    /**
     * Get all active session IDs
     */
    getActiveSessions(): string[] {
        const streamSessions = Object.keys(this.transports);
        const sseSessions = mcpSSEServer.getActiveSessions();
        return [...streamSessions, ...sseSessions];
    }

    /**
     * Get transport for a specific session
     */
    getTransportForSession(sessionId: string): StreamableHTTPServerTransport | null {
        return this.transports[sessionId] || null;
    }
}

// Export singleton instance
export const mcpFeedbackServer = new MCPFeedbackServer(); 
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { MCPFeedbackServer } from '../src/mcpServer/server';

/**
 * Test messages following official SDK patterns
 */
const TEST_MESSAGES = {
    initialize: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
            clientInfo: { name: "test-client", version: "1.0" },
            protocolVersion: "2025-03-26",
            capabilities: {},
        },
        id: "init-1",
    } as JSONRPCMessage,

    toolsList: {
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: "tools-1",
    } as JSONRPCMessage,

    callTool: {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
            name: "interactive_feedback",
            arguments: { summary: "Test feedback request" }
        },
        id: "call-1",
    } as JSONRPCMessage
};

/**
 * Helper to send JSON-RPC request following official test patterns
 */
async function sendPostRequest(
    baseUrl: URL, 
    message: JSONRPCMessage | JSONRPCMessage[], 
    sessionId?: string, 
    extraHeaders?: Record<string, string>
): Promise<Response> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...extraHeaders
    };

    if (sessionId) {
        headers["mcp-session-id"] = sessionId;
        headers["mcp-protocol-version"] = "2025-03-26";
    }

    return fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(message),
    });
}

/**
 * Helper to extract session ID from response headers
 */
function extractSessionId(response: Response): string | null {
    return response.headers.get("mcp-session-id");
}

/**
 * Helper to read SSE events from response
 */
async function readSSEEvents(response: Response): Promise<string[]> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("No response body reader");
    }

    const events: string[] = [];
    const decoder = new TextDecoder();
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            
            const chunk = decoder.decode(value);
            events.push(chunk);
        }
    } catch (error) {
        // Stream closed or error
    } finally {
        reader.releaseLock();
    }
    
    return events;
}

describe("MCPFeedbackServer", () => {
    let server: MCPFeedbackServer;
    let baseUrl: URL;

    beforeEach(async () => {
        server = new MCPFeedbackServer();
        baseUrl = await server.start();
    });

    afterEach(async () => {
        await server.stop();
    });

    describe("Basic HTTP Handling", () => {
        test("should handle CORS preflight requests", async () => {
            const response = await fetch(baseUrl, {
                method: "OPTIONS",
                headers: {
                    "Origin": "http://localhost:3000",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "Content-Type"
                }
            });

            expect(response.status).toBe(204);
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
            expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
        });

        test("should reject unsupported HTTP methods", async () => {
            const response = await fetch(baseUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(TEST_MESSAGES.initialize)
            });

            expect(response.status).toBe(405);
        });
    });

    describe("MCP Protocol - Initialization", () => {
        test("should handle initialization request with session management", async () => {
            const response = await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("text/event-stream");
            
            const sessionId = extractSessionId(response);
            expect(sessionId).toBeTruthy();
            expect(sessionId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
        });

        test("should handle initialization with SSE stream", async () => {
            const response = await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);
            
            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("text/event-stream");

            const events = await readSSEEvents(response);
            expect(events.length).toBeGreaterThan(0);
            
            // Should contain initialization response
            const eventData = events.join('');
            expect(eventData).toContain('"id":"init-1"');
            expect(eventData).toContain('"result"');
        });
    });

    describe("MCP Protocol - Tools", () => {
        let sessionId: string;

        beforeEach(async () => {
            // Initialize session first
            const initResponse = await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);
            sessionId = extractSessionId(initResponse)!;
            
            // Consume the initialization SSE stream
            await readSSEEvents(initResponse);
        });

        test("should list available tools", async () => {
            const response = await sendPostRequest(baseUrl, TEST_MESSAGES.toolsList, sessionId);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("text/event-stream");

            const events = await readSSEEvents(response);
            const eventData = events.join('');
            
            expect(eventData).toContain('"id":"tools-1"');
            expect(eventData).toContain('"result"');
            expect(eventData).toContain('"interactive_feedback"');
        });

        test("should call interactive_feedback tool", async () => {
            const response = await sendPostRequest(baseUrl, TEST_MESSAGES.callTool, sessionId);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("text/event-stream");

            const events = await readSSEEvents(response);
            const eventData = events.join('');
            
            expect(eventData).toContain('"id":"call-1"');
            expect(eventData).toContain('"result"');
            expect(eventData).toContain("Feedback request received: Test feedback request");
        });

        test("should reject requests without session ID after initialization", async () => {
            const response = await sendPostRequest(baseUrl, TEST_MESSAGES.toolsList);

            expect(response.status).toBe(400);
            
            const data = await response.json();
            expect(data).toMatchObject({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: expect.stringContaining("No valid session ID")
                }
            });
        });

        test("should reject requests with invalid session ID", async () => {
            const response = await sendPostRequest(baseUrl, TEST_MESSAGES.toolsList, "invalid-session");

            expect(response.status).toBe(404);
            
            const data = await response.json();
            expect(data).toMatchObject({
                jsonrpc: "2.0",
                error: {
                    code: -32001,
                    message: expect.stringContaining("Session not found")
                }
            });
        });
    });

    describe("GET Request - SSE Stream", () => {
        let sessionId: string;

        beforeEach(async () => {
            // Initialize session first
            const initResponse = await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);
            sessionId = extractSessionId(initResponse)!;
            await readSSEEvents(initResponse);
        });

        test("should establish SSE stream for GET requests", async () => {
            const response = await fetch(baseUrl, {
                method: "GET",
                headers: {
                    "Accept": "text/event-stream",
                    "mcp-session-id": sessionId,
                    "mcp-protocol-version": "2025-03-26"
                }
            });

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toContain("text/event-stream");
            expect(response.headers.get("mcp-session-id")).toBe(sessionId);
        });

        test("should reject GET requests without Accept: text/event-stream", async () => {
            const response = await fetch(baseUrl, {
                method: "GET",
                headers: {
                    "mcp-session-id": sessionId,
                    "mcp-protocol-version": "2025-03-26"
                }
            });

            expect(response.status).toBe(406);
            
            const data = await response.json();
            expect(data).toMatchObject({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: expect.stringContaining("text/event-stream")
                }
            });
        });
    });

    describe("Server Lifecycle", () => {
        test("should start and stop cleanly", async () => {
            const testServer = new MCPFeedbackServer();
            
            const startedUrl = await testServer.start();
            expect(startedUrl).toBeInstanceOf(URL);
            expect(testServer.getBaseUrl()).toEqual(startedUrl);
            
            await testServer.stop();
            expect(testServer.getBaseUrl()).toBeNull();
        });

        test("should track active sessions", () => {
            // Initially no sessions
            expect(server.getActiveSessions()).toEqual([]);
        });
    });

    describe("Multi-Client Support", () => {
        test("should support multiple concurrent client connections", async () => {
            // Initialize first client
            const response1 = await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);
            expect(response1.status).toBe(200);
            const sessionId1 = extractSessionId(response1)!;
            await readSSEEvents(response1);

            // Initialize second client
            const initMessage2 = {
                ...TEST_MESSAGES.initialize,
                id: "init-2"
            };
            const response2 = await sendPostRequest(baseUrl, initMessage2);
            expect(response2.status).toBe(200);
            const sessionId2 = extractSessionId(response2)!;
            await readSSEEvents(response2);

            // Sessions should be different
            expect(sessionId1).not.toBe(sessionId2);

            // Both sessions should be active
            const activeSessions = server.getActiveSessions();
            expect(activeSessions).toContain(sessionId1);
            expect(activeSessions).toContain(sessionId2);
            expect(activeSessions.length).toBe(2);

            // Both clients should be able to call tools independently
            const toolsResponse1 = await sendPostRequest(baseUrl, TEST_MESSAGES.toolsList, sessionId1);
            expect(toolsResponse1.status).toBe(200);

            const toolsResponse2 = await sendPostRequest(baseUrl, TEST_MESSAGES.toolsList, sessionId2);
            expect(toolsResponse2.status).toBe(200);
        });

        test("should cleanup sessions when clients disconnect", async () => {
            // Initialize client
            const response = await sendPostRequest(baseUrl, TEST_MESSAGES.initialize);
            const sessionId = extractSessionId(response)!;
            await readSSEEvents(response);

            // Verify session is active
            expect(server.getActiveSessions()).toContain(sessionId);

            // Get transport for the session
            const transport = server.getTransportForSession(sessionId);
            expect(transport).toBeTruthy();

            // Simulate client disconnect by sending DELETE request (standard MCP way)
            const deleteResponse = await fetch(baseUrl, {
                method: "DELETE",
                headers: {
                    "mcp-session-id": sessionId,
                    "mcp-protocol-version": "2025-03-26"
                }
            });
            expect(deleteResponse.status).toBe(200);

            // Session should be cleaned up
            // Note: cleanup might be async, so we give it a moment
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(server.getActiveSessions()).not.toContain(sessionId);
        });
    });
}); 
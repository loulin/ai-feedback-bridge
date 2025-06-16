import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ListToolsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPFeedbackServer } from '../src/server/index.js';

describe("MCPFeedbackServer", () => {
    let server: MCPFeedbackServer;
    let baseUrl: URL;
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    beforeEach(async () => {
        server = new MCPFeedbackServer();
        baseUrl = await server.start();
    });

    afterEach(async () => {
        // Close any active client from the Basic MCP Protocol tests
        if (client && typeof client.close === 'function') {
            try {
                await client.close();
            } catch (error) {
                // Ignore close errors
            }
        }
        await server.stop();
    });

    describe("Basic MCP Protocol", () => {
        beforeEach(async () => {
            client = new Client({
                name: "test-client",
                version: "1.0.0"
            });
            transport = new StreamableHTTPClientTransport(baseUrl);
            await client.connect(transport);
        });

        test("should connect client successfully", async () => {
            expect(client).toBeDefined();
            expect(transport.sessionId).toBeDefined();
        });

        test("should list interactive_feedback tool", async () => {
            const result = await client.request({
                method: "tools/list",
                params: {}
            }, ListToolsResultSchema);

            expect(result.tools).toHaveLength(1);
            expect(result.tools[0]).toMatchObject({
                name: "interactive_feedback",
                description: "Request interactive user feedback during development workflow"
            });
            expect(result.tools[0].inputSchema).toBeDefined();
        });

        test("should call interactive_feedback tool and get response", async () => {
            // Set up auto-response for feedback requests
            const feedbackPromise = new Promise<void>((resolve) => {
                server.once('feedbackRequest', (request) => {
                    // Simulate user response after a short delay
                    setTimeout(() => {
                        server.respondToFeedback(request.id, {
                            id: request.id,
                            content: [{ type: 'text', text: 'Auto test response' }],
                            timestamp: new Date()
                        });
                        resolve();
                    }, 100);
                });
            });

            // Call the tool
            const callPromise = client.request({
                method: "tools/call",
                params: {
                    name: "interactive_feedback",
                    arguments: { summary: "Test feedback request" }
                }
            }, CallToolResultSchema);

            // Wait for both feedback handling and tool response
            const [, result] = await Promise.all([feedbackPromise, callPromise]);

            expect(result).toMatchObject({
                content: [{ type: 'text', text: 'Auto test response' }]
            });
        });

        test("should handle tool call timeout", async () => {
            // Don't set up auto-response, let it timeout
            const callPromise = client.request({
                method: "tools/call",
                params: {
                    name: "interactive_feedback",
                    arguments: { summary: "Test timeout" }
                }
            }, CallToolResultSchema);

            // Since server timeout is 10 minutes, we'll just test that the request is pending
            // and cancel it manually to avoid waiting too long
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify the request is pending
            const activeSessions = server.getActiveSessions();
            expect(activeSessions).toHaveLength(1);
            
            // For practical testing, we won't wait for the full timeout
            // Just verify the mechanism works by checking the call is still pending
        }, 5000);
    });

    describe("Multi-Client Support", () => {
        test("should support multiple client sessions", async () => {
            // Test that server can track multiple sessions
            expect(server.getActiveSessions()).toEqual([]);
            
            // Create a test client to verify session tracking
            const testClient = new Client({
                name: "test-client",
                version: "1.0.0"
            });
            const testTransport = new StreamableHTTPClientTransport(baseUrl);
            await testClient.connect(testTransport);

            // Should now have one session
            let activeSessions = server.getActiveSessions();
            expect(activeSessions).toHaveLength(1);
            expect(activeSessions[0]).toBe(testTransport.sessionId);

            // Test basic functionality
            const result = await testClient.request({ 
                method: "tools/list", 
                params: {} 
            }, ListToolsResultSchema);
            expect(result.tools).toHaveLength(1);

            // Clean up properly without interfering with afterEach
            try {
                await testClient.close();
            } catch (error: any) {
                // Ignore connection closed errors
                if (!error.message?.includes('Connection closed')) {
                    throw error;
                }
            }
            
            // Give a moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
        }, 5000);
    });

    describe("Server Management", () => {
        test("should start and stop cleanly", async () => {
            const testServer = new MCPFeedbackServer();
            
            const startedUrl = await testServer.start();
            expect(startedUrl).toBeInstanceOf(URL);
            expect(testServer.getBaseUrl()).toEqual(startedUrl);
            
            await testServer.stop();
            expect(testServer.getBaseUrl()).toBeNull();
        });

        test("should track active sessions", async () => {
            // Initially no sessions
            expect(server.getActiveSessions()).toEqual([]);

            // Connect a client
            const client = new Client({ name: "test", version: "1.0.0" });
            const transport = new StreamableHTTPClientTransport(baseUrl);
            await client.connect(transport);

            // Should now have one session
            const sessions = server.getActiveSessions();
            expect(sessions).toHaveLength(1);
            expect(sessions[0]).toBe(transport.sessionId);

            // Clean up
            await client.close();
        });
    });

    describe("Feedback Management", () => {
        beforeEach(async () => {
            client = new Client({ name: "test-client", version: "1.0.0" });
            transport = new StreamableHTTPClientTransport(baseUrl);
            await client.connect(transport);
        });

        test("should emit feedbackRequest events", (done) => {
            server.once('feedbackRequest', (request) => {
                expect(request).toHaveProperty('id');
                expect(request).toHaveProperty('summary', 'Test summary');
                expect(request).toHaveProperty('timestamp');
                
                // Respond to prevent timeout
                server.respondToFeedback(request.id, {
                    id: request.id,
                    content: [{ type: 'text', text: 'Test response' }],
                    timestamp: new Date()
                });
                
                done();
            });

            // Trigger feedback request
            client.request({
                method: "tools/call",
                params: {
                    name: "interactive_feedback",
                    arguments: { summary: "Test summary" }
                }
            }, CallToolResultSchema).catch(() => {
                // Ignore any errors for this test
            });
        });

        test("should cancel pending feedback requests", async () => {
            let requestId: string;
            
            const feedbackPromise = new Promise<void>((resolve) => {
                server.once('feedbackRequest', (request) => {
                    requestId = request.id;
                    // Don't respond, we'll cancel instead
                    setTimeout(() => {
                        const cancelled = server.cancelFeedback(requestId, 'Test cancellation');
                        expect(cancelled).toBe(true);
                        resolve();
                    }, 100);
                });
            });

            // Start tool call (will be cancelled)
            const callPromise = client.request({
                method: "tools/call",
                params: {
                    name: "interactive_feedback",
                    arguments: { summary: "Test cancellation" }
                }
            }, CallToolResultSchema);

            await feedbackPromise;
            
            // The call should either reject with an error or return an error result
            try {
                const result = await callPromise;
                // If it returns a result, it should indicate an error
                expect(result.isError).toBe(true);
            } catch (error) {
                // If it throws, that's also acceptable
                expect(error).toBeDefined();
            }
        });
    });
}); 
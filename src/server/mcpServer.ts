import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { EventEmitter } from 'events';
import type { UserFeedbackRequest, PendingRequest } from './types.js';

/**
 * Create MCP server instance and register interactive_feedback tool
 */
export function createMcpServerWithFeedback(
    eventEmitter: EventEmitter,
    pendingRequests: Map<string, PendingRequest>,
): McpServer {
    const mcpServer = new McpServer(
        { name: 'AI Feedback Bridge', version: '1.0.0' },
        { capabilities: { logging: {} } },
    );

    // Register interactive feedback tool
    mcpServer.tool(
        'interactive_feedback',
        'Request interactive user feedback during development workflow',
        {
            summary: z.string().describe('Summarize your answer'),
        },
        async ({ summary }: { summary: string }): Promise<CallToolResult> => {
            console.log(`Interactive feedback requested: ${summary}`);

            return new Promise((resolve, reject) => {
                const requestId = randomUUID();
                const request: UserFeedbackRequest = {
                    id: requestId,
                    summary,
                    timestamp: new Date(),
                };

                // Set up timeout (5 minutes)
                const timer = setTimeout(() => {
                    pendingRequests.delete(requestId);
                    reject(new Error('Request timeout - no user response received'));
                }, 300000);

                // Store the pending request
                pendingRequests.set(requestId, {
                    resolve,
                    reject,
                    timer,
                });

                // Emit event for UI layer to handle
                eventEmitter.emit('feedbackRequest', request);
            });
        },
    );

    return mcpServer;
}

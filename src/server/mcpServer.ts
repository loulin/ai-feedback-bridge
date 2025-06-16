import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "events";
import { UserFeedbackRequest, PendingRequest } from './types.js';

/**
 * 创建MCP服务器实例，并注册interactive_feedback工具
 */
export function createMcpServerWithFeedback(
    eventEmitter: EventEmitter,
    pendingRequests: Map<string, PendingRequest>,
): McpServer {
    const mcpServer = new McpServer(
        { name: 'AI Feedback Bridge', version: '1.0.0' },
        { capabilities: { logging: {} } }
    );

    // Register interactive feedback tool
    mcpServer.tool(
        'interactive_feedback',
        'Request interactive user feedback during development workflow',
        {
            summary: z.string().describe("Summarize your answer")
        },
      async ({ summary }: { summary: string }): Promise<CallToolResult> => {
        console.log(`Interactive feedback requested: ${summary}`);

        return new Promise((resolve, reject) => {
          const requestId = randomUUID();
          const request: UserFeedbackRequest = {
            id: requestId,
            summary,
            timestamp: new Date()
          };

          // Set up timeout (10 minutes)
          const timer = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error('Request timeout - no user response received'));
          }, 600000);

          // Store the pending request
          pendingRequests.set(requestId, {
            resolve,
            reject,
            timer
          });

          // Emit event for UI layer to handle
          eventEmitter.emit('feedbackRequest', request);
        });
      }
    );

    return mcpServer;
}

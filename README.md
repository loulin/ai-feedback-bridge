# MCP Interactive Extension

AI Feedback Bridge - Bridge between AI clients and VSCode for interactive feedback and real-time collaboration

## Overview

This VSCode extension provides a simplified MCP (Model Context Protocol) server implementation that enables interactive feedback between AI clients and VSCode. The server exposes an `interactive_feedback` tool that allows AI assistants to request user input during development workflows.

## Architecture

### Simplified Design

The extension now follows the official MCP SDK patterns with a greatly simplified architecture:

```
src/
├── extension.ts              # VSCode extension entry point
├── mcpServer/
│   └── server.ts            # Simplified MCP server implementation
└── webview/
    └── provider.ts          # Webview provider for user interaction
```

### Key Components

- **MCPFeedbackServer**: Core server implementation using official MCP SDK
  - Direct use of `McpServer` and `StreamableHTTPServerTransport` from SDK
  - Minimal abstraction layers
  - Built-in session management and CORS support

- **Interactive Feedback Tool**: Single tool for user interaction
  - Name: `interactive_feedback`
  - Input: `{ summary: string }`
  - Output: User response text

## Testing

### New Test Architecture

The test suite is completely rewritten following official MCP SDK patterns:

```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

### Test Features

- **Real HTTP Server Testing**: Tests against actual HTTP server instances
- **SSE Stream Testing**: Validates Server-Sent Events functionality
- **Session Management**: Tests session lifecycle and validation
- **CORS Support**: Validates cross-origin request handling
- **Error Cases**: Tests various error conditions and edge cases

### Test Structure

```typescript
// Example test pattern following official SDK
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

    test("should handle initialization", async () => {
        const response = await sendPostRequest(baseUrl, initMessage);
        expect(response.status).toBe(200);
        // ... more assertions
    });
});
```

## Usage

### Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Compile TypeScript**:
   ```bash
   npm run compile
   ```

4. **Package extension**:
   ```bash
   npm run package
   ```

### In VSCode

1. Install the extension
2. Use Command Palette: "Start MCP Server"
3. Server runs on port 8765 by default
4. Connect AI clients to `http://localhost:8765`

### MCP Client Usage

```bash
# Initialize connection
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "clientInfo": {"name": "test-client", "version": "1.0"},
      "protocolVersion": "2025-03-26",
      "capabilities": {}
    },
    "id": "init-1"
  }'

# List available tools
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": "tools-1"
  }'

# Call interactive feedback tool
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "interactive_feedback",
      "arguments": {"summary": "Need user input for next step"}
    },
    "id": "call-1"
  }'
```

## Configuration

### Settings

- `mcpExtension.server.port`: Server port (default: 8765)
- `mcpExtension.ui.autoOpen`: Auto-open panel on activation (default: true)

### Environment

- Node.js 18+ (for native fetch support)
- VSCode 1.85.0+

## Development Notes

### Removed Complexity

The previous implementation had unnecessary abstractions:
- ❌ BaseTransportHandler hierarchy
- ❌ Custom session management
- ❌ Multiple transport implementations  
- ❌ Complex configuration system

### Current Simplicity

The new implementation follows official patterns:
- ✅ Direct SDK usage
- ✅ Single transport implementation
- ✅ Built-in session management
- ✅ Minimal configuration

### Testing Philosophy

Tests now follow official SDK patterns:
- Real HTTP requests using `fetch`
- Actual SSE stream parsing
- End-to-end protocol validation
- No mocking of core SDK functionality

## Dependencies

### Runtime
- `@modelcontextprotocol/sdk`: Official MCP SDK
- `zod`: Schema validation

### Development
- `jest`: Testing framework
- `undici`: Fetch polyfill for tests
- `typescript`: Type checking
- `@types/*`: Type definitions

## Contributing

1. Follow the simplified architecture patterns
2. Write tests that mirror official SDK test patterns
3. Avoid unnecessary abstractions
4. Use direct SDK APIs when possible

## License

MIT License - see LICENSE file for details. 
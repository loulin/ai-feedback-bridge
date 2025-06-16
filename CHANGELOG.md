# Change Log

All notable changes to the "AI Feedback Bridge" extension will be documented in this file.

## [1.0.0] - 2025-06-16

### Added
- 🎉 Initial release of AI Feedback Bridge
- 🔗 Full MCP (Model Context Protocol) support
- 🌐 Dual protocol support: HTTP and SSE (Server-Sent Events)
- 📱 Native VSCode sidebar integration with interactive panel
- ⚡ Real-time feedback requests from AI assistants
- 🎯 Simple configuration - works out of the box
- 🚀 Auto-start functionality - MCP server starts automatically
- 🔧 Configurable server port and timeout settings
- 🎨 Auto-opening panel for incoming feedback requests
- 🛡️ Built-in session management and CORS support
- 📊 Active session tracking for multiple AI clients
- ⚙️ Command palette integration with start/stop/restart commands

### Technical Features
- Built on official MCP SDK v1.12.1
- TypeScript implementation with full type safety
- Comprehensive test suite (Jest)
- HTTP server with streamable transport
- SSE endpoint for compatible AI clients
- Zod schema validation
- Event-driven feedback handling

### Supported AI Clients
- ✅ Cursor
- ✅ VSCode-based editors with AI extensions
- ✅ Lingma (SSE mode)
- ✅ Any VSCode-based MCP-compatible client
- ❌ Claude Desktop (not supported - not VSCode-based)

### Configuration Options
- `mcpExtension.server.port`: MCP server port (default: 8765)
- `mcpExtension.server.timeout`: Request timeout (default: 300000ms/5 minutes)
- `mcpExtension.ui.autoOpen`: Auto-open panel (default: true)

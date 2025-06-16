# AI Feedback Bridge

A VSCode extension that enables real-time interactive feedback between AI assistants and VSCode during development workflows.

## 📋 Features

- 🔗 **MCP Protocol Support** - Based on Model Context Protocol standard
- 🌐 **Multiple Connection Types** - Supports HTTP and SSE (Server-Sent Events)
- 🔄 **Real-time Interaction** - AI assistants can request user feedback
- 🎯 **Simple Configuration** - Works out of the box
- 📱 **Built-in Interface** - VSCode sidebar integrated panel
- ⚡ **Auto-start** - MCP server starts automatically when extension is activated

## 🚀 Quick Start

### 1. Install Extension

Search for "AI Feedback Bridge" in VSCode Extensions panel (`Ctrl+Shift+X`) and install it.

### 2. Automatic Setup

- The MCP server starts automatically when the extension is activated
- Server runs on port 8765 by default
- No manual startup required

### 3. Configure AI Client

Based on your AI client type, add the following configuration:

#### Standard MCP Clients (Cursor, VSCode-based editors)

```json
{
  "mcpServers": {
    "ai-feedback-bridge": {
      "url": "http://127.0.0.1:8765/mcp"
    }
  }
}
```

#### SSE-only Clients (Lingma, etc.)

```json
{
  "mcpServers": {
    "ai-feedback-bridge": {
      "url": "http://127.0.0.1:8765/sse"
    }
  }
}
```

### 4. Configure AI Rules

To make AI assistants use the interactive feedback feature, add rules to your AI configuration or mention in conversation:

#### For AI Rules/System Prompts
```
Always call the MCP `interactive_feedback` tool when you need user input, clarification, or confirmation during development tasks.
```

#### In Conversation
You can explicitly ask AI to use feedback:
```
Please use interactive_feedback to ask me about the implementation details.
```

## 💡 Usage

1. **Auto-start Service**: MCP server starts automatically when extension activates
2. **Open Interactive Panel**: Use command "AI Bridge: Open AI Bridge Panel" or click the plug icon in activity bar
3. **AI Interaction**: When AI assistant requests feedback, it appears in the panel
4. **Provide Feedback**: Type your response in the panel and send

## ⚙️ Settings

Configure in VSCode settings:

- `mcpExtension.server.port`: Server port (default: 8765)
- `mcpExtension.server.timeout`: Request timeout (default: 300000ms/5 minutes)
- `mcpExtension.ui.autoOpen`: Auto-open panel (default: true)

## 🔧 Troubleshooting

### Q: Port 8765 is occupied?
A: Change `mcpExtension.server.port` in settings to another port, then restart VSCode.

### Q: AI client connection failed?
A: Check firewall settings, ensure port 8765 is accessible, or try restarting VSCode.

### Q: Feedback panel not showing?
A: Ensure `mcpExtension.ui.autoOpen` is enabled, or manually open via command "AI Bridge: Open AI Bridge Panel".

### Q: AI doesn't use interactive feedback?
A: Add rules to your AI configuration or explicitly ask AI to use the `interactive_feedback` tool in conversation.

### Q: Which AI clients are supported?
A: All VSCode-based code editors that support MCP protocol, including Cursor, VSCode with AI extensions, Lingma, etc. Note: Claude Desktop is not supported as it's not VSCode-based.

## 📝 Changelog

### v1.0.0
- Initial release
- MCP protocol standard support
- HTTP and SSE dual protocol support
- VSCode integrated panel
- Real-time feedback interaction
- Auto-start functionality

## 🤝 Contributing

Welcome to submit Issues and Pull Requests to improve this extension.

## 📄 License

MIT License

## 🔗 Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub Repository](https://github.com/loulin/ai-feedback-bridge)
- [Issues](https://github.com/loulin/ai-feedback-bridge/issues) 
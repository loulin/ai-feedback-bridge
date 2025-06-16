# AI反馈桥接器

VSCode扩展，实现AI客户端与VSCode之间的实时交互反馈桥梁。

## 🎯 核心功能

这个VSCode扩展基于MCP(模型上下文协议)标准，让AI助手能够在开发过程中与用户进行实时交互：

- **实时反馈请求** - AI助手可以随时向用户询问问题或请求确认
- **双协议支持** - 同时支持标准HTTP和SSE(Server-Sent Events)连接
- **即插即用** - 简单配置，快速上手
- **界面集成** - VSCode侧边栏原生面板，无需额外窗口
- **自动启动** - 扩展激活时自动启动MCP服务

## 📦 安装指南

### 方式一：VSCode市场安装

1. 打开VSCode
2. 进入扩展面板 (`Ctrl+Shift+X`)
3. 搜索 "AI Feedback Bridge"
4. 点击安装

## 🚀 快速配置

### 第一步：自动设置

- 扩展激活时MCP服务自动启动
- 服务默认运行在端口8765
- 无需手动启动

### 第二步：配置你的AI客户端

根据使用的AI客户端类型，选择对应配置：

#### 🟢 标准MCP客户端 (Cursor、基于VSCode的编辑器)

在客户端配置文件中添加：

```json
{
  "mcpServers": {
    "ai-feedback-bridge": {
      "url": "http://127.0.0.1:8765/mcp"
    }
  }
}
```

#### 🟡 SSE专用客户端 (Lingma等)

使用SSE端点配置：

```json
{
  "mcpServers": {
    "ai-feedback-bridge": {
      "url": "http://127.0.0.1:8765/sse"
    }
  }
}
```

### 第三步：配置AI规则

为了让AI助手使用交互反馈功能，需要在AI配置中添加规则或在对话中明确要求：

#### AI规则/系统提示词
```
在开发任务中需要用户输入、澄清或确认时，总是调用MCP的 `interactive_feedback` 工具。
```

#### 对话中明确要求
你可以在对话中明确要求AI使用反馈功能：
```
请使用interactive_feedback向我提问。
```

## 🎮 使用方法

### 基础操作

1. **自动启动服务** 
   - 扩展激活时服务自动启动
   - 状态栏显示服务状态

2. **打开交互面板**
   - 使用命令 "AI Bridge: Open AI Bridge Panel"
   - 或点击左侧活动栏的插头图标

3. **交互流程**
   - AI助手发送反馈请求
   - 请求显示在面板中
   - 你输入回复并发送
   - AI助手接收到你的反馈

## ⚙️ 设置选项

在VSCode设置中搜索 "mcp" 找到以下选项：

| 设置项 | 说明 | 默认值 |
|-------|------|--------|
| `mcpExtension.server.port` | MCP服务端口 | 8765 |
| `mcpExtension.server.timeout` | 请求超时时间 | 300000ms (5分钟) |
| `mcpExtension.ui.autoOpen` | 自动打开反馈面板 | true |

## 🛠️ 故障排除

### 常见问题

**Q1: 端口8765被占用**
- 解决：设置中修改 `mcpExtension.server.port` 为其他端口
- 重启VSCode生效

**Q2: AI客户端无法连接**
- 检查端口是否被防火墙阻止
- 确认MCP服务已正常启动
- 尝试重启VSCode

**Q3: 反馈面板不显示**
- 确认设置 `mcpExtension.ui.autoOpen` 已启用
- 手动打开：使用命令 "AI Bridge: Open AI Bridge Panel"

**Q4: AI不使用交互反馈功能**
- 在AI配置中添加相关规则，或在对话中明确要求AI使用 `interactive_feedback` 工具

**Q5: 支持哪些AI客户端？**
- 所有基于VSCode的代码编辑器，支持MCP协议
- 包括：Cursor、VSCode配合AI扩展、Lingma等
- 注意：不支持Claude Desktop（非VSCode架构）

## 🔄 版本更新

### v1.0.0 (当前版本)
- ✨ 首次发布
- ✅ MCP协议完整支持
- ✅ HTTP + SSE双协议
- ✅ VSCode原生集成
- ✅ 实时交互反馈
- ✅ 自动启动功能

## 💡 使用场景

### 代码审查
AI助手询问特定代码段的意图或实现细节

### 需求确认
开发过程中确认功能需求或设计决策

### 错误调试
AI协助排查问题时询问环境信息或错误详情

### 代码生成
生成代码前确认具体需求和偏好设置

## 🤝 参与贡献

### 反馈问题
- [GitHub Issues](https://github.com/loulin/ai-feedback-bridge/issues)
- 描述问题时请包含：
  - VSCode版本
  - 扩展版本
  - AI客户端类型
  - 错误日志

### 功能建议
欢迎在GitHub Issues中提出新功能建议

### 代码贡献
1. Fork项目
2. 创建功能分支
3. 提交Pull Request

## 📚 相关资源

- [MCP协议官方文档](https://modelcontextprotocol.io/)
- [VSCode扩展开发指南](https://code.visualstudio.com/api)
- [项目GitHub地址](https://github.com/loulin/ai-feedback-bridge)

## 📄 许可证

MIT License - 详见LICENSE文件

---

**让AI助手与你的开发工作流程无缝集成，提升编程体验！** 🚀 
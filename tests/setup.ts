// Jest测试环境设置
import 'jest';
import { fetch, Request, Response } from 'undici';

// 扩展global类型
declare global {
  var vscode: any;
}

// 模拟VSCode API
(global as any).vscode = {} as any;

// 模拟EventSource（在Node.js环境中不存在）
(global as any).EventSource = class MockEventSource {
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    // 模拟异步连接建立
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
      // 模拟发送sessionId消息
      setTimeout(() => {
        if (this.onmessage) {
          const event = {
            data: JSON.stringify({ sessionId: `test-session-${Date.now()}` }),
            type: 'message'
          } as MessageEvent;
          this.onmessage(event);
        }
      }, 50);
    }, 50);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === 'open') {
      this.onopen = listener as any;
    } else if (type === 'message') {
      this.onmessage = listener as any;
    } else if (type === 'error') {
      this.onerror = listener as any;
    }
  }

  removeEventListener(type: string, listener: EventListener) {
    if (type === 'open') {
      this.onopen = null;
    } else if (type === 'message') {
      this.onmessage = null;
    } else if (type === 'error') {
      this.onerror = null;
    }
  }
} as any;

// 在全局范围内设置fetch
(global as any).fetch = fetch;
(global as any).Request = Request;
(global as any).Response = Response;

// 模拟Buffer（如果需要）
if (typeof (global as any).Buffer === 'undefined') {
  (global as any).Buffer = require('buffer').Buffer;
}

// 控制台日志过滤
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args: any[]) => {
  // 在测试中过滤某些日志
  if (!args.some(arg => typeof arg === 'string' && arg.includes('test-debug'))) {
    originalConsoleLog(...args);
  }
};

console.error = (...args: any[]) => {
  // 在测试中保留错误日志
  originalConsoleError(...args);
}; 
const vscode = acquireVsCodeApi();
let autoScrollEnabled = true;
let currentRequestId = null;
let countdownTimers = new Map(); // 存储倒计时定时器
let requestsData = new Map(); // 存储请求数据
let isComposing = false; // 跟踪输入法状态

window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'serverStatus':
            updateServerStatus(message.running);
            break;
        case 'feedbackRequest':
            addFeedbackRequest(message);
            break;
        case 'requestCompleted':
            markRequestCompleted(message.id, message.userResponse, message.responseTime);
            break;
        case 'historyCleared':
            clearConversations();
            break;
        case 'error':
            showError(message.message);
            break;
    }
});

function updateServerStatus(running) {
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');
    const restartButton = document.getElementById('restartButton');
    
    if (running) {
        statusBar.classList.add('status-running');
        statusText.textContent = '🟢 AI Feedback Bridge - Server: Running';
        restartButton.classList.remove('show');
    } else {
        statusBar.classList.remove('status-running');
        statusText.textContent = '🔴 AI Feedback Bridge - Server: Stopped';
        restartButton.classList.add('show');
    }
}

function addFeedbackRequest(request) {
    const conversations = document.getElementById('conversations');
    
    // 如果有当前活跃的请求，先取消它
    if (currentRequestId) {
        cancelPreviousRequest(currentRequestId);
    }
    
    // 存储请求数据
    requestsData.set(request.id, request);
    
    const emptyState = conversations.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const requestDiv = document.createElement('div');
    requestDiv.className = 'feedback-request ai-request';
    requestDiv.id = 'request-' + request.id;
    
    const timestamp = new Date(request.timestamp).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    requestDiv.innerHTML = `
        <div class="request-header">
            <div class="request-timestamp">AI请求 • ${timestamp}</div>
            <div class="request-summary">${request.summary}</div>
        </div>
        <div class="request-body">
            <div class="countdown-info" id="countdown-${request.id}">
                <span class="countdown-text">⏱️ 等待回复中...</span>
                <span class="countdown-timer" id="timer-${request.id}"></span>
            </div>
        </div>
    `;
    
    conversations.appendChild(requestDiv);
    
    // 设置当前请求ID并显示输入区域
    currentRequestId = request.id;
    showInputArea(request);
    
    // 启动倒计时
    startCountdown(request.id, request.startTime, request.timeoutMs);
    
    // 自动滚动到新消息
    if (autoScrollEnabled) {
        scrollToBottom();
    }
}

function showInputArea(request) {
    const fixedTextarea = document.getElementById('fixedTextarea');
    
    // 更新输入框提示，处理换行并截断过长的文本
    const summaryForPlaceholder = request.summary
        .replace(/\n+/g, ' ')  // 将换行符替换为空格
        .substring(0, 30)      // 截断到30个字符
        .trim();
    
    fixedTextarea.placeholder = `回复: ${summaryForPlaceholder}... (Enter发送，Ctrl+Enter强制发送)`;
    
    // 聚焦到输入框并更新按钮状态
    setTimeout(() => {
        fixedTextarea.focus();
        updateSendButtonState();
    }, 100);
}

function hideInputArea() {
    const fixedTextarea = document.getElementById('fixedTextarea');
    
    fixedTextarea.value = '';
    fixedTextarea.placeholder = '等待AI反馈请求...';
    currentRequestId = null;
    updateSendButtonState();
}

function handleFixedTextareaKeydown(event) {
    // Ctrl+Enter 强制发送（绕过输入法检测）
    if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        sendFixedResponse();
        return;
    }
    
    // 普通 Enter 键发送 (非Shift+Enter，且不在输入法输入中)
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
        event.preventDefault();
        sendFixedResponse();
        return;
    }
    
    // 实时更新按钮状态和高度
    setTimeout(() => {
        updateSendButtonState();
        autoResizeTextarea();
    }, 10);
}

function autoResizeTextarea() {
    const textarea = document.getElementById('fixedTextarea');
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = newHeight + 'px';
    
    // 如果达到最大高度，显示滚动条
    if (textarea.scrollHeight > 120) {
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.overflowY = 'hidden';
    }
    
    // 动态调整对话容器的底部边距
    updateConversationsMargin();
}

function updateSendButtonState() {
    const textarea = document.getElementById('fixedTextarea');
    const button = document.getElementById('fixedSendButton');
    const hasContent = textarea.value.trim().length > 0;
    const hasActiveRequest = currentRequestId !== null;
    
    button.disabled = !hasContent || !hasActiveRequest;
}

function sendFixedResponse() {
    if (!currentRequestId) {
        return; // 按钮应该是禁用状态
    }
    
    const textarea = document.getElementById('fixedTextarea');
    const button = document.getElementById('fixedSendButton');
    const response = textarea.value.trim();
    
    if (!response) {
        return; // 按钮应该是禁用状态
    }

    // 发送反馈
    vscode.postMessage({
        type: 'respondToFeedback',
        id: currentRequestId,
        response: response
    });
    
    // 立即标记为已发送状态并清空输入
    button.innerHTML = '<span>⏳</span><span>发送中</span>';
    button.disabled = true;
    textarea.value = '';
    autoResizeTextarea(); // 重置高度
}

function markRequestCompleted(requestId, userResponse, responseTime) {
    const requestDiv = document.getElementById('request-' + requestId);
    if (requestDiv) {
        requestDiv.classList.add('completed');
        
        // 计算响应时间
        const request = findRequestData(requestId);
        if (request) {
            const calculatedResponseTime = new Date().getTime() - new Date(request.startTime).getTime();
            stopCountdown(requestId, calculatedResponseTime);
            
            // 添加用户回复区域
            if (userResponse && userResponse.trim()) {
                addUserResponse(requestDiv, userResponse, responseTime || new Date().toISOString());
            }
        }
    }
    
    // 如果是当前请求，显示成功状态并重置
    if (currentRequestId === requestId) {
        const button = document.getElementById('fixedSendButton');
        if (button) {
            button.innerHTML = '<span>✅</span><span>已发送</span>';
        }
        
        // 延迟重置，让用户看到成功状态
        setTimeout(() => {
            hideInputArea();
            // 重置按钮状态
            const resetButton = document.getElementById('fixedSendButton');
            if (resetButton) {
                resetButton.innerHTML = '<span>➤</span><span>发送</span>';
            }
        }, 1500);
    }
}

function addUserResponse(requestDiv, responseText, responseTime) {
    const responseTimestamp = new Date(responseTime).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const userResponseDiv = document.createElement('div');
    userResponseDiv.className = 'user-response';
    userResponseDiv.innerHTML = `
        <div class="user-response-header">
            <span class="user-response-icon">👤</span>
            <span>用户回复</span>
            <span class="user-response-time">${responseTimestamp}</span>
        </div>
        <div class="user-response-content">${escapeHtml(responseText)}</div>
    `;
    
    requestDiv.appendChild(userResponseDiv);
    
    // 自动滚动到新回复
    if (autoScrollEnabled) {
        setTimeout(() => scrollToBottom(), 100);
    }
}

// HTML转义函数，防止XSS攻击
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function confirmClearHistory() {
    console.log('confirmClearHistory called');
    // 直接发送清空请求，让VSCode扩展端处理确认
    vscode.postMessage({
        type: 'requestClearHistory'
    });
    console.log('requestClearHistory message sent');
}

function handleRestartServer() {
    console.log('handleRestartServer called');
    // 发送重启服务器请求
    vscode.postMessage({
        type: 'restartServer'
    });
    console.log('restartServer message sent');
}

function clearConversations() {
    // 清理所有定时器
    for (const timer of countdownTimers.values()) {
        clearInterval(timer);
    }
    countdownTimers.clear();
    
    // 清理请求数据
    requestsData.clear();
    
    const conversations = document.getElementById('conversations');
    conversations.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <div>等待 AI 反馈请求...</div>
            <div style="font-size: 12px; opacity: 0.7;">当 AI 完成任务时会在这里显示</div>
        </div>
    `;
    
    // 清空历史时不应该清空用户输入，只重置当前请求ID
    currentRequestId = null;
    updateSendButtonState();
}

function scrollToBottom() {
    const container = document.getElementById('conversationsContainer');
    container.scrollTop = container.scrollHeight;
}

function showError(message) {
    // 创建更优雅的错误提示
    const conversations = document.getElementById('conversations');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'feedback-request';
    errorDiv.style.borderColor = 'var(--vscode-inputValidation-errorBorder)';
    errorDiv.innerHTML = `
        <div class="request-header" style="background: var(--vscode-inputValidation-errorBackground);">
            <div class="request-timestamp">${new Date().toLocaleString('zh-CN')}</div>
            <div class="request-summary">❌ 错误信息</div>
        </div>
        <div class="request-body">
            <div style="color: var(--vscode-errorForeground); padding: 12px; background: var(--vscode-inputValidation-errorBackground); border-radius: 4px;">
                ${message}
            </div>
        </div>
    `;
    
    conversations.appendChild(errorDiv);
    scrollToBottom();
    
    // 5秒后自动移除错误消息
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// 监听用户滚动，智能控制自动滚动
document.getElementById('conversationsContainer').addEventListener('scroll', function() {
    const container = this;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
    autoScrollEnabled = isAtBottom;
});

// 监听输入框变化，实时更新按钮状态和高度
document.getElementById('fixedTextarea').addEventListener('input', function() {
    updateSendButtonState();
    autoResizeTextarea();
});

// 添加输入法状态监听
document.getElementById('fixedTextarea').addEventListener('compositionstart', function() {
    isComposing = true;
    console.log('[Panel] Composition started - IME active');
});

document.getElementById('fixedTextarea').addEventListener('compositionend', function() {
    isComposing = false;
    console.log('[Panel] Composition ended - IME inactive');
});

// 添加按键监听
document.getElementById('fixedTextarea').addEventListener('keydown', handleFixedTextareaKeydown);

// 添加按钮点击监听
document.getElementById('fixedSendButton').addEventListener('click', sendFixedResponse);

// 确保DOM加载完成后再绑定清空按钮事件
document.addEventListener('DOMContentLoaded', function() {
    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
        clearButton.addEventListener('click', confirmClearHistory);
        console.log('clearButton event listener added successfully');
    } else {
        console.error('clearButton not found in DOM');
    }
    
    const restartButton = document.getElementById('restartButton');
    if (restartButton) {
        restartButton.addEventListener('click', handleRestartServer);
        console.log('restartButton event listener added successfully');
    } else {
        console.error('restartButton not found in DOM');
    }
    
    // 初始化对话容器边距
    updateConversationsMargin();
    
    // 主动请求服务器状态
    requestServerStatus();
});

// 备用方案：直接绑定（如果DOM已经加载）
const clearButton = document.getElementById('clearButton');
if (clearButton) {
    clearButton.addEventListener('click', confirmClearHistory);
    console.log('clearButton event listener added via backup method');
}

const restartButton = document.getElementById('restartButton');
if (restartButton) {
    restartButton.addEventListener('click', handleRestartServer);
    console.log('restartButton event listener added via backup method');
}

// 如果DOM已经加载，立即调用初始化
if (document.readyState === 'loading') {
    // DOM还在加载中，等待DOMContentLoaded事件
} else {
    // DOM已经加载完成
    updateConversationsMargin();
    // 主动请求服务器状态
    requestServerStatus();
}

// 页面加载完成后主动请求服务器状态
function requestServerStatus() {
    console.log('Requesting server status...');
    vscode.postMessage({
        type: 'requestServerStatus'
    });
}

// 倒计时功能
function startCountdown(requestId, startTimeStr, timeoutMs) {
    const startTime = new Date(startTimeStr);
    const endTime = new Date(startTime.getTime() + timeoutMs);
    
    const timerElement = document.getElementById(`timer-${requestId}`);
    if (!timerElement) {
        return;
    }
    
    const updateTimer = () => {
        const now = new Date();
        const timeLeft = endTime.getTime() - now.getTime();
        
        if (timeLeft <= 0) {
            timerElement.textContent = '⏰ 超时';
            timerElement.style.color = 'var(--vscode-errorForeground)';
            clearInterval(timer);
            countdownTimers.delete(requestId);
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // 剩余时间少于30秒时变为警告色
        if (timeLeft < 30000) {
            timerElement.style.color = 'var(--vscode-editorWarning-foreground)';
        }
    };
    
    // 立即更新一次
    updateTimer();
    
    // 设置定时器
    const timer = setInterval(updateTimer, 1000);
    countdownTimers.set(requestId, timer);
}

function stopCountdown(requestId, responseTime) {
    // 清除定时器
    const timer = countdownTimers.get(requestId);
    if (timer) {
        clearInterval(timer);
        countdownTimers.delete(requestId);
    }
    
    // 更新显示为响应时间
    const countdownElement = document.getElementById(`countdown-${requestId}`);
    if (countdownElement) {
        const minutes = Math.floor(responseTime / 60000);
        const seconds = Math.floor((responseTime % 60000) / 1000);
        const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
        
        countdownElement.innerHTML = `
            <span class="response-time">✅ 已回复，用时: ${timeStr}</span>
        `;
    }
}

function cancelPreviousRequest(requestId) {
    // 停止倒计时
    const timer = countdownTimers.get(requestId);
    if (timer) {
        clearInterval(timer);
        countdownTimers.delete(requestId);
    }
    
    // 更新显示状态
    const countdownElement = document.getElementById(`countdown-${requestId}`);
    if (countdownElement) {
        countdownElement.innerHTML = `
            <span class="cancelled-status">⚠️ 已取消 - 收到新的反馈请求</span>
        `;
    }
    
    // 标记为已取消状态
    const requestDiv = document.getElementById('request-' + requestId);
    if (requestDiv) {
        requestDiv.classList.add('cancelled');
    }
    
    console.log(`[Panel] Previous request ${requestId} cancelled due to new request`);
}

function findRequestData(requestId) {
    return requestsData.get(requestId);
}

function updateConversationsMargin() {
    const inputArea = document.getElementById('inputArea');
    const conversationsContainer = document.getElementById('conversationsContainer');
    
    if (inputArea && conversationsContainer) {
        const inputAreaHeight = inputArea.offsetHeight;
        conversationsContainer.style.marginBottom = inputAreaHeight + 'px';
        
        // 确保滚动位置正确
        if (autoScrollEnabled) {
            setTimeout(() => {
                scrollToBottom();
            }, 10);
        }
    }
}

// 监听窗口大小变化，确保布局正确
window.addEventListener('resize', function() {
    updateConversationsMargin();
}); 
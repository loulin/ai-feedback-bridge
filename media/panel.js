const vscode = acquireVsCodeApi();
let autoScrollEnabled = true;
let currentRequestId = null;
let countdownTimers = new Map(); // Store countdown timers
let requestsData = new Map(); // Store request data
let isComposing = false; // Track IME composition state

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
    
    // If there's a currently active request, cancel it first
    if (currentRequestId) {
        cancelPreviousRequest(currentRequestId);
    }
    
    // Store request data
    requestsData.set(request.id, request);
    
    const emptyState = conversations.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const requestDiv = document.createElement('div');
    requestDiv.className = 'feedback-request ai-request';
    requestDiv.id = 'request-' + request.id;
    
    const timestamp = new Date(request.timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    requestDiv.innerHTML = `
        <div class="request-header">
            <div class="request-timestamp">AI Request • ${timestamp}</div>
            <div class="request-summary">${request.summary}</div>
        </div>
        <div class="request-body">
            <div class="countdown-info" id="countdown-${request.id}">
                <span class="countdown-text">⏱️ Waiting for reply...</span>
                <span class="countdown-timer" id="timer-${request.id}"></span>
            </div>
        </div>
    `;
    
    conversations.appendChild(requestDiv);
    
    // Set current request ID and show input area
    currentRequestId = request.id;
    showInputArea(request);
    
    // Start countdown
    startCountdown(request.id, request.startTime, request.timeoutMs);
    
    // Auto scroll to new message
    if (autoScrollEnabled) {
        scrollToBottom();
    }
}

function showInputArea(request) {
    const fixedTextarea = document.getElementById('fixedTextarea');
    
    // Update input placeholder, handle line breaks and truncate long text
    const summaryForPlaceholder = request.summary
        .replace(/\n+/g, ' ')  // Replace line breaks with spaces
        .substring(0, 30)      // Truncate to 30 characters
        .trim();
    
    fixedTextarea.placeholder = `Reply: ${summaryForPlaceholder}... (Enter to send, Ctrl+Enter to force send)`;
    
    // Focus to input box and update button state
    setTimeout(() => {
        fixedTextarea.focus();
        updateSendButtonState();
    }, 100);
}

function hideInputArea() {
    const fixedTextarea = document.getElementById('fixedTextarea');
    
    fixedTextarea.value = '';
    fixedTextarea.placeholder = 'Waiting for AI feedback requests...';
    currentRequestId = null;
    updateSendButtonState();
}

function handleFixedTextareaKeydown(event) {
    // Ctrl+Enter force send (bypass IME detection)
    if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        sendFixedResponse();
        return;
    }
    
    // Normal Enter key send (not Shift+Enter, and not in IME composition)
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
        event.preventDefault();
        sendFixedResponse();
        return;
    }
    
    // Real-time update button state and height
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
    
    // If max height reached, show scrollbar
    if (textarea.scrollHeight > 120) {
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.overflowY = 'hidden';
    }
    
    // Dynamically adjust conversation container bottom margin
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
        return; // Button should be disabled
    }
    
    const textarea = document.getElementById('fixedTextarea');
    const button = document.getElementById('fixedSendButton');
    const response = textarea.value.trim();
    
    if (!response) {
        return; // Button should be disabled
    }

    // Send feedback
    vscode.postMessage({
        type: 'respondToFeedback',
        id: currentRequestId,
        response: response
    });
    
    // Immediately mark as sent and clear input
    button.innerHTML = '<span>⏳</span><span>Sending</span>';
    button.disabled = true;
    textarea.value = '';
    autoResizeTextarea(); // Reset height
}

function markRequestCompleted(requestId, userResponse, responseTime) {
    const requestDiv = document.getElementById('request-' + requestId);
    if (requestDiv) {
        requestDiv.classList.add('completed');
        
        // Calculate response time
        const request = findRequestData(requestId);
        if (request) {
            const calculatedResponseTime = new Date().getTime() - new Date(request.startTime).getTime();
            stopCountdown(requestId, calculatedResponseTime);
            
            // Add user response area
            if (userResponse && userResponse.trim()) {
                addUserResponse(requestDiv, userResponse, responseTime || new Date().toISOString());
            }
        }
    }
    
    // If this is the current request, show success status and reset
    if (currentRequestId === requestId) {
        const button = document.getElementById('fixedSendButton');
        if (button) {
            button.innerHTML = '<span>✅</span><span>Sent</span>';
        }
        
        // Delay reset to let user see success status
        setTimeout(() => {
            hideInputArea();
            // Reset button state
            const resetButton = document.getElementById('fixedSendButton');
            if (resetButton) {
                resetButton.innerHTML = '<span>➤</span><span>Send</span>';
            }
        }, 1500);
    }
}

function addUserResponse(requestDiv, responseText, responseTime) {
    const responseTimestamp = new Date(responseTime).toLocaleString('en-US', {
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
            <span>User Reply</span>
            <span class="user-response-time">${responseTimestamp}</span>
        </div>
        <div class="user-response-content">${escapeHtml(responseText)}</div>
    `;
    
    requestDiv.appendChild(userResponseDiv);
    
    // Auto scroll to new reply
    if (autoScrollEnabled) {
        setTimeout(() => scrollToBottom(), 100);
    }
}

// HTML escape function to prevent XSS attacks
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function confirmClearHistory() {
    console.log('confirmClearHistory called');
    // Send clear request directly, let VSCode extension handle confirmation
    vscode.postMessage({
        type: 'requestClearHistory'
    });
    console.log('requestClearHistory message sent');
}

function handleRestartServer() {
    console.log('handleRestartServer called');
    // Send restart server request
    vscode.postMessage({
        type: 'restartServer'
    });
    console.log('restartServer message sent');
}

function clearConversations() {
    // Clean up all timers
    for (const timer of countdownTimers.values()) {
        clearInterval(timer);
    }
    countdownTimers.clear();
    
    // Clean up request data
    requestsData.clear();
    
    const conversations = document.getElementById('conversations');
    conversations.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <div>Waiting for AI feedback requests...</div>
            <div style="font-size: 12px; opacity: 0.7;">AI task completion will appear here</div>
        </div>
    `;
    
    // When clearing history, don't clear user input, only reset current request ID
    currentRequestId = null;
    updateSendButtonState();
}

function scrollToBottom() {
    const container = document.getElementById('conversationsContainer');
    container.scrollTop = container.scrollHeight;
}

function showError(message) {
    // Create more elegant error notification
    const conversations = document.getElementById('conversations');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'feedback-request';
    errorDiv.style.borderColor = 'var(--vscode-inputValidation-errorBorder)';
    errorDiv.innerHTML = `
        <div class="request-header" style="background: var(--vscode-inputValidation-errorBackground);">
            <div class="request-timestamp">${new Date().toLocaleString('en-US')}</div>
            <div class="request-summary">❌ Error Message</div>
        </div>
        <div class="request-body">
            <div style="color: var(--vscode-errorForeground); padding: 12px; background: var(--vscode-inputValidation-errorBackground); border-radius: 4px;">
                ${message}
            </div>
        </div>
    `;
    
    conversations.appendChild(errorDiv);
    scrollToBottom();
    
    // Auto remove error message after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Listen to user scroll, intelligently control auto scroll
document.getElementById('conversationsContainer').addEventListener('scroll', function() {
    const container = this;
    const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
    autoScrollEnabled = isAtBottom;
});

// Listen to input changes, real-time update button state and height
document.getElementById('fixedTextarea').addEventListener('input', function() {
    updateSendButtonState();
    autoResizeTextarea();
});

// Add IME status listeners
document.getElementById('fixedTextarea').addEventListener('compositionstart', function() {
    isComposing = true;
    console.log('[Panel] Composition started - IME active');
});

document.getElementById('fixedTextarea').addEventListener('compositionend', function() {
    isComposing = false;
    console.log('[Panel] Composition ended - IME inactive');
});

// Add keydown listeners
document.getElementById('fixedTextarea').addEventListener('keydown', handleFixedTextareaKeydown);

// Add button click listeners
document.getElementById('fixedSendButton').addEventListener('click', sendFixedResponse);

// Ensure DOM is loaded before binding clear button events
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
    
    // Initialize conversation container margins
    updateConversationsMargin();
    
    // Actively request server status
    requestServerStatus();
});

// Backup solution: bind directly (if DOM already loaded)
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

// If DOM already loaded, immediately call initialization
if (document.readyState === 'loading') {
    // DOM still loading, wait for DOMContentLoaded event
} else {
    // DOM already loaded
    updateConversationsMargin();
    // Actively request server status
    requestServerStatus();
}

// Actively request server status after page loaded
function requestServerStatus() {
    console.log('Requesting server status...');
    vscode.postMessage({
        type: 'requestServerStatus'
    });
}

// Countdown functionality
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
            timerElement.textContent = '⏰ Timeout';
            timerElement.style.color = 'var(--vscode-errorForeground)';
            clearInterval(timer);
            countdownTimers.delete(requestId);
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Change to warning color when less than 30 seconds remaining
        if (timeLeft < 30000) {
            timerElement.style.color = 'var(--vscode-editorWarning-foreground)';
        }
    };
    
    // Update immediately once
    updateTimer();
    
    // Set timer
    const timer = setInterval(updateTimer, 1000);
    countdownTimers.set(requestId, timer);
}

function stopCountdown(requestId, responseTime) {
    // Clear timer
    const timer = countdownTimers.get(requestId);
    if (timer) {
        clearInterval(timer);
        countdownTimers.delete(requestId);
    }
    
    // Update display to response time
    const countdownElement = document.getElementById(`countdown-${requestId}`);
    if (countdownElement) {
        const minutes = Math.floor(responseTime / 60000);
        const seconds = Math.floor((responseTime % 60000) / 1000);
        const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        
        countdownElement.innerHTML = `
            <span class="response-time">✅ Replied, Time taken: ${timeStr}</span>
        `;
    }
}

function cancelPreviousRequest(requestId) {
    // Stop countdown
    const timer = countdownTimers.get(requestId);
    if (timer) {
        clearInterval(timer);
        countdownTimers.delete(requestId);
    }
    
    // Update display status
    const countdownElement = document.getElementById(`countdown-${requestId}`);
    if (countdownElement) {
        countdownElement.innerHTML = `
            <span class="cancelled-status">⚠️ Cancelled - New feedback request received</span>
        `;
    }
    
    // Mark as cancelled status
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
        
        // Ensure scroll position is correct
        if (autoScrollEnabled) {
            setTimeout(() => {
                scrollToBottom();
            }, 10);
        }
    }
}

// Listen to window resize, ensure correct layout
window.addEventListener('resize', function() {
    updateConversationsMargin();
}); 
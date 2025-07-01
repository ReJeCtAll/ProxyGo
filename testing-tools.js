// testing-tools.js
document.addEventListener('DOMContentLoaded', function() {
  // 初始化网络诊断功能模块
  initNetworkDiagnostics();
});

// =============== 网络诊断工具 ===============
function initNetworkDiagnostics() {
  const testUrlInput = document.querySelector('#network-diagnostics-content #testUrl');
  const testButton = document.querySelector('#network-diagnostics-content #testButton');
  const useProxyCheckbox = document.getElementById('useProxy');
  const showHeadersCheckbox = document.getElementById('showHeaders');
  const showTimingCheckbox = document.getElementById('showTiming');
  const testStatus = document.getElementById('testStatus');
  const testResults = document.getElementById('testResults');
  const resultCards = document.getElementById('resultCards');
  const testHistory = document.getElementById('testHistory');
  const clearHistoryButton = document.getElementById('clearHistoryButton');
  
  // 绑定事件处理程序
  if (testButton) {
    testButton.addEventListener('click', runTest);
  }
  if (testUrlInput) {
    testUrlInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        runTest();
      }
    });
  }
  if (clearHistoryButton) {
    clearHistoryButton.addEventListener('click', clearHistory);
  }
  
  // 加载测试历史
  loadTestHistory();
  
  // 执行测试
  function runTest() {
    if (!testUrlInput || !testStatus || !testResults) return;
    
    const url = testUrlInput.value.trim();
    
    if (!url) {
      alert('请输入要测试的URL');
      return;
    }
    
    // 验证URL格式
    try {
      new URL(url);
    } catch (e) {
      alert('请输入有效的URL格式（包括https://或http://）');
      return;
    }
    
    // 显示测试状态
    testStatus.style.display = 'flex';
    testResults.style.display = 'none';
    
    const startTime = Date.now();
    
    // 创建测试选项
    const testOptions = {
      useProxy: useProxyCheckbox ? useProxyCheckbox.checked : false,
      showHeaders: showHeadersCheckbox ? showHeadersCheckbox.checked : false,
      showTiming: showTimingCheckbox ? showTimingCheckbox.checked : false
    };
    
    // 使用fetch进行网络测试
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors' // 避免CORS问题
    })
    .then(response => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      const result = {
        status: response.status || 200,
        statusText: response.statusText || 'OK',
        headers: {},
        responseType: response.type,
        url: response.url || url,
        redirected: response.redirected
      };
      
      // 获取响应头（如果可用）
      if (response.headers && testOptions.showHeaders) {
        for (let [key, value] of response.headers.entries()) {
          result.headers[key] = value;
        }
      }
      
      renderTestResults(url, result, duration);
      addToHistory(url, result);
      
    })
    .catch(error => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      const result = {
        status: 0,
        statusText: error.name === 'AbortError' ? '请求超时' : '连接失败',
        error: error.message,
        headers: {},
        responseType: 'error'
      };
      
      renderTestResults(url, result, duration);
      addToHistory(url, result);
    })
    .finally(() => {
      testStatus.style.display = 'none';
    });
  }
  
  // 渲染测试结果
  function renderTestResults(url, response, duration) {
    if (!resultCards) return;
    
    testResults.style.display = 'block';
    
    const isSuccess = response.status >= 200 && response.status < 400;
    const statusClass = isSuccess ? 'success' : 'error';
    
    let headersHtml = '';
    if (showHeadersCheckbox && showHeadersCheckbox.checked && Object.keys(response.headers).length > 0) {
      headersHtml = `
        <div class="result-card">
          <div class="result-title">响应头信息</div>
          <div class="result-details">
            <div class="headers-content">
              ${Object.entries(response.headers).map(([key, value]) => 
                `<div class="header-item">
                  <span class="header-name">${key}:</span>
                  <span class="header-value">${value}</span>
                </div>`
              ).join('')}
            </div>
          </div>
        </div>
      `;
    }
    
    let timingHtml = '';
    if (showTimingCheckbox && showTimingCheckbox.checked) {
      timingHtml = `
        <div class="result-card">
          <div class="result-title">时间统计</div>
          <div class="result-details">
            <div class="timing-item">
              <span class="timing-label">响应时间:</span>
              <span class="timing-value">${duration}ms</span>
            </div>
            <div class="timing-item">
              <span class="timing-label">连接状态:</span>
              <span class="timing-value">${isSuccess ? '成功' : '失败'}</span>
            </div>
          </div>
        </div>
      `;
    }
    
    const proxyStatus = useProxyCheckbox && useProxyCheckbox.checked ? '是' : '否';
    
    resultCards.innerHTML = `
      <div class="result-card">
        <div class="result-title ${statusClass}">连接测试结果</div>
        <div class="result-details">
          <div class="result-item">
            <span class="result-label">目标URL:</span>
            <span class="result-value">${url}</span>
            <button class="copy-button" onclick="navigator.clipboard.writeText('${url}')">复制</button>
          </div>
          ${response.url && response.url !== url ? `
          <div class="result-item">
            <span class="result-label">最终URL:</span>
            <span class="result-value">${response.url}</span>
          </div>
          ` : ''}
          <div class="result-item">
            <span class="result-label">状态码:</span>
            <span class="result-value status-${statusClass}">${response.status}</span>
          </div>
          <div class="result-item">
            <span class="result-label">状态信息:</span>
            <span class="result-value">${response.statusText}</span>
          </div>
          <div class="result-item">
            <span class="result-label">响应时间:</span>
            <span class="result-value">${duration}ms</span>
          </div>
          <div class="result-item">
            <span class="result-label">使用代理:</span>
            <span class="result-value">${proxyStatus}</span>
          </div>
          ${response.redirected ? `
          <div class="result-item">
            <span class="result-label">重定向:</span>
            <span class="result-value">是</span>
          </div>
          ` : ''}
          ${response.responseType ? `
          <div class="result-item">
            <span class="result-label">响应类型:</span>
            <span class="result-value">${response.responseType}</span>
          </div>
          ` : ''}
          ${response.error ? `
          <div class="result-item">
            <span class="result-label">错误信息:</span>
            <span class="result-value error">${response.error}</span>
          </div>
          ` : ''}
        </div>
      </div>
      ${headersHtml}
      ${timingHtml}
    `;
  }
  
  // 添加到历史记录
  function addToHistory(url, response) {
    chrome.storage.local.get(['testHistory'], function(result) {
      const history = result.testHistory || [];
      
      const historyItem = {
        url: url,
        status: response.status,
        statusText: response.statusText,
        timestamp: Date.now(),
        success: response.status >= 200 && response.status < 400
      };
      
      // 添加到历史记录开头
      history.unshift(historyItem);
      
      // 限制历史记录数量（保留最近50条）
      if (history.length > 50) {
        history.splice(50);
      }
      
      chrome.storage.local.set({ testHistory: history }, function() {
        updateHistoryDisplay(history);
      });
    });
  }
  
  // 更新历史记录显示
  function updateHistoryDisplay(history) {
    if (!testHistory) return;
    
    if (!history || history.length === 0) {
      testHistory.innerHTML = '<div class="empty-history">暂无测试历史</div>';
      return;
    }
    
    testHistory.innerHTML = history.map(item => `
      <div class="history-item" onclick="document.getElementById('testUrl').value='${item.url}'">
        <div class="history-url">${item.url}</div>
        <div class="history-status ${item.success ? 'success' : 'error'}">${item.status}</div>
        <div class="history-time">${formatTimestamp(item.timestamp)}</div>
      </div>
    `).join('');
  }
  
  // 加载测试历史
  function loadTestHistory() {
    chrome.storage.local.get(['testHistory'], function(result) {
      const history = result.testHistory || [];
      updateHistoryDisplay(history);
    });
  }
  
  // 清除历史记录
  function clearHistory() {
    if (confirm('确定要清除所有测试历史记录吗？')) {
      chrome.storage.local.set({ testHistory: [] }, function() {
        updateHistoryDisplay([]);
      });
    }
  }
  
  // 格式化时间戳
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
} 
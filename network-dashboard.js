// network-dashboard.js - 网络透视板功能脚本

// DOM 元素
const refreshBtn = document.getElementById('refreshBtn');
const clearBtn = document.getElementById('clearBtn');
const topDomainsList = document.getElementById('topDomainsList');
const recentRequestsList = document.getElementById('recentRequestsList');

// 调试相关元素
const debugToggleBtn = document.getElementById('debugToggleBtn');
const debugPanel = document.getElementById('debugPanel');
const toggleDebugBtn = document.getElementById('toggleDebug');
const clearLogsBtn = document.getElementById('clearLogs');
const storageDataElement = document.getElementById('storageData');
const collectionStatusElement = document.getElementById('collectionStatus');
const debugLogsElement = document.getElementById('debugLogs');

// 调试日志存储
let debugLogs = [];

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
  loadDashboardData();
  setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
  refreshBtn.addEventListener('click', function() {
    loadDashboardData();
    showToast('数据已刷新', 'success');
  });

  clearBtn.addEventListener('click', function() {
    if (confirm('确定要清除所有网络统计数据吗？此操作不可恢复。')) {
      clearNetworkData();
    }
  });

  // 调试面板事件
  debugToggleBtn.addEventListener('click', function() {
    if (debugPanel.style.display === 'none') {
      debugPanel.style.display = 'block';
      debugToggleBtn.textContent = '隐藏调试信息';
      showDebugInfo();
    } else {
      debugPanel.style.display = 'none';
      debugToggleBtn.textContent = '显示调试信息';
    }
  });

  toggleDebugBtn.addEventListener('click', function() {
    debugPanel.style.display = 'none';
    debugToggleBtn.textContent = '显示调试信息';
  });

  clearLogsBtn.addEventListener('click', function() {
    debugLogs = [];
    updateDebugLogs();
  });

  // 添加测试存储功能按钮
  const testStorageBtn = document.createElement('button');
  testStorageBtn.textContent = '测试存储功能';
  testStorageBtn.className = 'refresh-btn';
  testStorageBtn.style.marginLeft = '8px';
  testStorageBtn.addEventListener('click', testStorageFunction);
  clearLogsBtn.parentNode.appendChild(testStorageBtn);

  // 添加测试数据收集按钮
  const testCollectionBtn = document.createElement('button');
  testCollectionBtn.textContent = '测试数据收集';
  testCollectionBtn.className = 'refresh-btn';
  testCollectionBtn.style.marginLeft = '8px';
  testCollectionBtn.addEventListener('click', testDataCollection);
  clearLogsBtn.parentNode.appendChild(testCollectionBtn);

  // 添加强制刷新按钮
  const forceRefreshBtn = document.createElement('button');
  forceRefreshBtn.textContent = '强制刷新显示';
  forceRefreshBtn.className = 'refresh-btn';
  forceRefreshBtn.style.marginLeft = '8px';
  forceRefreshBtn.addEventListener('click', function() {
    addDebugLog('强制刷新显示...');
    loadDashboardData();
  });
  clearLogsBtn.parentNode.appendChild(forceRefreshBtn);
}

// ✅ 步骤 5: 修改 loadDashboardData() 添加调试信息
function loadDashboardData() {
  addDebugLog('开始加载仪表板数据...');
  
  chrome.runtime.sendMessage({ action: 'getNetworkStats' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('获取网络统计数据失败:', chrome.runtime.lastError);
      addDebugLog('获取网络统计数据失败: ' + chrome.runtime.lastError.message, 'error');
      showErrorState();
      return;
    }

    // 详细记录响应数据
    addDebugLog('收到后台响应: ' + JSON.stringify(response), 'info');
    console.log('完整响应数据:', response);

    if (response) {
      if (response.topDomains && response.recentRequests) {
        addDebugLog(`✅ 数据格式正确: ${response.topDomains.length} 个域名, ${response.recentRequests.length} 条请求`);
        console.log('TOP域名数据:', response.topDomains);
        console.log('最新请求数据:', response.recentRequests);
        renderTopDomains(response.topDomains);
        renderRecentRequests(response.recentRequests);
      } else {
        addDebugLog(`❌ 数据格式错误: topDomains=${!!response.topDomains}, recentRequests=${!!response.recentRequests}`, 'error');
        addDebugLog('响应数据详情: ' + JSON.stringify(response), 'error');
        showEmptyState();
      }
    } else {
      addDebugLog('❌ 后台响应为空', 'error');
      showEmptyState();
    }
  });
}

// 渲染TOP10域名
function renderTopDomains(topDomains) {
  if (!topDomains || topDomains.length === 0) {
    topDomainsList.innerHTML = createEmptyState('📊', '暂无域名访问数据', '开始浏览网页后将在此显示访问量最高的域名');
    return;
  }

  const maxCount = topDomains[0]?.count || 1;
  
  const html = topDomains.map((item, index) => {
    const percentage = (item.count / maxCount) * 100;
    const lastAccess = formatTimeAgo(item.lastAccess);
    
    return `
      <li class="domain-item">
        <div class="domain-info">
          <div class="domain-name">${escapeHtml(item.domain)}</div>
          <div class="domain-count">
            <span class="count-badge">${item.count} 次</span>
            <span class="progress-bar">
              <span class="progress-fill" style="width: ${percentage}%"></span>
            </span>
            <span style="font-size: 11px; color: var(--text-muted);">最后访问: ${lastAccess}</span>
          </div>
        </div>
        <div style="font-size: 18px; font-weight: 700; color: var(--text-muted);">
          #${index + 1}
        </div>
      </li>
    `;
  }).join('');

  topDomainsList.innerHTML = html;
}

// 渲染最新请求记录
function renderRecentRequests(recentRequests) {
  if (!recentRequests || recentRequests.length === 0) {
    recentRequestsList.innerHTML = createEmptyState('🔍', '暂无请求记录', '开始浏览网页后将在此显示最新的域名请求记录');
    return;
  }

  const html = recentRequests.map(request => {
    const time = formatTime(request.timestamp);
    const timeAgo = formatTimeAgo(request.timestamp);
    const proxyClass = request.useProxy ? 'proxy' : 'direct';
    const proxyText = request.useProxy ? '代理' : '直连';
    
    return `
      <li class="request-item">
        <div class="request-info">
          <div class="request-domain">${escapeHtml(request.domain)}</div>
          <div class="request-meta">
            <span class="request-time" title="${time}">${timeAgo}</span>
            <span class="request-ip">IP: ${escapeHtml(request.ip)}</span>
          </div>
        </div>
        <div class="proxy-status ${proxyClass}">
          ${proxyText}
        </div>
      </li>
    `;
  }).join('');

  recentRequestsList.innerHTML = html;
}

// 清除网络数据
function clearNetworkData() {
  chrome.runtime.sendMessage({ action: 'clearNetworkStats' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('清除网络统计数据失败:', chrome.runtime.lastError);
      showToast('清除数据失败', 'error');
      return;
    }

    if (response && response.success) {
      showEmptyState();
      showToast('数据已清除', 'success');
    }
  });
}

// 显示空状态
function showEmptyState() {
  topDomainsList.innerHTML = createEmptyState('📊', '暂无域名访问数据', '开始浏览网页后将在此显示访问量最高的域名');
  recentRequestsList.innerHTML = createEmptyState('🔍', '暂无请求记录', '开始浏览网页后将在此显示最新的域名请求记录');
}

// 显示错误状态
function showErrorState() {
  const errorHtml = createEmptyState('❌', '数据加载失败', '请检查扩展状态或稍后重试');
  topDomainsList.innerHTML = errorHtml;
  recentRequestsList.innerHTML = errorHtml;
}

// 创建空状态HTML
function createEmptyState(icon, title, description) {
  return `
    <div class="empty-state">
      <div style="font-size: 48px; margin-bottom: 16px;">${icon}</div>
      <h3 style="margin: 0 0 8px 0; color: var(--text);">${title}</h3>
      <p style="margin: 0; color: var(--text-muted); font-size: 14px;">${description}</p>
    </div>
  `;
}

// 格式化时间
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 格式化相对时间
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else if (minutes > 0) {
    return `${minutes}分钟前`;
  } else {
    return '刚刚';
  }
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示提示消息
function showToast(message, type = 'info') {
  // 创建提示元素
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    font-size: 14px;
    z-index: 10000;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;
  
  // 根据类型设置背景色
  switch (type) {
    case 'success':
      toast.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      break;
    case 'error':
      toast.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      break;
    default:
      toast.style.background = 'linear-gradient(135deg, #6366f1, #5b5bd6)';
  }
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // 显示动画
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  // 自动隐藏
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// 调试相关功能

// 添加调试日志
function addDebugLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  const logEntry = {
    time: timestamp,
    message: message,
    type: type
  };
  debugLogs.unshift(logEntry);
  
  // 限制日志数量
  if (debugLogs.length > 50) {
    debugLogs = debugLogs.slice(0, 50);
  }
  
  updateDebugLogs();
}

// 更新调试日志显示
function updateDebugLogs() {
  if (!debugLogsElement) return;
  
  const html = debugLogs.map(log => {
    const color = log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#6b7280';
    return `<div style="color: ${color};">[${log.time}] ${log.message}</div>`;
  }).join('');
  
  debugLogsElement.innerHTML = html || '<div style="color: #9ca3af;">暂无日志</div>';
}

// ✅ 步骤 2: 添加 showDebugInfo() 函数
function showDebugInfo() {
  addDebugLog('开始显示调试信息');
  checkStorageData();
  validateNetworkData();
}

// ✅ 步骤 3: 添加 checkStorageData() 函数
function checkStorageData() {
  addDebugLog('正在检查Chrome存储数据...');
  
  chrome.storage.local.get(['networkStats'], function(data) {
    if (chrome.runtime.lastError) {
      addDebugLog('Chrome存储读取失败: ' + chrome.runtime.lastError.message, 'error');
      storageDataElement.textContent = '存储读取错误: ' + chrome.runtime.lastError.message;
      return;
    }
    
    addDebugLog('Chrome存储数据读取成功');
    
    if (data.networkStats) {
      const stats = data.networkStats;
      const domainCount = Object.keys(stats.domainCounts || {}).length;
      const requestCount = (stats.recentRequests || []).length;
      
      addDebugLog(`存储中发现 ${domainCount} 个域名，${requestCount} 条请求记录`);
      
      storageDataElement.textContent = JSON.stringify(data, null, 2);
      
      // 更新数据收集状态
      updateCollectionStatus(stats);
    } else {
      addDebugLog('Chrome存储中未找到networkStats数据', 'warn');
      storageDataElement.textContent = '存储中无网络统计数据';
      updateCollectionStatus(null);
    }
  });
}

// ✅ 步骤 4: 添加 validateNetworkData() 函数
function validateNetworkData() {
  addDebugLog('开始验证网络数据结构...');
  
  chrome.runtime.sendMessage({ action: 'getNetworkStats' }, function(response) {
    if (chrome.runtime.lastError) {
      addDebugLog('获取网络统计数据失败: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    
    if (response) {
      addDebugLog('成功从后台获取网络数据');
      
      // 验证数据结构
      const isValidTopDomains = Array.isArray(response.topDomains);
      const isValidRecentRequests = Array.isArray(response.recentRequests);
      
      addDebugLog(`topDomains 验证: ${isValidTopDomains ? '✅' : '❌'} (${response.topDomains?.length || 0} 项)`);
      addDebugLog(`recentRequests 验证: ${isValidRecentRequests ? '✅' : '❌'} (${response.recentRequests?.length || 0} 项)`);
      
      if (response.topDomains?.length > 0) {
        const firstDomain = response.topDomains[0];
        const hasRequiredFields = firstDomain.domain && firstDomain.count && firstDomain.lastAccess;
        addDebugLog(`域名数据结构验证: ${hasRequiredFields ? '✅' : '❌'}`);
      }
      
      if (response.recentRequests?.length > 0) {
        const firstRequest = response.recentRequests[0];
        const hasRequiredFields = firstRequest.domain && firstRequest.timestamp;
        addDebugLog(`请求数据结构验证: ${hasRequiredFields ? '✅' : '❌'}`);
      }
    } else {
      addDebugLog('后台返回的数据为空', 'warn');
    }
  });
}

// 更新数据收集状态显示
function updateCollectionStatus(stats) {
  if (!collectionStatusElement) return;
  
  let statusHtml = '';
  
  if (stats) {
    const domainCount = Object.keys(stats.domainCounts || {}).length;
    const requestCount = (stats.recentRequests || []).length;
    const lastUpdate = stats.recentRequests?.[0]?.timestamp ? formatTime(stats.recentRequests[0].timestamp) : '无数据';
    
    statusHtml = `
      <div>✅ <strong>数据收集状态：</strong>正常</div>
      <div>📊 <strong>域名总数：</strong>${domainCount} 个</div>
      <div>📝 <strong>请求记录：</strong>${requestCount} 条</div>
      <div>⏰ <strong>最近更新：</strong>${lastUpdate}</div>
    `;
  } else {
    statusHtml = `
      <div>❌ <strong>数据收集状态：</strong>无数据</div>
      <div>💡 <strong>可能原因：</strong>尚未访问任何网页，或数据收集功能异常</div>
    `;
  }
  
  collectionStatusElement.innerHTML = statusHtml;
}

// 测试存储功能
function testStorageFunction() {
  addDebugLog('开始测试Chrome存储功能...');
  
  const testData = {
    networkStats: {
      domainCounts: {
        'test.example.com': { count: 5, lastAccess: Date.now() },
        'demo.test.com': { count: 3, lastAccess: Date.now() - 1000 }
      },
      recentRequests: [
        { timestamp: Date.now(), domain: 'test.example.com', ip: '192.168.1.1', useProxy: true },
        { timestamp: Date.now() - 1000, domain: 'demo.test.com', ip: '10.0.0.1', useProxy: false }
      ]
    }
  };
  
  chrome.storage.local.set(testData, function() {
    if (chrome.runtime.lastError) {
      addDebugLog('存储测试失败: ' + chrome.runtime.lastError.message, 'error');
    } else {
      addDebugLog('存储测试成功，已写入测试数据', 'info');
      
      // 立即读取验证
      chrome.storage.local.get(['networkStats'], function(data) {
        if (chrome.runtime.lastError) {
          addDebugLog('读取测试数据失败: ' + chrome.runtime.lastError.message, 'error');
        } else if (data.networkStats) {
          addDebugLog('读取测试数据成功，存储功能正常', 'info');
          checkStorageData(); // 重新检查存储数据
        } else {
          addDebugLog('读取测试数据失败，未找到数据', 'error');
        }
      });
    }
  });
}

// 测试数据收集功能
function testDataCollection() {
  addDebugLog('开始测试数据收集功能...');
  
  // 向后台发送测试数据收集消息
  chrome.runtime.sendMessage({ 
    action: 'testDataCollection',
    url: 'https://www.example.com/test',
    useProxy: true
  }, function(response) {
    if (chrome.runtime.lastError) {
      addDebugLog('数据收集测试失败: ' + chrome.runtime.lastError.message, 'error');
    } else if (response && response.success) {
      addDebugLog('数据收集测试成功', 'info');
      // 等待一会儿后检查存储
      setTimeout(() => {
        checkStorageData();
        loadDashboardData();
      }, 1000);
    } else {
      addDebugLog('数据收集测试返回失败', 'error');
    }
  });
}

// 自动刷新数据（每30秒）
setInterval(function() {
  loadDashboardData();
}, 30000); 
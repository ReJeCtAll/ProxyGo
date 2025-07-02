// network-dashboard.js - 网络透视板功能脚本

// DOM 元素
const refreshBtn = document.getElementById('refreshBtn');
const clearBtn = document.getElementById('clearBtn');
const topDomainsList = document.getElementById('topDomainsList');
const recentRequestsList = document.getElementById('recentRequestsList');



// 分页状态
let topDomainsState = {
  currentPage: 1,
  itemsPerPage: 10,
  totalItems: 0,
  totalPages: 1,
  data: []
};

let recentRequestsState = {
  currentPage: 1,
  itemsPerPage: 10,
  totalItems: 0,
  totalPages: 1,
  data: []
};

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
}

// 加载仪表板数据
function loadDashboardData() {
  chrome.runtime.sendMessage({ action: 'getNetworkStats' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('获取网络统计数据失败:', chrome.runtime.lastError);
      showErrorState();
      return;
    }

    console.log('完整响应数据:', response);

    if (response) {
      if (response.topDomains && response.recentRequests) {
        console.log('TOP域名数据:', response.topDomains);
        console.log('最新请求数据:', response.recentRequests);
        renderTopDomains(response.topDomains);
        renderRecentRequests(response.recentRequests);
      } else {
        showEmptyState();
      }
    } else {
      showEmptyState();
    }
  });
}

// 渲染TOP10域名
function renderTopDomains(topDomains) {
  // 更新状态
  topDomainsState.data = topDomains || [];
  topDomainsState.totalItems = topDomainsState.data.length;
  
  if (!topDomains || topDomains.length === 0) {
    topDomainsList.innerHTML = createEmptyState('📊', '暂无域名访问数据', '开始浏览网页后将在此显示访问量最高的域名');
    return;
  }

  // 计算当前页数据
  const startIndex = (topDomainsState.currentPage - 1) * topDomainsState.itemsPerPage;
  const endIndex = Math.min(startIndex + topDomainsState.itemsPerPage, topDomainsState.totalItems);
  const currentPageData = topDomainsState.data.slice(startIndex, endIndex);
  
  const maxCount = topDomainsState.data[0]?.count || 1;
  
  const html = currentPageData.map((item, index) => {
    const percentage = (item.count / maxCount) * 100;
    const lastAccess = formatTimeAgo(item.lastAccess);
    
    return `
      <li class="domain-item">
        <div class="domain-info">
          <div class="domain-name" title="${escapeHtml(item.domain)}">${escapeHtml(item.domain)}</div>
          <div class="domain-count">
            <span class="count-badge">${item.count} 次</span>
            <span class="progress-bar">
              <span class="progress-fill" style="width: ${percentage}%"></span>
            </span>
            <span style="font-size: 11px; color: var(--text-muted);">最后: ${lastAccess}</span>
          </div>
        </div>
        <div style="font-size: 18px; font-weight: 700; color: var(--text-muted); flex-shrink: 0; margin-left: 8px;">
          #${startIndex + index + 1}
        </div>
      </li>
    `;
  }).join('');

  topDomainsList.innerHTML = html;
  
  // 渲染分页控件
  renderPagination(topDomainsList.parentNode, topDomainsState, renderTopDomains);
}

// 渲染最新请求记录
function renderRecentRequests(recentRequests) {
  // 更新状态
  recentRequestsState.data = recentRequests || [];
  recentRequestsState.totalItems = recentRequestsState.data.length;
  
  if (!recentRequests || recentRequests.length === 0) {
    recentRequestsList.innerHTML = createEmptyState('🔍', '暂无请求记录', '开始浏览网页后将在此显示最新的域名请求记录');
    return;
  }

  // 计算当前页数据
  const startIndex = (recentRequestsState.currentPage - 1) * recentRequestsState.itemsPerPage;
  const endIndex = Math.min(startIndex + recentRequestsState.itemsPerPage, recentRequestsState.totalItems);
  const currentPageData = recentRequestsState.data.slice(startIndex, endIndex);
  
  const html = currentPageData.map(request => {
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
  
  // 渲染分页控件
  renderPagination(recentRequestsList.parentNode, recentRequestsState, renderRecentRequests);
}

// 渲染分页控件
function renderPagination(container, state, renderFunction) {
  // 清除所有旧的分页控件，避免重复添加
  const oldControls = container.querySelectorAll('.pagination-controls');
  oldControls.forEach(control => {
    container.removeChild(control);
  });
  
  // 创建新的分页控件
  let paginationControls = document.createElement('div');
  paginationControls.className = 'pagination-controls';
  container.appendChild(paginationControls);
  
  // 计算总页数
  const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
  state.totalPages = totalPages;
  
  // 更新分页控件
  paginationControls.innerHTML = `
    <button class="pagination-btn prev-btn" ${state.currentPage <= 1 ? 'disabled' : ''}>上一页</button>
    <span class="pagination-info">第 <span class="current-page">${state.currentPage}</span> 页，共 <span class="total-pages">${totalPages}</span> 页</span>
    <button class="pagination-btn next-btn" ${state.currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
  `;
  
  // 添加事件监听器
  const prevBtn = paginationControls.querySelector('.prev-btn');
  const nextBtn = paginationControls.querySelector('.next-btn');
  
  prevBtn.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderFunction(state.data);
    }
  });
  
  nextBtn.addEventListener('click', () => {
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderFunction(state.data);
    }
  });
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
  
  // 清除分页控件
  const paginationControls = document.querySelectorAll('.pagination-controls');
  paginationControls.forEach(control => {
    control.innerHTML = '';
  });
}

// 显示错误状态
function showErrorState() {
  const errorHtml = createEmptyState('❌', '数据加载失败', '请检查扩展状态或稍后重试');
  topDomainsList.innerHTML = errorHtml;
  recentRequestsList.innerHTML = errorHtml;
  
  // 清除分页控件
  const paginationControls = document.querySelectorAll('.pagination-controls');
  paginationControls.forEach(control => {
    control.innerHTML = '';
  });
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



// 自动刷新数据（每30秒）
setInterval(function() {
  loadDashboardData();
}, 30000); 
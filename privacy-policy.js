// privacy-policy.js - 隐私政策页面交互脚本

document.addEventListener('DOMContentLoaded', function() {
  console.log('隐私政策页面已加载');
  
  // 初始化页面
  initPrivacyPolicyPage();
});

// 初始化隐私政策页面
function initPrivacyPolicyPage() {
  loadVersionInfo();
  setupEventListeners();
  console.log('隐私政策页面初始化完成');
}

// 加载版本信息
function loadVersionInfo() {
  try {
    // 从manifest.json获取版本信息
    const manifestUrl = chrome.runtime.getURL('manifest.json');
    fetch(manifestUrl)
      .then(response => response.json())
      .then(manifest => {
        const version = manifest.version;
        updateVersionDisplay(version);
        console.log(`当前版本: ${version}`);
      })
      .catch(error => {
        console.error('获取版本信息失败:', error);
        // 使用默认版本
        updateVersionDisplay('1.1');
      });
  } catch (error) {
    console.error('加载版本信息失败:', error);
    updateVersionDisplay('1.1');
  }
}

// 更新版本显示
function updateVersionDisplay(version) {
  const versionElements = document.querySelectorAll('#currentVersion, #footerVersion');
  versionElements.forEach(element => {
    if (element) {
      element.textContent = version;
    }
  });
}

// 设置事件监听器
function setupEventListeners() {
  // 为目录链接添加平滑滚动
  const tocLinks = document.querySelectorAll('.policy-toc a');
  tocLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        // 平滑滚动到目标位置
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // 更新URL但不刷新页面
        history.pushState(null, null, targetId);
      }
    });
  });

  // 打印隐私政策
  const printButton = document.getElementById('printPolicy');
  if (printButton) {
    printButton.addEventListener('click', function() {
      window.print();
    });
  }

  // 添加键盘快捷键
  document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + P: 打印
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      window.print();
    }
    
    // ESC: 返回设置页面
    if (e.key === 'Escape') {
      window.location.href = 'settings.html';
    }
  });
}

// 显示提示消息
function showToast(message, type = 'info') {
  // 创建提示元素
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  
  // 添加样式
  Object.assign(toast.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    background: type === 'info' ? 'var(--primary)' : 'var(--success)',
    color: 'white',
    padding: '12px 20px',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    fontSize: '14px',
    boxShadow: 'var(--shadow-lg)',
    zIndex: '1000',
    opacity: '0',
    transform: 'translateX(100%)',
    transition: 'all 0.3s ease'
  });
  
  document.body.appendChild(toast);
  
  // 显示动画
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  // 自动隐藏
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
} 
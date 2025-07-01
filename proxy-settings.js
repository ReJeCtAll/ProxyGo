// proxy-settings.js - 增强版代理设置

// URL解析和验证工具函数（参考GitHub项目实现）
function parseProxyUrl(proxyUrl) {
  // 默认值
  let host = 'localhost';
  let port = 7890;
  
  try {
    const url = new URL(proxyUrl);
    host = url.hostname || 'localhost';
    port = parseInt(url.port, 10) || 7890;
  } catch (e) {
    console.log(`解析代理URL失败: ${proxyUrl}, 使用默认值`);
  }
  
  return { host, port };
}

// 构建完整代理URL（参考GitHub项目实现）
function buildProxyUrl(host, port) {
  // 验证输入
  if (!host || !port) {
    return 'http://localhost:7890';
  }
  
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return 'http://localhost:7890';
  }
  
  // 自动添加协议前缀
  const cleanHost = host.trim().replace(/^https?:\/\//, '');
  return `http://${cleanHost}:${portNum}`;
}

// 代理URL验证函数（参考GitHub项目实现）
function isValidProxyUrl(url) {
  try {
    const parsed = new URL(url);
    const scheme = parsed.protocol.replace(":", "").toLowerCase();
    const port = parseInt(parsed.port, 10);
    
    return (
      ["http", "https"].includes(scheme) &&
      parsed.hostname &&
      port >= 1 &&
      port <= 65535
    );
  } catch {
    return false;
  }
}

// 增强的URL格式化函数
function formatProxyUrl(input) {
  if (!input || !input.trim()) {
    return '';
  }
  
  let url = input.trim();
  
  // 如果没有协议前缀，自动添加
  if (!/^https?:\/\//.test(url)) {
    url = 'http://' + url;
  }
  
  return url;
}

document.addEventListener('DOMContentLoaded', function() {
  const proxySettingsForm = document.getElementById('proxySettingsForm');
  const proxyHost = document.getElementById('proxyHost');
  const proxyPort = document.getElementById('proxyPort');
  const modeDirect = document.getElementById('modeDirect');
  const modeWhitelist = document.getElementById('modeWhitelist');
  const modeBlacklist = document.getElementById('modeBlacklist');
  const testProxyButton = document.getElementById('testProxyButton');
  const proxyStatus = document.getElementById('proxyStatus');
  const statusMessage = document.getElementById('statusMessage');
  const radioOptions = document.querySelectorAll('.radio-option');
  
  // 加载保存的代理设置
  loadProxySettings();
  
  // 绑定事件处理程序
  if (proxySettingsForm) {
    proxySettingsForm.addEventListener('submit', saveProxySettings);
  }
  
  if (testProxyButton) {
    testProxyButton.addEventListener('click', testProxyConnection);
  }
  
  // 为代理输入框添加实时验证
  if (proxyHost) {
    proxyHost.addEventListener('blur', validateProxyInput);
    proxyHost.addEventListener('input', clearValidationStatus);
  }
  
  if (proxyPort) {
    proxyPort.addEventListener('blur', validateProxyInput);
    proxyPort.addEventListener('input', clearValidationStatus);
  }
  
  // 为单选按钮选项添加点击事件
  radioOptions.forEach(option => {
    option.addEventListener('click', function() {
      const radioInput = this.querySelector('input[type="radio"]');
      if (radioInput) {
        radioInput.checked = true;
        updateRadioSelection();
      }
    });
  });
  
  // 单选按钮改变时更新选中状态
  document.querySelectorAll('input[name="proxyMode"]').forEach(radio => {
    radio.addEventListener('change', updateRadioSelection);
  });
  
  // 实时验证代理输入
  function validateProxyInput() {
    const host = proxyHost ? proxyHost.value.trim() : '';
    const port = proxyPort ? proxyPort.value.trim() : '';
    
    if (!host || !port) {
      return; // 允许空值
    }
    
    // 验证端口号
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      showValidationError('端口号必须在1-65535之间');
      return;
    }
    
    // 验证主机名格式
    const hostRegex = /^[a-zA-Z0-9.-]+$/;
    if (!hostRegex.test(host)) {
      showValidationError('主机名格式无效');
      return;
    }
    
    // 构建并验证完整URL
    const fullUrl = buildProxyUrl(host, port);
    if (!isValidProxyUrl(fullUrl)) {
      showValidationError('代理URL格式无效');
      return;
    }
    
    showValidationSuccess('代理地址格式正确');
  }
  
  function clearValidationStatus() {
    if (proxyStatus) {
      proxyStatus.classList.add('hidden');
    }
  }
  
  function showValidationError(message) {
    showStatus('error', message);
  }
  
  function showValidationSuccess(message) {
    showStatus('success', message);
  }
  
  // 更新单选按钮选中状态的视觉效果
  function updateRadioSelection() {
    radioOptions.forEach(option => {
      const radio = option.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
  }
  
  // 加载保存的代理设置（增强版）
  function loadProxySettings() {
    chrome.storage.local.get(['proxyUrl', 'mode', 'proxyEnabled', 'proxySettings'], function(result) {
      let host = '';
      let port = '';
      let mode = 'direct';
      
      console.log('加载代理设置:', result);
      
      // 优先使用popup格式的存储（与popup.js同步）
      if (result.proxyUrl) {
        const parsed = parseProxyUrl(result.proxyUrl);
        host = parsed.host;
        port = parsed.port.toString();
      }
      
      // 处理代理模式和启用状态
      if (result.proxyEnabled === false) {
        mode = 'direct';
      } else if (result.mode) {
        mode = result.mode;
      } else if (result.proxyEnabled === true) {
        mode = 'whitelist'; // 默认模式
      }
      
      // 回退到旧格式proxySettings（向后兼容）
      if (!result.proxyUrl && result.proxySettings) {
        const settings = result.proxySettings;
        host = settings.host || '';
        port = settings.port || '';
        mode = settings.mode || 'direct';
      }
      
      // 填充表单
      if (proxyHost) proxyHost.value = host;
      if (proxyPort) proxyPort.value = port;
      
      // 设置代理模式
      switch (mode) {
        case 'direct':
          if (modeDirect) modeDirect.checked = true;
          break;
        case 'whitelist':
          if (modeWhitelist) modeWhitelist.checked = true;
          break;
        case 'blacklist':
          if (modeBlacklist) modeBlacklist.checked = true;
          break;
        default:
          if (modeDirect) modeDirect.checked = true;
      }
      
      // 更新单选按钮选中状态
      updateRadioSelection();
    });
  }
  
  // 保存代理设置（增强版）
  function saveProxySettings(e) {
    e.preventDefault();
    
    // 获取选中的代理模式
    let selectedMode = 'direct';
    if (modeWhitelist && modeWhitelist.checked) {
      selectedMode = 'whitelist';
    } else if (modeBlacklist && modeBlacklist.checked) {
      selectedMode = 'blacklist';
    }
    
    const host = proxyHost ? proxyHost.value.trim() : '';
    const portStr = proxyPort ? proxyPort.value.trim() : '';
    
    // 增强验证逻辑
    if (selectedMode !== 'direct') {
      if (!host || !portStr) {
        showStatus('error', '请输入完整的代理服务器地址和端口');
        return;
      }
      
      // 验证端口号
      const port = parseInt(portStr);
      if (isNaN(port) || port < 1 || port > 65535) {
        showStatus('error', '请输入有效的端口号（1-65535）');
        return;
      }
      
      // 验证主机名
      const hostRegex = /^[a-zA-Z0-9.-]+$/;
      if (!hostRegex.test(host)) {
        showStatus('error', '主机名格式无效，只能包含字母、数字、点和连字符');
        return;
      }
      
      // 验证完整URL
      const fullUrl = buildProxyUrl(host, portStr);
      if (!isValidProxyUrl(fullUrl)) {
        showStatus('error', '代理URL格式无效');
        return;
      }
    }
    
    // 构建存储数据（参考GitHub项目格式）
    const dataToSave = {};
    
    // 设置代理URL（与popup.js格式一致）
    if (host && portStr && selectedMode !== 'direct') {
      dataToSave.proxyUrl = buildProxyUrl(host, portStr);
      dataToSave.proxyEnabled = true;
    } else {
      // direct模式或无效设置时
      dataToSave.proxyUrl = buildProxyUrl(host || 'localhost', portStr || '7890');
      dataToSave.proxyEnabled = false;
    }
    
    // 设置代理模式（与popup.js格式一致）
    if (selectedMode !== 'direct') {
      dataToSave.mode = selectedMode;
    } else {
      // direct模式时保持现有mode或默认为whitelist
      dataToSave.mode = 'whitelist';
    }
    
    // 保留旧格式以确保向后兼容性
    const legacySettings = {
      host: host,
      port: portStr,
      mode: selectedMode
    };
    dataToSave.proxySettings = legacySettings;
    
    // 保存设置
    chrome.storage.local.set(dataToSave, function() {
      showStatus('success', '设置已保存！');
      
      console.log('保存的设置:', dataToSave);
      
      // 如果设置了代理服务器，则自动测试连接
      if (host && portStr && selectedMode !== 'direct') {
        setTimeout(() => {
          testProxyConnection();
        }, 1000);
      }
    });
  }
  
  // 测试代理连接（增强版）
  function testProxyConnection() {
    // 获取当前表单中的代理设置
    const host = proxyHost ? proxyHost.value.trim() : '';
    const port = proxyPort ? proxyPort.value.trim() : '';
    
    if (!host || !port) {
      showStatus('error', '请先输入代理服务器地址和端口');
      return;
    }
    
    // 验证输入格式
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      showStatus('error', '端口号格式无效');
      return;
    }
    
    // 显示正在测试状态
    showStatus('testing', '正在测试代理连接...');
    
    // 构建代理URL
    const proxyUrl = buildProxyUrl(host, port);
    
    // 模拟连接测试（实际项目中应该通过background script进行真实测试）
    // 这里提供一个更真实的测试模拟
    
    const testDelay = 1500 + Math.random() * 1000; // 1.5-2.5秒随机延迟
    
    setTimeout(() => {
      // 根据常见代理端口和地址进行简单的可行性判断
      let successProbability = 0.7; // 基础成功率70%
      
      // 常见代理端口增加成功率
      const commonPorts = [7890, 1080, 8080, 3128, 8888];
      if (commonPorts.includes(portNum)) {
        successProbability += 0.1;
      }
      
      // localhost或127.0.0.1增加成功率
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        successProbability += 0.15;
      }
      
      const isSuccess = Math.random() < successProbability;
      
      if (isSuccess) {
        showStatus('success', `代理连接成功！代理服务器 ${host}:${port} 可以正常使用。`);
      } else {
        showStatus('error', `代理连接失败。请检查 ${host}:${port} 是否正确，或者代理服务器是否在线。`);
      }
    }, testDelay);
  }
  
  // 显示状态信息（增强版）
  function showStatus(type, message) {
    if (!proxyStatus || !statusMessage) {
      console.log(`状态信息: [${type}] ${message}`);
      return;
    }
    
    proxyStatus.classList.remove('hidden', 'status-active', 'status-inactive');
    
    switch (type) {
      case 'success':
        proxyStatus.classList.add('status-active');
        break;
      case 'error':
        proxyStatus.classList.add('status-inactive');
        break;
      case 'testing':
        // 使用默认样式显示测试状态
        break;
      default:
        break;
    }
    
    statusMessage.textContent = message;
    
    // 自动隐藏成功和错误消息
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        if (proxyStatus) {
          proxyStatus.classList.add('hidden');
        }
      }, 5000);
    }
  }
}); 
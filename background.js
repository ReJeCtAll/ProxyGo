// background.js
// Default proxy settings
let proxyUrl = "http://localhost:7890";
let whitelistRules = [];
let blacklistRules = [];
let currentRules = [];
let mode = "whitelist";
let proxyEnabled = false;

// Global icons storage
let proxyIcon = null;
let defaultIcon = null;
let proxyTitle = "当前网页使用了代理";
let defaultTitle = "当前网页未使用代理";

// Icon update debouncing
let iconUpdateTimeouts = new Map();

// 网络透视板数据存储
let networkStats = {
  domainCounts: {},
  recentRequests: []
};

// 最大存储记录数
const MAX_RECENT_REQUESTS = 50;
const MAX_DOMAIN_RECORDS = 100;

// 防止 worker 休眠
chrome.alarms.clearAll(() => {
  console.log("Cleared all alarms");
});
// Create a heartbeat alarm to keep the background script alive
chrome.alarms.create('heartbeat', { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') {
    console.log('Heartbeat at:', new Date());
    // chrome.storage.local.set({ lastHeartbeat: Date.now() });
  }
});
// Initialize extension
function init() {
  console.log('ProxyGo扩展初始化开始...');
  createIcons();
  // Set default icon
  chrome.action.setIcon({ imageData: defaultIcon })
    .then(() => {
      console.log(`Default icon set for all tabs on initialization`);
    })
    .catch((error) => {
      console.error("Failed to set default icon on initialization:", error);
    });
  
  // 确保networkStats正确初始化
  if (!networkStats || typeof networkStats !== 'object') {
    console.log('初始化networkStats对象');
    networkStats = {
      domainCounts: {},
      recentRequests: []
    };
  }
  
  // Load saved configuration
  loadConfig();
  console.log('ProxyGo扩展初始化完成');
}

// Load saved configuration from storage
function loadConfig() {
  chrome.storage.local.get([
    "proxyEnabled",
    "proxyUrl", 
    "whitelistRules", 
    "blacklistRules", 
    "whitelistUrlRulesParsed",
    "blacklistUrlRulesParsed",
    "mode",
    "networkStats"
  ], (data) => {
    console.log("Loading background config...");
    
    if (data.proxyEnabled !== undefined) {
      proxyEnabled = data.proxyEnabled;
      console.log(`Loaded proxy enabled: ${proxyEnabled}`);
    }
    
    if (data.proxyUrl) {
      proxyUrl = data.proxyUrl;
      console.log(`Loaded proxy: ${proxyUrl}`);
    }
    
    // Load whitelist rules (combine manual and URL rules)
    let manualWhitelistRules = [];
    if (data.whitelistRules) {
      const whitelistArray = ensureArray(data.whitelistRules, 'whitelistRules');
      manualWhitelistRules = whitelistArray.filter(isValidPattern);
      console.log(`Loaded manual whitelist rules: ${manualWhitelistRules.length} rules`);
    }
    
    let urlWhitelistRules = [];
    if (data.whitelistUrlRulesParsed) {
      urlWhitelistRules = data.whitelistUrlRulesParsed.filter(isValidPattern);
      console.log(`Loaded URL whitelist rules: ${urlWhitelistRules.length} rules`);
    }
    
    whitelistRules = [...manualWhitelistRules, ...urlWhitelistRules];
    console.log(`Combined whitelist rules: ${whitelistRules.length} rules`);
    
    // Load blacklist rules (combine manual and URL rules)
    let manualBlacklistRules = [];
    if (data.blacklistRules) {
      const blacklistArray = ensureArray(data.blacklistRules, 'blacklistRules');
      manualBlacklistRules = blacklistArray.filter(isValidPattern);
      console.log(`Loaded manual blacklist rules: ${manualBlacklistRules.length} rules`);
    }
    
    let urlBlacklistRules = [];
    if (data.blacklistUrlRulesParsed) {
      urlBlacklistRules = data.blacklistUrlRulesParsed.filter(isValidPattern);
      console.log(`Loaded URL blacklist rules: ${urlBlacklistRules.length} rules`);
    }
    
    blacklistRules = [...manualBlacklistRules, ...urlBlacklistRules];
    console.log(`Combined blacklist rules: ${blacklistRules.length} rules`);
    
    if (data.mode) {
      mode = data.mode;
      console.log(`Loaded mode: ${mode}`);
    }
    
    // Set current rules based on mode
    currentRules = mode === "whitelist" ? whitelistRules : blacklistRules;
    
    // 加载网络统计数据
    if (data.networkStats) {
      networkStats = data.networkStats;
      console.log(`Loaded network stats: ${Object.keys(networkStats.domainCounts).length} domains, ${networkStats.recentRequests.length} recent requests`);
    }
    
    // Apply proxy settings
    updateProxySettings();
  });
}

// Initialize extension
init();

// Convert to Punycode (handle non-ASCII hostnames)
function toPunycode(host) {
  try {
    return host.match(/^[a-zA-Z0-9.-]+$/) ? host : null; // ASCII only
  } catch (e) {
    console.log(`Punycode conversion failed for host: ${host}`);
    return null;
  }
}

// Create icons (called once)
function createIcons() {
  function createSingleIcon(isProxy) {
    const canvas = new OffscreenCanvas(32, 32);
    const ctx = canvas.getContext("2d");
    
    // 创建渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 32, 32);
    if (isProxy) {
      gradient.addColorStop(0, "#1e3c72");  // 深蓝色（代理开启）
      gradient.addColorStop(1, "#2a5298");
    } else {
      gradient.addColorStop(0, "#6b7280");  // 灰色（代理关闭）
      gradient.addColorStop(1, "#9ca3af");
    }
    
    // 绘制圆形背景
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();
    
    // 设置文字样式
    ctx.fillStyle = "white";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // 绘制"GO"文字
    ctx.fillText("GO", 16, 16);
    
    return ctx.getImageData(0, 0, 32, 32);
  }
  proxyIcon = { "32": createSingleIcon(true) };
  defaultIcon = { "32": createSingleIcon(false) };
  console.log("Icons created");
}

// 收集网络请求数据
// ✅ 步骤 6: 增强 collectNetworkData() 错误处理
function collectNetworkData(url, useProxy) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const timestamp = Date.now();
    
    // 跳过特殊URL和扩展URL
    if (url.startsWith("chrome://") || url.startsWith("edge://") || 
        url.startsWith("chrome-extension://") || url.startsWith("about:") ||
        url.startsWith("file://") || url.startsWith("javascript:")) {
      console.log(`跳过特殊URL: ${url}`);
      return;
    }
    
    console.log(`收集网络数据: ${domain} (代理: ${useProxy})`);
    
    // ✅ 步骤 7: 验证networkStats对象
    if (!networkStats || typeof networkStats !== 'object') {
      console.error('networkStats对象无效，重新初始化');
      networkStats = { domainCounts: {}, recentRequests: [] };
    }
    
    if (!networkStats.domainCounts) {
      console.warn('domainCounts对象不存在，初始化');
      networkStats.domainCounts = {};
    }
    
    if (!Array.isArray(networkStats.recentRequests)) {
      console.warn('recentRequests不是数组，初始化');
      networkStats.recentRequests = [];
    }
    
    // 更新域名计数
    if (!networkStats.domainCounts[domain]) {
      networkStats.domainCounts[domain] = { count: 0, lastAccess: timestamp };
      console.log(`新增域名记录: ${domain}`);
    }
    networkStats.domainCounts[domain].count++;
    networkStats.domainCounts[domain].lastAccess = timestamp;
    
    // 获取IP地址（模拟，实际中可以通过DNS查询获取）
    let ip = "N/A";
    
    // 添加最新请求记录
    const requestRecord = {
      timestamp: timestamp,
      domain: domain,
      ip: ip,
      useProxy: useProxy
    };
    
    networkStats.recentRequests.unshift(requestRecord);
    console.log(`添加请求记录: ${domain}, 总记录数: ${networkStats.recentRequests.length}`);
    
    // 限制记录数量
    if (networkStats.recentRequests.length > MAX_RECENT_REQUESTS) {
      networkStats.recentRequests = networkStats.recentRequests.slice(0, MAX_RECENT_REQUESTS);
      console.log(`请求记录超过限制，保留前${MAX_RECENT_REQUESTS}条`);
    }
    
    // 限制域名记录数量，删除最旧的记录
    const domainKeys = Object.keys(networkStats.domainCounts);
    if (domainKeys.length > MAX_DOMAIN_RECORDS) {
      const sorted = domainKeys.sort((a, b) => 
        networkStats.domainCounts[a].lastAccess - networkStats.domainCounts[b].lastAccess
      );
      const toDelete = sorted.slice(0, domainKeys.length - MAX_DOMAIN_RECORDS);
      toDelete.forEach(key => delete networkStats.domainCounts[key]);
      console.log(`域名记录超过限制，删除${toDelete.length}个最旧记录`);
    }
    
    // ✅ 步骤 8: 验证存储操作成功性
    chrome.storage.local.set({ networkStats: networkStats }, function() {
      if (chrome.runtime.lastError) {
        console.error('保存网络统计数据失败:', chrome.runtime.lastError);
      } else {
        console.log(`网络数据已保存: 域名=${Object.keys(networkStats.domainCounts).length}, 请求=${networkStats.recentRequests.length}`);
      }
    });
    
  } catch (error) {
    console.error(`收集网络数据失败，URL: ${url}, 错误:`, error);
  }
}

// 获取网络统计数据 - 修复Service Worker重启导致数据丢失的问题
function getNetworkStatsData() {
  console.log('📊 获取网络统计数据，当前内存数据状态:', {
    hasDomainCounts: !!(networkStats?.domainCounts),
    hasRecentRequests: !!(networkStats?.recentRequests),
    domainCount: Object.keys(networkStats?.domainCounts || {}).length,
    requestCount: (networkStats?.recentRequests || []).length
  });
  
  // 始终从存储中重新加载最新数据，确保数据同步
  console.log('🔄 强制从存储中重新加载数据...');
  return new Promise((resolve) => {
    chrome.storage.local.get(['networkStats'], (data) => {
      if (data.networkStats && data.networkStats.domainCounts) {
        networkStats = data.networkStats;
        console.log('✅ 从存储中成功加载数据:', {
          domainCount: Object.keys(networkStats.domainCounts || {}).length,
          requestCount: (networkStats.recentRequests || []).length
        });
        
        // 获取TOP10域名
        const domainEntries = Object.entries(networkStats.domainCounts || {})
          .sort(([,a], [,b]) => b.count - a.count)
          .slice(0, 10)
          .map(([domain, data]) => ({
            domain: domain,
            count: data.count,
            lastAccess: data.lastAccess
          }));
        
        console.log('📈 处理后的域名数据:', domainEntries);
        console.log('📝 处理后的请求数据:', networkStats.recentRequests?.slice(0, 20));
          
        resolve({
          topDomains: domainEntries,
          recentRequests: (networkStats.recentRequests || []).slice(0, 20)
        });
      } else {
        console.log('❌ 存储中无有效数据，返回空结果');
        networkStats = { domainCounts: {}, recentRequests: [] };
        resolve({
          topDomains: [],
          recentRequests: []
        });
      }
    });
  });
}

// 清除网络统计数据
function clearNetworkStats() {
  networkStats = {
    domainCounts: {},
    recentRequests: []
  };
  chrome.storage.local.set({ networkStats: networkStats });
}

// Generate PAC script
function generatePacScript(proxyUrl, rules, mode) {
  let proxyHost = "localhost";
  let proxyPort = 7890;
  let proxyScheme = "http";
  
  try {
    const url = new URL(proxyUrl);
    proxyScheme = url.protocol.replace(":", "").toLowerCase();
    if (!["http", "https"].includes(proxyScheme)) throw new Error("Unsupported scheme");
    
    proxyHost = toPunycode(url.hostname);
    if (!proxyHost) throw new Error("Non-ASCII hostname not supported");
    
    proxyPort = parseInt(url.port, 10);
    if (!proxyPort || proxyPort < 1 || proxyPort > 65535) throw new Error("Invalid port");
    
    console.log(`PAC: Proxy ${proxyScheme}://${proxyHost}:${proxyPort}`);
  } catch (e) {
    console.log(`Invalid proxy URL: ${proxyUrl}, error: ${e.message}, using default http://localhost:7890`);
    proxyHost = "localhost";
    proxyPort = 7890;
    proxyScheme = "http";
  }

  const pacRules = rules.map(pattern => {
    if (!pattern.match(/^[a-zA-Z0-9*.?-]+$/)) {
      console.log(`Skipping non-ASCII rule: ${pattern}`);
      return null;
    }
    
    // New logic for ".domain.com" pattern (match domain and subdomains)
    if (pattern.startsWith(".")) {
      const base = pattern.slice(1);
      return `(host === "${base}" || host.endsWith("${pattern}"))`;
    }
    
    // Updated logic for "*.domain.com" pattern (match only subdomains)
    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      return `host.endsWith(".${base}")`;
    }
    
    const regexStr = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".");
    return `host.match(/^${regexStr}$/)`;
  }).filter(rule => rule !== null);

  const pacScript = `
    var cache = {};
    function FindProxyForURL(url, host) {
      if (host in cache) {
        return cache[host];
      }
      
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        return "DIRECT";
      }
      
      var matched = ${pacRules.length > 0 ? pacRules.join(" || ") : "false"};
      var isProxy = ${mode === "whitelist" ? "!matched" : "matched"};
      var result = isProxy ? "PROXY ${proxyHost}:${proxyPort}" : "DIRECT";
      
      cache[host] = result;
      return result;
    }
  `;
  
  console.log(`PAC generated: ${rules.length} rules, mode=${mode}, proxy=${proxyScheme}://${proxyHost}:${proxyPort}`);
  return pacScript;
}

// Set proxy using PAC script
function setPacScript(proxyUrl, rules, mode) {
  const pacScript = generatePacScript(proxyUrl, rules, mode);
  
  chrome.proxy.settings.set(
    {
      value: {
        mode: "pac_script",
        pacScript: {
          data: pacScript
        }
      },
      scope: "regular"
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(`PAC setting error: ${chrome.runtime.lastError.message}`);
      } else {
        console.log("PAC set successfully");
      }
    }
  );
}

// Clear proxy settings (use system settings)
function clearProxySettings() {
  chrome.proxy.settings.set(
    {
      value: { mode: "system" },
      scope: "regular"
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(`Proxy clear error: ${chrome.runtime.lastError.message}`);
      } else {
        console.log("Proxy cleared successfully");
      }
    }
  );
}

// Update proxy settings based on current state
function updateProxySettings() {
  if (proxyEnabled) {
    setPacScript(proxyUrl, currentRules, mode);
  } else {
    clearProxySettings();
  }
}

// 确保数据是数组类型的工具函数
function ensureArray(data, name = 'data') {
  if (Array.isArray(data)) {
    return data;
  }
  
  if (typeof data === 'string') {
    // 如果是字符串，尝试按行分割
    console.log(`Converting ${name} from string to array`);
    return data.split('\n').filter(line => line.trim() !== '');
  }
  
  if (data === null || data === undefined) {
    console.log(`${name} is null/undefined, using empty array`);
    return [];
  }
  
  // 其他类型转换为空数组并记录警告
  console.warn(`Unexpected ${name} type: ${typeof data}, using empty array`);
  return [];
}

// Validate rule pattern
function isValidPattern(pattern) {
  // Allow patterns starting with a dot (.)
  const isValid = pattern && /^[a-zA-Z0-9*.?-]+$/.test(pattern) && pattern.length <= 255;
  if (!isValid) console.log(`Invalid rule pattern: ${pattern}`);
  return isValid;
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    console.log("Storage changed:", Object.keys(changes));
    let needsUpdate = false;
    
    if (changes.proxyEnabled !== undefined) {
      proxyEnabled = changes.proxyEnabled.newValue;
      console.log(`Proxy enabled updated: ${proxyEnabled}`);
      needsUpdate = true;
    }
    
    let whitelistChanged = false;
    let blacklistChanged = false;
    
    // Check for manual whitelist rules changes
    if (changes.whitelistRules) {
      whitelistChanged = true;
    }
    
    // Check for URL whitelist rules changes
    if (changes.whitelistUrlRulesParsed || changes.whitelistUrlRules) {
      whitelistChanged = true;
    }
    
    // Check for manual blacklist rules changes
    if (changes.blacklistRules) {
      blacklistChanged = true;
    }
    
    // Check for URL blacklist rules changes
    if (changes.blacklistUrlRulesParsed || changes.blacklistUrlRules) {
      blacklistChanged = true;
    }
    
    // If relevant rules changed, load them again
    if (whitelistChanged || blacklistChanged) {
      chrome.storage.local.get([
        "whitelistRules", 
        "blacklistRules",
        "whitelistUrlRulesParsed",
        "blacklistUrlRulesParsed"
      ], (data) => {
        // Update whitelist rules if changed
        if (whitelistChanged) {
          let manualRules = [];
          if (data.whitelistRules) {
            const whitelistArray = ensureArray(data.whitelistRules, 'whitelistRules');
            manualRules = whitelistArray.filter(isValidPattern);
          }
          
          let urlRules = [];
          if (data.whitelistUrlRulesParsed) {
            urlRules = data.whitelistUrlRulesParsed.filter(isValidPattern);
          }
          
          whitelistRules = [...manualRules, ...urlRules];
          console.log(`Updated whitelist rules: ${whitelistRules.length} total rules`);
        }
        
        // Update blacklist rules if changed
        if (blacklistChanged) {
          let manualRules = [];
          if (data.blacklistRules) {
            const blacklistArray = ensureArray(data.blacklistRules, 'blacklistRules');
            manualRules = blacklistArray.filter(isValidPattern);
          }
          
          let urlRules = [];
          if (data.blacklistUrlRulesParsed) {
            urlRules = data.blacklistUrlRulesParsed.filter(isValidPattern);
          }
          
          blacklistRules = [...manualRules, ...urlRules];
          console.log(`Updated blacklist rules: ${blacklistRules.length} total rules`);
        }
        
        // Update current rules based on mode
        currentRules = mode === "whitelist" ? whitelistRules : blacklistRules;
        
        // Update proxy settings if enabled
        if (proxyEnabled) {
          updateProxySettings();
        }
      });
    }
    
    if (changes.mode) {
      mode = changes.mode.newValue || "whitelist";
      currentRules = mode === "whitelist" ? whitelistRules : blacklistRules;
      console.log(`Mode updated: ${mode}`);
      needsUpdate = true;
    }
    
    if (changes.proxyUrl) {
      proxyUrl = changes.proxyUrl.newValue || "http://localhost:7890";
      console.log(`Proxy updated: ${proxyUrl}`);
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      updateProxySettings();
    }
  }
});

// Message listener for popup and settings page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Received message:", request);
  
  // 处理网络透视板相关消息
  if (request.action === "getNetworkStats") {
    const stats = getNetworkStatsData();
    
    // 检查是否返回Promise
    if (stats && typeof stats.then === 'function') {
      stats.then(data => {
        console.log('异步获取网络统计数据成功:', data);
        sendResponse(data);
      }).catch(error => {
        console.error('异步获取网络统计数据失败:', error);
        sendResponse({ topDomains: [], recentRequests: [] });
      });
      return true; // 保持消息通道开放
    } else {
      console.log('同步获取网络统计数据:', stats);
      sendResponse(stats);
      return true;
    }
  }
  
  if (request.action === "clearNetworkStats") {
    clearNetworkStats();
    sendResponse({ success: true });
    return true;
  }

  // 处理测试数据收集请求
  if (request.action === "testDataCollection") {
    console.log('收到测试数据收集请求:', request);
    try {
      collectNetworkData(request.url, request.useProxy);
      sendResponse({ success: true });
    } catch (error) {
      console.error('测试数据收集失败:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (request.action === "updateProxy") {
    if (request.proxyEnabled !== undefined) {
      proxyEnabled = request.proxyEnabled;
    }
    
    if (request.proxyUrl) {
      proxyUrl = request.proxyUrl;
    }
    
    if (request.rules) {
      currentRules = request.rules.filter(isValidPattern);
    }
    
    if (request.mode) {
      mode = request.mode;
    }
    
    updateProxySettings();
    sendResponse({ success: true });
  } else if (request.action === "testRule") {
    // 处理规则测试请求
    const url = request.url;
    let host;
    
    try {
      host = new URL(url).hostname;
    } catch (e) {
      sendResponse({ error: `无效的URL: ${e.message}` });
      return true;
    }
    
    const result = evaluateProxyForUrl(url, host);
    const isProxy = result.startsWith("PROXY");
    
    // 查找匹配的规则
    let matchedRule = null;
    const rules = request.mode === "whitelist" ? whitelistRules : blacklistRules;
    
    rules.some(pattern => {
      if (!pattern.match(/^[a-zA-Z0-9*.?-]+$/)) return false;
      
      // 处理 ".domain.com" 模式
      if (pattern.startsWith(".")) {
        const base = pattern.slice(1);
        if (host === base || host.endsWith(pattern)) {
          matchedRule = pattern;
          return true;
        }
        return false;
      }
      
      // 处理 "*.domain.com" 模式
      if (pattern.startsWith("*.")) {
        const base = pattern.slice(2);
        if (host.endsWith(`.${base}`)) {
          matchedRule = pattern;
          return true;
        }
        return false;
      }
      
      const regexStr = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".");
      if (new RegExp(`^${regexStr}$`).test(host)) {
        matchedRule = pattern;
        return true;
      }
      
      return false;
    });
    
    sendResponse({
      url: url,
      host: host,
      useProxy: isProxy,
      matchedRule: matchedRule,
      proxyUrl: proxyUrl,
      proxyEnabled: proxyEnabled
    });
  } else if (request.action === "testConnection") {
    // 处理网络测试请求
    const url = request.url;
    const useProxy = request.useProxy;
    const showHeaders = request.showHeaders;
    const showTiming = request.showTiming;
    
    const controller = new AbortController();
    const signal = controller.signal;
    
    // 设置超时
    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000); // 15秒超时
    
    // 检测用户是否请求了代理，并根据当前的代理设置决定是否使用代理
    let fetchOptions = {};
    if (useProxy && proxyEnabled) {
      // 使用代理设置，无需特殊配置，因为浏览器扩展已经设置了代理
      fetchOptions = { mode: 'cors', signal };
    } else {
      // 不使用代理
      fetchOptions = { mode: 'cors', signal };
    }
    
    // 测量时间
    const timing = {
      start: Date.now(),
      dns: 0,
      connect: 0,
      ttfb: 0,
      download: 0,
      total: 0
    };
    
    // 执行请求
    fetch(url, fetchOptions)
      .then(response => {
        // 记录首字节时间
        timing.ttfb = Date.now() - timing.start;
        
        // 收集响应头
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        
        // 读取响应体
        return response.text().then(text => {
          // 记录下载完成时间
          timing.download = Date.now() - timing.start - timing.ttfb;
          timing.total = Date.now() - timing.start;
          
          // 构造响应对象
          const result = {
            success: response.ok,
            statusCode: response.status,
            statusText: response.statusText,
            url: response.url,
            redirected: response.redirected,
            useProxy: useProxy && proxyEnabled
          };
          
          // 添加可选信息
          if (showHeaders) {
            result.headers = headers;
            result.showHeaders = true;
          }
          
          if (showTiming) {
            result.timing = timing;
            result.showTiming = true;
          }
          
          // 清除超时
          clearTimeout(timeout);
          
          // 发送响应
          sendResponse(result);
        });
      })
      .catch(error => {
        // 清除超时
        clearTimeout(timeout);
        
        // 发送错误响应
        sendResponse({
          success: false,
          error: error.name === 'AbortError' ? '请求超时' : error.message,
          useProxy: useProxy && proxyEnabled
        });
      });
    
    // 保持消息通道开放
    return true;
  }
  
  return true; // 保持消息通道开放以进行异步响应
});


// Evaluate proxy for URL
function evaluateProxyForUrl(url, host) {
  if (!proxyEnabled) {
    return "DIRECT"; // System proxy (effectively direct)
  }
  
  let proxyHost = "localhost";
  let proxyPort = 7890;
  
  try {
    const urlObj = new URL(proxyUrl);
    proxyHost = toPunycode(urlObj.hostname);
    proxyPort = parseInt(urlObj.port, 10) || 7890;
  } catch (e) {
    console.log(`Error parsing proxy URL for icon logic: ${e.message}`);
  }
  
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "DIRECT";
  }
  
  const matched = currentRules.some(pattern => {
    if (!pattern.match(/^[a-zA-Z0-9*.?-]+$/)) return false;
    
    // New logic for ".domain.com" pattern
    if (pattern.startsWith(".")) {
      const base = pattern.slice(1);
      return host === base || host.endsWith(pattern);
    }
    
    // Updated logic for "*.domain.com" pattern
    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      return host.endsWith(`.${base}`);
    }
    
    const regexStr = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${regexStr}$`).test(host);
  });

  const isProxy = mode === "whitelist" ? !matched : matched;
  return isProxy ? `PROXY ${proxyHost}:${proxyPort}` : "DIRECT";
}

// Update icon for tab with debouncing
function updateIconForTab(tabId, url) {
  // Clear existing timeout for this tab
  if (iconUpdateTimeouts.has(tabId)) {
    clearTimeout(iconUpdateTimeouts.get(tabId));
  }
  
  // Set a new timeout for this tab
  const timeoutId = setTimeout(() => {
    doUpdateIconForTab(tabId, url);
    iconUpdateTimeouts.delete(tabId);
  }, 100); // 100ms debounce
  
  iconUpdateTimeouts.set(tabId, timeoutId);
}

// Actual icon update function
function doUpdateIconForTab(tabId, url) {
  let newIcon;
  
  // Handle special URLs (about:blank, chrome://, etc.)
  // const ignorePrefixes = ["about:", "chrome:", "edge:", "file:", "javascript:", "extensions:", "chrome-extension:", "chrome-error:"];

  if (!url || url === "about:blank" || url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("extensions://") || url.startsWith("chrome-extension://") || url.startsWith("chrome-error://")) {
    console.log(`Special URL, using default icon: ${url || "no URL"}`);
    newIcon = defaultIcon;
  } else {
    let host;
    try {
      host = new URL(url).hostname;
    } catch (e) {
      console.log(`Invalid URL, using default icon: ${url}`);
      newIcon = defaultIcon;
      host = null;
    }

    if (host) {
      const result = evaluateProxyForUrl(url, host);
      const isProxy = result.startsWith("PROXY");
      console.log(`URL ${url} uses ${result}`);
      newIcon = isProxy ? proxyIcon : defaultIcon;
      console.log(`host: ${host}, result: ${result}, proxyIcon: ${isProxy}`);
      
      // 收集网络数据
      collectNetworkData(url, isProxy);
    }
  }

  chrome.action.setIcon({ imageData: newIcon, tabId })
    .then(() => {
      chrome.action.setTitle({ title: newIcon === proxyIcon ? proxyTitle : defaultTitle, tabId });
      console.log(`Icon updated to ${newIcon === proxyIcon ? "proxy" : "default"} for tab ${tabId}, url: ${url}`);
    })
    .catch((error) => {
      console.error("setIcon error: ", error);
      // Fallback: try setting icon without tabId
      chrome.action.setIcon({ imageData: newIcon })
        .catch((fallbackError) => {
          console.error("Fallback setIcon also failed: ", fallbackError);
        });
    });
}

// Listen for tab activation
chrome.tabs.onActivated.addListener(activeInfo => {
  console.log(`[事件] 标签页激活: ${activeInfo.tabId}`);
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (chrome.runtime.lastError) {
      console.log(`Failed to get tab ${activeInfo.tabId}: ${chrome.runtime.lastError.message}`);
      return;
    }
    console.log(`[事件] Tab activated, tab ${activeInfo.tabId}, url: ${tab.url}`); 
    updateIconForTab(activeInfo.tabId, tab.url || "");
  });
});

// Listen for navigation
chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId === 0) {
      console.log(`[事件] WebNavigation onBeforeNavigate, tab ${details.tabId}, url: ${details.url}`);  
      updateIconForTab(details.tabId, details.url || "");
    }
  }
);

// Listen for tab updates
chrome.tabs.onUpdated.addListener(
  (tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading") {
      console.log(`[事件] Tab updated, tab ${tabId}, url: ${tab.url}`);
      updateIconForTab(tabId, tab.url || "");
    }
  }
);
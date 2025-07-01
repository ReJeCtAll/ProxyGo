// settings.js
document.addEventListener("DOMContentLoaded", () => {
  const proxyUrlInput = document.getElementById("proxyUrl");
  const whitelistRulesInput = document.getElementById("whitelistRules");
  const blacklistRulesInput = document.getElementById("blacklistRules");
  const whitelistRulesUrlInput = document.getElementById("whitelistRulesUrl");
  const blacklistRulesUrlInput = document.getElementById("blacklistRulesUrl");
  const fetchWhitelistRulesButton = document.getElementById("fetchWhitelistRules");
  const fetchBlacklistRulesButton = document.getElementById("fetchBlacklistRules");
  const previewWhitelistRulesButton = document.getElementById("previewWhitelistRules");
  const previewBlacklistRulesButton = document.getElementById("previewBlacklistRules");
  const saveSettingsButton = document.getElementById("saveSettings");
  const backToPopupButton = document.getElementById("backToPopup");
  const tabs = document.querySelectorAll(".tab");
  const tabContents = document.querySelectorAll(".tab-content");
  const whitelistUrlRulesCount = document.getElementById("whitelistUrlRulesCount");
  const blacklistUrlRulesCount = document.getElementById("blacklistUrlRulesCount");
  
  // Modal elements
  const rulesPreviewModal = document.getElementById("rulesPreviewModal");
  const previewModalTitle = document.getElementById("previewModalTitle");
  const rulesPreviewContent = document.getElementById("rulesPreviewContent");
  const rulesStats = document.getElementById("rulesStats");
  const closeModalButtons = document.querySelectorAll(".close-modal");
  const applyRulesButton = document.getElementById("applyRules");
  
  // Current preview state
  let currentPreviewType = null;
  let currentPreviewRules = "";
  
  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const tabId = tab.getAttribute("data-tab");
      
      // Update active tab
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove("active");
        if (content.id === `${tabId}-tab`) {
          content.classList.add("active");
        }
      });
    });
  });
  
  // Open modal with rules preview
  function openRulesPreview(title, rules, type) {
    previewModalTitle.textContent = title;
    
    // Count valid rules
    const parsedRules = parseRules(rules);
    const validRulesCount = parsedRules.rules.length;
    const totalLines = rules.split("\n").filter(line => line.trim()).length;
    
    rulesStats.textContent = `共 ${totalLines} 行规则，其中 ${validRulesCount} 条有效规则`;
    rulesPreviewContent.textContent = rules;
    
    // Store current preview for "Apply" button
    currentPreviewType = type;
    currentPreviewRules = rules;
    
    // Show modal
    rulesPreviewModal.style.display = "block";
  }
  
  // Close modal
  closeModalButtons.forEach(button => {
    button.addEventListener("click", () => {
      rulesPreviewModal.style.display = "none";
    });
  });
  
  // Close modal if clicked outside the content
  window.addEventListener("click", (event) => {
    if (event.target === rulesPreviewModal) {
      rulesPreviewModal.style.display = "none";
    }
  });
  
  // Apply rules button click
  applyRulesButton.addEventListener("click", () => {
    if (currentPreviewType === "whitelist") {
      // Save to storage
      chrome.storage.local.set({
        whitelistUrlRules: currentPreviewRules,
        whitelistUrlRulesParsed: parseRules(currentPreviewRules).rules
      }, () => {
        updateWhitelistUrlRulesCount();
        rulesPreviewModal.style.display = "none";
        alert("白名单URL规则已应用，请记得保存设置");
      });
    } else if (currentPreviewType === "blacklist") {
      // Save to storage
      chrome.storage.local.set({
        blacklistUrlRules: currentPreviewRules,
        blacklistUrlRulesParsed: parseRules(currentPreviewRules).rules
      }, () => {
        updateBlacklistUrlRulesCount();
        rulesPreviewModal.style.display = "none";
        alert("黑名单URL规则已应用，请记得保存设置");
      });
    }
  });
  
  // Rule validation
  function isValidPattern(pattern) {
    // Allow patterns starting with a dot (.)
    const isValid = pattern && /^[a-zA-Z0-9*.?-]+$/.test(pattern) && pattern.length <= 255;
    if (!isValid) console.log(`Invalid rule pattern: ${pattern}`);
    return isValid;
  }
  
  // Proxy URL validation
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
  
  // Rules URL validation
  function isValidRulesUrl(url) {
    try {
      const parsed = new URL(url);
      return ["http", "https"].includes(parsed.protocol.replace(":", "").toLowerCase());
    } catch {
      return false;
    }
  }
  
  // Parse rules from text input
  function parseRules(rawRules) {
    return {
      rawRules: rawRules,
      rules: rawRules
        .split("\n")
        .map(line => line.trim())
        .filter(line => {
          if (!line) return false;
          if (line.startsWith("#") || line.startsWith(";") || line.startsWith("//") || line.startsWith("[")) {
            return false;
          }
          return isValidPattern(line);
        })
    };
  }
  
  // Update whitelist URL rules count badge
  function updateWhitelistUrlRulesCount() {
    chrome.storage.local.get(["whitelistUrlRulesParsed"], (data) => {
      if (data.whitelistUrlRulesParsed && data.whitelistUrlRulesParsed.length > 0) {
        whitelistUrlRulesCount.textContent = data.whitelistUrlRulesParsed.length;
        whitelistUrlRulesCount.classList.remove("hidden");
      } else {
        whitelistUrlRulesCount.classList.add("hidden");
      }
    });
  }
  
  // Update blacklist URL rules count badge
  function updateBlacklistUrlRulesCount() {
    chrome.storage.local.get(["blacklistUrlRulesParsed"], (data) => {
      if (data.blacklistUrlRulesParsed && data.blacklistUrlRulesParsed.length > 0) {
        blacklistUrlRulesCount.textContent = data.blacklistUrlRulesParsed.length;
        blacklistUrlRulesCount.classList.remove("hidden");
      } else {
        blacklistUrlRulesCount.classList.add("hidden");
      }
    });
  }
  
  // Fetch rules from URL
  async function fetchRules(url, type) {
    if (!url) {
      alert("请输入规则文件的 URL");
      return;
    }
    
    if (!isValidRulesUrl(url)) {
      alert("无效的 URL，仅支持 http:// 或 https:// 协议");
      return;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      
      const text = await response.text();
      if (!text.trim()) {
        alert("规则文件为空");
        return;
      }
      
      // Open the preview modal with the fetched rules
      const title = type === "whitelist" ? "白名单URL规则预览" : "黑名单URL规则预览";
      openRulesPreview(title, text, type);
      
      console.log(`Fetched rules from ${url}`);
    } catch (e) {
      console.error(`Failed to fetch rules from ${url}: ${e.message}`);
      alert(`加载规则失败：${e.message}`);
    }
  }
  
  // Preview existing URL rules
  function previewExistingRules(type) {
    const storageKey = type === "whitelist" ? "whitelistUrlRules" : "blacklistUrlRules";
    const title = type === "whitelist" ? "白名单URL规则预览" : "黑名单URL规则预览";
    
    chrome.storage.local.get([storageKey], (data) => {
      if (data[storageKey] && data[storageKey].trim()) {
        openRulesPreview(title, data[storageKey], type);
      } else {
        alert("暂无URL规则，请先从URL加载规则");
      }
    });
  }
  
  // Load saved configuration
  chrome.storage.local.get([
    "proxyUrl", 
    "whitelistRules", 
    "blacklistRules", 
    "whitelistRawRules", 
    "blacklistRawRules",
    "whitelistRulesUrl",
    "blacklistRulesUrl",
    "whitelistUrlRules",
    "blacklistUrlRules"
  ], (data) => {
    console.log("Loading settings...");
    
    // Set proxy URL
    if (data.proxyUrl) {
      proxyUrlInput.value = data.proxyUrl;
      console.log(`Loaded proxy: ${data.proxyUrl}`);
    } else {
      proxyUrlInput.value = "http://localhost:7890";
    }
    
    // Set whitelist rules (manual only)
    if (data.whitelistRawRules) {
      whitelistRulesInput.value = data.whitelistRawRules;
      console.log(`Loaded whitelist raw rules`);
    } else if (data.whitelistRules) {
      whitelistRulesInput.value = data.whitelistRules.join("\n");
      console.log(`Loaded whitelist rules: ${data.whitelistRules.length} rules`);
    }
    
    // Set blacklist rules (manual only)
    if (data.blacklistRawRules) {
      blacklistRulesInput.value = data.blacklistRawRules;
      console.log(`Loaded blacklist raw rules`);
    } else if (data.blacklistRules) {
      blacklistRulesInput.value = data.blacklistRules.join("\n");
      console.log(`Loaded blacklist rules: ${data.blacklistRules.length} rules`);
    }
    
    // Set rules URLs
    if (data.whitelistRulesUrl) {
      whitelistRulesUrlInput.value = data.whitelistRulesUrl;
    }
    
    if (data.blacklistRulesUrl) {
      blacklistRulesUrlInput.value = data.blacklistRulesUrl;
    }
    
    // Update URL rules counts
    updateWhitelistUrlRulesCount();
    updateBlacklistUrlRulesCount();
  });
  
  // Fetch whitelist rules
  fetchWhitelistRulesButton.addEventListener("click", () => {
    fetchRules(whitelistRulesUrlInput.value.trim(), "whitelist");
  });
  
  // Fetch blacklist rules
  fetchBlacklistRulesButton.addEventListener("click", () => {
    fetchRules(blacklistRulesUrlInput.value.trim(), "blacklist");
  });
  
  // Preview whitelist rules
  previewWhitelistRulesButton.addEventListener("click", () => {
    if (whitelistRulesUrlInput.value.trim()) {
      fetchRules(whitelistRulesUrlInput.value.trim(), "whitelist");
    } else {
      previewExistingRules("whitelist");
    }
  });
  
  // Preview blacklist rules
  previewBlacklistRulesButton.addEventListener("click", () => {
    if (blacklistRulesUrlInput.value.trim()) {
      fetchRules(blacklistRulesUrlInput.value.trim(), "blacklist");
    } else {
      previewExistingRules("blacklist");
    }
  });
  
  // Save settings
  saveSettingsButton.addEventListener("click", () => {
    const proxyUrl = proxyUrlInput.value.trim();
    const whitelistRawRules = whitelistRulesInput.value;
    const blacklistRawRules = blacklistRulesInput.value;
    const whitelistRulesUrl = whitelistRulesUrlInput.value.trim();
    const blacklistRulesUrl = blacklistRulesUrlInput.value.trim();
    
    const whitelistResult = parseRules(whitelistRawRules);
    const blacklistResult = parseRules(blacklistRawRules);
    
    // Validate proxy URL
    if (proxyUrl && !isValidProxyUrl(proxyUrl)) {
      alert("代理地址无效，格式应为：http://host:port 或 https://host:port");
      return;
    }
    
    // Get URL rules
    chrome.storage.local.get([
      "whitelistUrlRulesParsed", 
      "blacklistUrlRulesParsed"
    ], (data) => {
      // Combine manual rules with URL rules
      const combinedWhitelistRules = [
        ...(whitelistResult.rules || []),
        ...(data.whitelistUrlRulesParsed || [])
      ];
      
      const combinedBlacklistRules = [
        ...(blacklistResult.rules || []),
        ...(data.blacklistUrlRulesParsed || [])
      ];
      
      // Prepare data to save
      const dataToSave = {
        proxyUrl: proxyUrl || "http://localhost:7890",
        whitelistRules: combinedWhitelistRules,
        blacklistRules: combinedBlacklistRules,
        whitelistRawRules: whitelistRawRules,
        blacklistRawRules: blacklistRawRules
      };
      
      // Save rules URLs if valid
      if (whitelistRulesUrl && isValidRulesUrl(whitelistRulesUrl)) {
        dataToSave.whitelistRulesUrl = whitelistRulesUrl;
      }
      
      if (blacklistRulesUrl && isValidRulesUrl(blacklistRulesUrl)) {
        dataToSave.blacklistRulesUrl = blacklistRulesUrl;
      }
      
      // Save to storage
      chrome.storage.local.set(dataToSave, () => {
        console.log("Settings saved");
        
        // Update current proxy settings if needed
        chrome.storage.local.get(["proxyEnabled", "mode"], (data) => {
          if (data.proxyEnabled) {
            const currentRules = data.mode === "whitelist" ? combinedWhitelistRules : combinedBlacklistRules;
            
            chrome.runtime.sendMessage({
              action: "updateProxy",
              proxyEnabled: true,
              proxyUrl: dataToSave.proxyUrl,
              rules: currentRules,
              mode: data.mode
            }, (response) => {
              console.log("Proxy update response:", response);
            });
          }
          
          alert("设置已保存！");
        });
      });
    });
  });
  
  // Back to popup
  backToPopupButton.addEventListener("click", () => {
    window.close();
  });

  // 规则测试功能
  const testUrlInput = document.getElementById("testUrl");
  const testUrlButton = document.getElementById("testUrlButton");
  const testResult = document.getElementById("testResult");
  const resultUrl = document.getElementById("resultUrl");
  const resultHost = document.getElementById("resultHost");
  const resultProxyStatus = document.getElementById("resultProxyStatus");
  const resultMatchedRule = document.getElementById("resultMatchedRule");

  // 测试URL是否匹配规则
  testUrlButton.addEventListener("click", () => {
    const url = testUrlInput.value.trim();
    if (!url) {
      alert("请输入有效的URL");
      return;
    }

    try {
      // 验证URL格式
      new URL(url);
      
      // 获取当前规则和模式
      chrome.storage.local.get(["mode"], (data) => {
        const mode = data.mode || "whitelist";
        
        // 使用background.js中的函数进行测试
        chrome.runtime.sendMessage({
          action: "testRule",
          url: url,
          mode: mode
        }, (response) => {
          if (response.error) {
            alert(response.error);
            return;
          }
          
          // 显示结果
          resultUrl.textContent = response.url;
          resultHost.textContent = response.host;
          resultProxyStatus.textContent = response.useProxy ? "使用代理" : "直接连接";
          resultProxyStatus.className = response.useProxy ? "result-value proxy-yes" : "result-value proxy-no";
          
          if (response.matchedRule) {
            resultMatchedRule.textContent = response.matchedRule;
          } else {
            resultMatchedRule.textContent = "没有匹配的规则";
          }
          
          // 显示结果区域
          testResult.classList.remove("hidden");
        });
      });
    } catch (e) {
      alert(`无效的URL: ${e.message}`);
    }
  });

  // 规则冲突检测功能
  const detectConflictsButton = document.getElementById("detectConflictsButton");
  const conflictResults = document.getElementById("conflictResults");
  const conflictList = document.getElementById("conflictList");

  // 检测规则冲突
  detectConflictsButton.addEventListener("click", () => {
    chrome.storage.local.get([
      "mode", 
      "whitelistRules", 
      "blacklistRules",
      "whitelistUrlRulesParsed",
      "blacklistUrlRulesParsed"
    ], (data) => {
      const mode = data.mode || "whitelist";
      
      // 合并手动规则和URL规则
      let whitelistRules = [];
      if (data.whitelistRules) {
        whitelistRules = [...whitelistRules, ...data.whitelistRules];
      }
      if (data.whitelistUrlRulesParsed) {
        whitelistRules = [...whitelistRules, ...data.whitelistUrlRulesParsed];
      }
      
      let blacklistRules = [];
      if (data.blacklistRules) {
        blacklistRules = [...blacklistRules, ...data.blacklistRules];
      }
      if (data.blacklistUrlRulesParsed) {
        blacklistRules = [...blacklistRules, ...data.blacklistUrlRulesParsed];
      }
      
      // 根据当前模式选择规则集
      const rules = mode === "whitelist" ? whitelistRules : blacklistRules;
      
      // 清空之前的结果
      conflictList.innerHTML = "";
      
      // 检测冲突
      const conflicts = detectConflicts(rules);
      
      if (conflicts.length === 0) {
        conflictList.innerHTML = `<div class="conflict-item">
          <div class="conflict-title">没有检测到规则冲突</div>
          <p>当前规则集中没有发现明显的冲突或重叠。</p>
        </div>`;
      } else {
        conflicts.forEach(conflict => {
          const conflictItem = document.createElement("div");
          conflictItem.className = "conflict-item";
          conflictItem.innerHTML = `
            <div class="conflict-title">${conflict.type}</div>
            <p>${conflict.description}</p>
            <div class="conflict-rules">${conflict.rules.join("<br>")}</div>
          `;
          conflictList.appendChild(conflictItem);
        });
      }
      
      // 显示结果区域
      conflictResults.classList.remove("hidden");
    });
  });

  // 检测规则冲突的函数
  function detectConflicts(rules) {
    const conflicts = [];
    
    // 检查重复规则
    const uniqueRules = new Set();
    const duplicates = [];
    
    rules.forEach(rule => {
      if (uniqueRules.has(rule)) {
        duplicates.push(rule);
      } else {
        uniqueRules.add(rule);
      }
    });
    
    if (duplicates.length > 0) {
      conflicts.push({
        type: "重复规则",
        description: "以下规则在规则集中出现多次，这可能会导致不必要的性能开销。",
        rules: duplicates
      });
    }
    
    // 检查通配符规则可能覆盖的特定规则
    const wildcardRules = rules.filter(rule => rule.includes("*") || rule.startsWith("."));
    const specificRules = rules.filter(rule => !rule.includes("*") && !rule.startsWith("."));
    
    const potentialOverlaps = [];
    
    wildcardRules.forEach(wildcardRule => {
      let pattern;
      
      if (wildcardRule.startsWith(".")) {
        // 处理 ".example.com" 形式的规则
        const domain = wildcardRule.slice(1);
        pattern = new RegExp(`(^${domain.replace(/\./g, "\\.")}$)|(.*\\.${domain.replace(/\./g, "\\.")})$`);
      } else if (wildcardRule.startsWith("*.")) {
        // 处理 "*.example.com" 形式的规则
        const domain = wildcardRule.slice(2);
        pattern = new RegExp(`.*\\.${domain.replace(/\./g, "\\.")}$`);
      } else {
        // 处理其他通配符规则
        const regexStr = wildcardRule.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".");
        pattern = new RegExp(`^${regexStr}$`);
      }
      
      specificRules.forEach(specificRule => {
        try {
          // 检查特定规则是否被通配符规则覆盖
          if (pattern.test(specificRule)) {
            potentialOverlaps.push({ wildcardRule, specificRule });
          }
        } catch (e) {
          console.error(`规则检测错误: ${e.message}`);
        }
      });
    });
    
    if (potentialOverlaps.length > 0) {
      const overlapRules = potentialOverlaps.map(overlap => 
        `通配符规则 "${overlap.wildcardRule}" 可能覆盖特定规则 "${overlap.specificRule}"`
      );
      
      conflicts.push({
        type: "规则重叠",
        description: "以下通配符规则可能覆盖了更具体的规则，这可能导致预期之外的行为。",
        rules: overlapRules
      });
    }
    
    // 检查可能导致意外结果的规则
    const potentialIssues = [];
    
    rules.forEach(rule => {
      // 检查非常短的规则（可能过于宽泛）
      if (rule.length < 4 && !rule.startsWith(".")) {
        potentialIssues.push(`"${rule}" - 规则过短，可能会匹配过多域名`);
      }
      
      // 检查以通配符开头和结尾的规则（可能过于宽泛）
      if (rule.startsWith("*") && rule.endsWith("*") && rule.length < 10) {
        potentialIssues.push(`"${rule}" - 规则以通配符开头和结尾，可能会匹配过多域名`);
      }
    });
    
    if (potentialIssues.length > 0) {
      conflicts.push({
        type: "潜在问题规则",
        description: "以下规则可能过于宽泛或可能导致意外的匹配结果。",
        rules: potentialIssues
      });
    }
    
    return conflicts;
  }

  // 网络诊断工具
  const diagnosticUrlInput = document.getElementById("diagnosticUrl");
  const runDiagnosticButton = document.getElementById("runDiagnosticButton");
  const diagnosticResults = document.getElementById("diagnosticResults");
  const diagUrl = document.getElementById("diagUrl");
  const diagStatus = document.getElementById("diagStatus");
  const diagTime = document.getElementById("diagTime");
  const diagProxyStatus = document.getElementById("diagProxyStatus");

  // 运行网络诊断
  runDiagnosticButton.addEventListener("click", async () => {
    const url = diagnosticUrlInput.value.trim();
    if (!url) {
      alert("请输入有效的URL");
      return;
    }

    try {
      // 验证URL格式
      new URL(url);
      
      // 显示诊断结果区域并重置内容
      diagnosticResults.classList.remove("hidden");
      diagUrl.textContent = url;
      diagStatus.innerHTML = '<span class="diagnostic-spinner"></span>正在检查...';
      diagTime.textContent = "计算中...";
      diagProxyStatus.textContent = "检查中...";
      
      // 获取代理状态
      chrome.runtime.sendMessage({
        action: "testRule",
        url: url
      }, async (response) => {
        if (response.error) {
          alert(response.error);
          return;
        }
        
        // 设置代理状态
        diagProxyStatus.textContent = response.useProxy ? "使用代理" : "直接连接";
        diagProxyStatus.className = response.useProxy ? "result-value proxy-yes" : "result-value proxy-no";
        
        // 执行连接测试
        const startTime = Date.now();
        try {
          // 使用fetch API测试连接
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
          
          const fetchResponse = await fetch(url, { 
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-store',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          diagStatus.innerHTML = '<span class="status-success">✓ 连接成功</span>';
          diagTime.textContent = `${responseTime} ms`;
        } catch (error) {
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          if (error.name === 'AbortError') {
            diagStatus.innerHTML = '<span class="status-error">✗ 连接超时</span>';
          } else {
            diagStatus.innerHTML = `<span class="status-error">✗ 连接失败: ${error.message}</span>`;
          }
          diagTime.textContent = `${responseTime} ms`;
        }
      });
    } catch (e) {
      alert(`无效的URL: ${e.message}`);
    }
  });

  // 清空白名单规则按钮
  const clearWhitelistRulesButton = document.getElementById("clearWhitelistRules");
  clearWhitelistRulesButton.addEventListener("click", () => {
    if (confirm("确定要清空所有白名单规则吗？")) {
      whitelistRulesInput.value = "";
    }
  });
  
  // 清空黑名单规则按钮
  const clearBlacklistRulesButton = document.getElementById("clearBlacklistRules");
  clearBlacklistRulesButton.addEventListener("click", () => {
    if (confirm("确定要清空所有黑名单规则吗？")) {
      blacklistRulesInput.value = "";
    }
  });
  
  // 删除选中的白名单规则
  const deleteSelectedWhitelistRulesButton = document.getElementById("deleteSelectedWhitelistRules");
  deleteSelectedWhitelistRulesButton.addEventListener("click", () => {
    deleteSelectedRules(whitelistRulesInput);
  });
  
  // 删除选中的黑名单规则
  const deleteSelectedBlacklistRulesButton = document.getElementById("deleteSelectedBlacklistRules");
  deleteSelectedBlacklistRulesButton.addEventListener("click", () => {
    deleteSelectedRules(blacklistRulesInput);
  });
  
  // 删除选中的规则
  function deleteSelectedRules(textareaElement) {
    const textarea = textareaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // 如果没有选中文本，提示用户
    if (start === end) {
      alert("请先选择要删除的规则");
      return;
    }
    
    // 获取选中的文本
    const selectedText = textarea.value.substring(start, end);
    
    // 检查选中的文本是否包含完整的行
    const lines = selectedText.split("\n");
    
    // 如果只选中了部分文本而不是完整的行，提示用户
    if (lines.length === 1 && 
        (start > 0 && textarea.value.charAt(start - 1) !== "\n") || 
        (end < textarea.value.length && textarea.value.charAt(end) !== "\n")) {
      
      if (confirm("您只选择了部分文本，而不是完整的规则行。确定要删除选中的文本吗？")) {
        // 删除选中的文本
        textarea.value = textarea.value.substring(0, start) + textarea.value.substring(end);
      }
    } else {
      // 删除选中的规则
      textarea.value = textarea.value.substring(0, start) + textarea.value.substring(end);
    }
  }
});
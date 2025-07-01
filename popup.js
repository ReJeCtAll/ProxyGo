document.addEventListener("DOMContentLoaded", () => {
  const proxyEnabledToggle = document.getElementById("proxyEnabled");
  const proxyUrlDisplay = document.getElementById("proxyUrlDisplay");
  const modeOptions = document.querySelectorAll(".mode-option");
  const openSettingsButton = document.getElementById("openSettings");
  const showRulesButton = document.getElementById("showRules");

  // Initialize state
  let proxyEnabled = true;
  let currentMode = "whitelist";
  let proxyUrl = "http://localhost:7890";
  let whitelistRules = [];
  let blacklistRules = [];
  let whitelistRawRules = "";
  let blacklistRawRules = "";
  let whitelistUrlRulesParsed = [];
  let blacklistUrlRulesParsed = [];

  // Load saved configuration
  chrome.storage.local.get([
    "proxyEnabled", 
    "mode", 
    "proxyUrl", 
    "whitelistRules", 
    "blacklistRules", 
    "whitelistRawRules", 
    "blacklistRawRules",
    "whitelistUrlRulesParsed",
    "blacklistUrlRulesParsed"
  ], (data) => {
    console.log("Loading popup config...");
    
    // Set proxy enabled state
    if (data.proxyEnabled !== undefined) {
      proxyEnabled = data.proxyEnabled;
      proxyEnabledToggle.checked = proxyEnabled;
      console.log(`Loaded proxy enabled: ${proxyEnabled}`);
    }
    
    // Set proxy mode (whitelist/blacklist)
    if (data.mode) {
      currentMode = data.mode;
      updateModeUI(currentMode);
      console.log(`Loaded mode: ${currentMode}`);
    }
    
    // Set proxy URL
    if (data.proxyUrl) {
      proxyUrl = data.proxyUrl;
      proxyUrlDisplay.textContent = proxyUrl;
      console.log(`Loaded proxy: ${proxyUrl}`);
    }
    
    // Load manual rules
    if (data.whitelistRules) {
      whitelistRules = data.whitelistRules;
      console.log(`Loaded whitelist rules: ${whitelistRules.length} rules`);
    }
    
    if (data.blacklistRules) {
      blacklistRules = data.blacklistRules;
      console.log(`Loaded blacklist rules: ${blacklistRules.length} rules`);
    }
    
    if (data.whitelistRawRules) {
      whitelistRawRules = data.whitelistRawRules;
    }
    
    if (data.blacklistRawRules) {
      blacklistRawRules = data.blacklistRawRules;
    }
    
    // Load URL rules
    if (data.whitelistUrlRulesParsed) {
      whitelistUrlRulesParsed = data.whitelistUrlRulesParsed;
      console.log(`Loaded whitelist URL rules: ${whitelistUrlRulesParsed.length} rules`);
    }
    
    if (data.blacklistUrlRulesParsed) {
      blacklistUrlRulesParsed = data.blacklistUrlRulesParsed;
      console.log(`Loaded blacklist URL rules: ${blacklistUrlRulesParsed.length} rules`);
    }
    
    // Make Show Rules button visible if we have rules
    if ((currentMode === "whitelist" && (whitelistRules.length > 0 || whitelistUrlRulesParsed.length > 0)) || 
        (currentMode === "blacklist" && (blacklistRules.length > 0 || blacklistUrlRulesParsed.length > 0))) {
      showRulesButton.classList.remove("hidden");
    }
    
    // Update proxy state
    updateProxyState();
  });

  // Toggle proxy enabled/disabled
  proxyEnabledToggle.addEventListener("change", () => {
    proxyEnabled = proxyEnabledToggle.checked;
    console.log(`Proxy enabled changed to: ${proxyEnabled}`);
    
    chrome.storage.local.set({ proxyEnabled }, () => {
      console.log("Proxy enabled state saved");
      updateProxyState();
    });
  });

  // Mode selector
  modeOptions.forEach(option => {
    option.addEventListener("click", () => {
      const newMode = option.getAttribute("data-mode");
      if (newMode !== currentMode) {
        currentMode = newMode;
        updateModeUI(currentMode);
        
        chrome.storage.local.set({ mode: currentMode }, () => {
          console.log(`Mode changed to: ${currentMode}`);
          updateProxyState();
          
          // Update Show Rules button visibility based on new mode
          if ((currentMode === "whitelist" && (whitelistRules.length > 0 || whitelistUrlRulesParsed.length > 0)) || 
              (currentMode === "blacklist" && (blacklistRules.length > 0 || blacklistUrlRulesParsed.length > 0))) {
            showRulesButton.classList.remove("hidden");
          } else {
            showRulesButton.classList.add("hidden");
          }
        });
      }
    });
  });

  // Open detailed settings
  openSettingsButton.addEventListener("click", () => {
    chrome.tabs.create({ url: "settings.html" });
  });

  // Show current rules
  showRulesButton.addEventListener("click", () => {
    // Get combined rules based on current mode
    const manualRules = currentMode === "whitelist" ? whitelistRules : blacklistRules;
    const urlRules = currentMode === "whitelist" ? whitelistUrlRulesParsed : blacklistUrlRulesParsed;
    const combinedRules = [...manualRules, ...urlRules];
    
    // Remove duplicates
    const uniqueRules = [...new Set(combinedRules)];
    
    let message = `当前使用${currentMode === "whitelist" ? "白名单" : "黑名单"}模式，共${uniqueRules.length}条有效规则。`;
    
    if (manualRules.length > 0) {
      message += `\n\n手动编辑规则（${manualRules.length}条）：\n` + manualRules.join("\n");
    }
    
    if (urlRules.length > 0) {
      message += `\n\nURL加载规则（${urlRules.length}条）：\n` + urlRules.join("\n");
    }
    
    if (uniqueRules.length === 0) {
      message += "\n\n暂无有效规则，请在详细设置中添加。";
    }
    
    alert(message);
  });

  // Update mode UI
  function updateModeUI(mode) {
    modeOptions.forEach(option => {
      if (option.getAttribute("data-mode") === mode) {
        option.classList.add("active");
      } else {
        option.classList.remove("active");
      }
    });
  }

  // Update proxy state
  function updateProxyState() {
    if (proxyEnabled) {
      // Get combined rules based on mode
      const manualRules = currentMode === "whitelist" ? whitelistRules : blacklistRules;
      const urlRules = currentMode === "whitelist" ? whitelistUrlRulesParsed : blacklistUrlRulesParsed;
      const combinedRules = [...manualRules, ...urlRules];
      
      // Remove duplicates
      const uniqueRules = [...new Set(combinedRules)];
      
      // Set PAC script
      chrome.runtime.sendMessage({
        action: "updateProxy",
        proxyEnabled: true,
        proxyUrl: proxyUrl,
        rules: uniqueRules,
        mode: currentMode
      }, (response) => {
        console.log("Proxy update response:", response);
      });
    } else {
      // Disable proxy
      chrome.runtime.sendMessage({
        action: "updateProxy",
        proxyEnabled: false
      }, (response) => {
        console.log("Proxy disable response:", response);
      });
    }
  }
});
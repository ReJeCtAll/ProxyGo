// whitelist-rules.js
document.addEventListener("DOMContentLoaded", () => {
  const whitelistRulesInput = document.getElementById("whitelistRules");
  const whitelistRulesUrlInput = document.getElementById("whitelistRulesUrl");
  const fetchWhitelistRulesButton = document.getElementById("fetchWhitelistRules");
  const previewWhitelistRulesButton = document.getElementById("previewWhitelistRules");
  const saveWhitelistButton = document.getElementById("saveWhitelist");
  const backToSettingsButton = document.getElementById("backToSettings");
  const whitelistUrlRulesCount = document.getElementById("whitelistUrlRulesCount");

  // Modal elements
  const rulesPreviewModal = document.getElementById("rulesPreviewModal");
  const previewModalTitle = document.getElementById("previewModalTitle");
  const rulesPreviewContent = document.getElementById("rulesPreviewContent");
  const rulesStats = document.getElementById("rulesStats");
  const closeModalButtons = document.querySelectorAll(".close-modal");
  const applyRulesButton = document.getElementById("applyRules");

  // Current preview state
  let currentPreviewRules = "";

  // Rule validation - 参考 fsp-ext 的验证逻辑
  function isValidPattern(pattern) {
    // Allow patterns starting with a dot (.)
    const isValid = pattern && /^[a-zA-Z0-9*.?-]+$/.test(pattern) && pattern.length <= 255;
    if (!isValid) console.log(`Invalid rule pattern: ${pattern}`);
    return isValid;
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

  // Parse rules from text input - 参考 fsp-ext 的解析逻辑
  function parseRules(rawRules) {
    return {
      rawRules: rawRules,
      rules: rawRules
        .split("\n")
        .map(line => line.trim())
        .filter(line => {
          if (!line) return false;
          // 过滤注释行 - 支持 #, ;, //, [ 开头的注释
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

  // Open modal with rules preview
  function openRulesPreview(title, rules) {
    previewModalTitle.textContent = title;

    // Count valid rules
    const parsedRules = parseRules(rules);
    const validRulesCount = parsedRules.rules.length;
    const totalLines = rules.split("\n").filter(line => line.trim()).length;

    rulesStats.textContent = `共 ${totalLines} 行规则，其中 ${validRulesCount} 条有效规则`;
    rulesPreviewContent.textContent = rules;

    // Store current preview for "Apply" button
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
    // Save to storage
    chrome.storage.local.set({
      whitelistUrlRules: currentPreviewRules,
      whitelistUrlRulesParsed: parseRules(currentPreviewRules).rules
    }, () => {
      updateWhitelistUrlRulesCount();
      rulesPreviewModal.style.display = "none";
      alert("白名单URL规则已应用，请记得保存设置");
    });
  });

  // Fetch rules from URL
  async function fetchRules(url) {
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
      openRulesPreview("白名单URL规则预览", text);

      console.log(`Fetched rules from ${url}`);
    } catch (e) {
      console.error(`Failed to fetch rules from ${url}: ${e.message}`);
      alert(`加载规则失败：${e.message}`);
    }
  }

  // Preview existing URL rules
  function previewExistingRules() {
    chrome.storage.local.get(["whitelistUrlRules"], (data) => {
      if (data.whitelistUrlRules && data.whitelistUrlRules.trim()) {
        openRulesPreview("白名单URL规则预览", data.whitelistUrlRules);
      } else {
        alert("暂无URL规则，请先从URL加载规则");
      }
    });
  }

  // Load saved configuration
  chrome.storage.local.get([
    "whitelistRules",
    "whitelistRawRules",
    "whitelistRulesUrl"
  ], (data) => {
    console.log("Loading whitelist settings...");

    // Set whitelist rules (manual only)
    if (data.whitelistRawRules) {
      whitelistRulesInput.value = data.whitelistRawRules;
      console.log(`Loaded whitelist raw rules`);
    } else if (data.whitelistRules) {
      whitelistRulesInput.value = data.whitelistRules.join("\n");
      console.log(`Loaded whitelist rules: ${data.whitelistRules.length} rules`);
    }

    // Set rules URL
    if (data.whitelistRulesUrl) {
      whitelistRulesUrlInput.value = data.whitelistRulesUrl;
    }

    // Update URL rules count
    updateWhitelistUrlRulesCount();
  });

  // Fetch whitelist rules button
  fetchWhitelistRulesButton.addEventListener("click", () => {
    fetchRules(whitelistRulesUrlInput.value.trim());
  });

  // Preview whitelist rules button
  previewWhitelistRulesButton.addEventListener("click", () => {
    if (whitelistRulesUrlInput.value.trim()) {
      fetchRules(whitelistRulesUrlInput.value.trim());
    } else {
      previewExistingRules();
    }
  });

  // Save whitelist settings
  saveWhitelistButton.addEventListener("click", () => {
    const whitelistRawRules = whitelistRulesInput.value;
    const whitelistRulesUrl = whitelistRulesUrlInput.value.trim();

    const whitelistResult = parseRules(whitelistRawRules);

    // Get URL rules
    chrome.storage.local.get(["whitelistUrlRulesParsed"], (data) => {
      // Combine manual rules with URL rules
      const combinedWhitelistRules = [
        ...(whitelistResult.rules || []),
        ...(data.whitelistUrlRulesParsed || [])
      ];

      // Prepare data to save
      const dataToSave = {
        whitelistRules: combinedWhitelistRules,
        whitelistRawRules: whitelistRawRules
      };

      // Save rules URL if valid
      if (whitelistRulesUrl && isValidRulesUrl(whitelistRulesUrl)) {
        dataToSave.whitelistRulesUrl = whitelistRulesUrl;
      }

      // Save to storage
      chrome.storage.local.set(dataToSave, () => {
        console.log("Whitelist settings saved");

        // Update current proxy settings if needed
        chrome.storage.local.get(["proxyEnabled", "mode", "proxyUrl"], (data) => {
          if (data.proxyEnabled && data.mode === "whitelist") {
            chrome.runtime.sendMessage({
              action: "updateProxy",
              proxyEnabled: true,
              proxyUrl: data.proxyUrl || "http://localhost:7890",
              rules: combinedWhitelistRules,
              mode: "whitelist"
            }, (response) => {
              console.log("Proxy update response:", response);
            });
          }

          alert("白名单设置已保存！");
        });
      });
    });
  });

  // Back to settings
  backToSettingsButton.addEventListener("click", () => {
    window.location.href = "settings.html";
  });
}); 
// blacklist-rules.js
document.addEventListener("DOMContentLoaded", () => {
  const blacklistRulesInput = document.getElementById("blacklistRules");
  const blacklistRulesUrlInput = document.getElementById("blacklistRulesUrl");
  const fetchBlacklistRulesButton = document.getElementById("fetchBlacklistRules");
  const previewBlacklistRulesButton = document.getElementById("previewBlacklistRules");
  const saveBlacklistButton = document.getElementById("saveBlacklist");
  const backToSettingsButton = document.getElementById("backToSettings");
  const blacklistUrlRulesCount = document.getElementById("blacklistUrlRulesCount");

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
      blacklistUrlRules: currentPreviewRules,
      blacklistUrlRulesParsed: parseRules(currentPreviewRules).rules
    }, () => {
      updateBlacklistUrlRulesCount();
      rulesPreviewModal.style.display = "none";
      alert("黑名单URL规则已应用，请记得保存设置");
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
      openRulesPreview("黑名单URL规则预览", text);

      console.log(`Fetched rules from ${url}`);
    } catch (e) {
      console.error(`Failed to fetch rules from ${url}: ${e.message}`);
      alert(`加载规则失败：${e.message}`);
    }
  }

  // Preview existing URL rules
  function previewExistingRules() {
    chrome.storage.local.get(["blacklistUrlRules"], (data) => {
      if (data.blacklistUrlRules && data.blacklistUrlRules.trim()) {
        openRulesPreview("黑名单URL规则预览", data.blacklistUrlRules);
      } else {
        alert("暂无URL规则，请先从URL加载规则");
      }
    });
  }

  // Load saved configuration
  chrome.storage.local.get([
    "blacklistRules",
    "blacklistRawRules",
    "blacklistRulesUrl"
  ], (data) => {
    console.log("Loading blacklist settings...");

    // Set blacklist rules (manual only)
    if (data.blacklistRawRules) {
      blacklistRulesInput.value = data.blacklistRawRules;
      console.log(`Loaded blacklist raw rules`);
    } else if (data.blacklistRules) {
      blacklistRulesInput.value = data.blacklistRules.join("\n");
      console.log(`Loaded blacklist rules: ${data.blacklistRules.length} rules`);
    }

    // Set rules URL
    if (data.blacklistRulesUrl) {
      blacklistRulesUrlInput.value = data.blacklistRulesUrl;
    }

    // Update URL rules count
    updateBlacklistUrlRulesCount();
  });

  // Fetch blacklist rules button
  fetchBlacklistRulesButton.addEventListener("click", () => {
    fetchRules(blacklistRulesUrlInput.value.trim());
  });

  // Preview blacklist rules button
  previewBlacklistRulesButton.addEventListener("click", () => {
    if (blacklistRulesUrlInput.value.trim()) {
      fetchRules(blacklistRulesUrlInput.value.trim());
    } else {
      previewExistingRules();
    }
  });

  // Save blacklist settings
  saveBlacklistButton.addEventListener("click", () => {
    const blacklistRawRules = blacklistRulesInput.value;
    const blacklistRulesUrl = blacklistRulesUrlInput.value.trim();

    const blacklistResult = parseRules(blacklistRawRules);

    // Get URL rules
    chrome.storage.local.get(["blacklistUrlRulesParsed"], (data) => {
      // Combine manual rules with URL rules
      const combinedBlacklistRules = [
        ...(blacklistResult.rules || []),
        ...(data.blacklistUrlRulesParsed || [])
      ];

      // Prepare data to save
      const dataToSave = {
        blacklistRules: combinedBlacklistRules,
        blacklistRawRules: blacklistRawRules
      };

      // Save rules URL if valid
      if (blacklistRulesUrl && isValidRulesUrl(blacklistRulesUrl)) {
        dataToSave.blacklistRulesUrl = blacklistRulesUrl;
      }

      // Save to storage
      chrome.storage.local.set(dataToSave, () => {
        console.log("Blacklist settings saved");

        // Update current proxy settings if needed
        chrome.storage.local.get(["proxyEnabled", "mode", "proxyUrl"], (data) => {
          if (data.proxyEnabled && data.mode === "blacklist") {
            chrome.runtime.sendMessage({
              action: "updateProxy",
              proxyEnabled: true,
              proxyUrl: data.proxyUrl || "http://localhost:7890",
              rules: combinedBlacklistRules,
              mode: "blacklist"
            }, (response) => {
              console.log("Proxy update response:", response);
            });
          }

          alert("黑名单设置已保存！");
        });
      });
    });
  });

  // Back to settings
  backToSettingsButton.addEventListener("click", () => {
    window.location.href = "settings.html";
  });
}); 
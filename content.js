class XPathSelector {
  constructor() {
    this.isActive = false;
    this.highlightedElement = null;
    this.selectedElement = null;
    this.overlay = null;
    this.selectedOverlay = null;
    this.tooltip = null;
    this.hideTimeout = null;
    this.boundHandlers = {
      mouseover: this.handleMouseOver.bind(this),
      click: this.handleClick.bind(this),
      keydown: this.handleKeyDown.bind(this),
    };

    this.setupMessageListener();
  }

  // Helper function to escape XPath attribute values
  escapeXPathValue(value) {
    if (typeof value !== "string") return value;
    // Replace double quotes with &quot; to prevent XPath syntax errors
    return value.replace(/"/g, "&quot;");
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("Content script received message:", message);

      if (message.type === "PING") {
        sendResponse({ success: true, ready: true });
      } else if (message.type === "ACTIVATE_SELECTION") {
        this.activate();
        sendResponse({ success: true });
      } else if (message.type === "DEACTIVATE_SELECTION") {
        this.deactivate();
        sendResponse({ success: true });
      }

      return true; // Keep message channel open
    });
  }

  activate() {
    if (this.isActive) return;

    this.isActive = true;
    this.createOverlay();
    this.addEventListeners();

    // Add visual indicator
    document.body.style.cursor = "crosshair";
    document.body.classList.add("xpath-selection-active");
  }

  deactivate() {
    if (!this.isActive) return;

    this.isActive = false;

    // Clear any pending timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this.removeEventListeners();
    this.removeHighlight();
    this.removeSelectedHighlight();
    this.removeOverlay();
    this.removeXPathPanel();

    // Reset cursor and class
    document.body.style.cursor = "";
    document.body.classList.remove("xpath-selection-active");
  }

  createOverlay() {
    // Hover overlay (red)
    this.overlay = document.createElement("div");
    this.overlay.id = "xpath-selector-overlay";
    this.overlay.style.cssText = `
            position: absolute;
            pointer-events: none;
            border: 2px solid #ff4444;
            background: rgba(255, 68, 68, 0.1);
            z-index: 999999;
            display: none;
            box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
        `;
    document.body.appendChild(this.overlay);

    // Selected overlay (green)
    this.selectedOverlay = document.createElement("div");
    this.selectedOverlay.id = "xpath-selector-selected-overlay";
    this.selectedOverlay.style.cssText = `
            position: absolute;
            pointer-events: none;
            border: 3px solid #4CAF50;
            background: rgba(76, 175, 80, 0.15);
            z-index: 999998;
            display: none;
            box-shadow: 0 0 15px rgba(76, 175, 80, 0.6);
        `;
    document.body.appendChild(this.selectedOverlay);
  }



  addEventListeners() {
    // Sử dụng capture: true để chặn event ở giai đoạn capture
    document.addEventListener("mouseover", this.boundHandlers.mouseover, {
      capture: true,
      passive: false,
    });
    document.addEventListener("click", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
    document.addEventListener("keydown", this.boundHandlers.keydown, {
      capture: true,
      passive: false,
    });

    // Thêm các event khác để chặn hoàn toàn
    document.addEventListener("mousedown", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
    document.addEventListener("mouseup", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
    document.addEventListener("dblclick", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
    document.addEventListener("contextmenu", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
  }

  removeEventListeners() {
    document.removeEventListener("mouseover", this.boundHandlers.mouseover, {
      capture: true,
      passive: false,
    });
    document.removeEventListener("click", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
    document.removeEventListener("keydown", this.boundHandlers.keydown, {
      capture: true,
      passive: false,
    });

    // Loại bỏ các event listener bổ sung
    document.removeEventListener("mousedown", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
    document.removeEventListener("mouseup", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
    document.removeEventListener("dblclick", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
    document.removeEventListener("contextmenu", this.boundHandlers.click, {
      capture: true,
      passive: false,
    });
  }

  handleMouseOver(event) {
    if (!this.isActive) return;

    // Chặn tất cả các event mặc định
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const element = event.target;
    if (element === this.overlay || element === this.selectedOverlay) return;

    this.highlightElement(element);
  }

  handleClick(event) {
    if (!this.isActive) return;

    const element = event.target;
    if (element === this.overlay || element === this.tooltip || element === this.selectedOverlay) return;

    // Don't trigger selection if clicking on XPath panel
    if (element.closest("#xpath-extractor-panel")) return;

    // Chặn tất cả các event mặc định để chỉ lấy XPath
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Clear previous selection before selecting new element
    this.removeSelectedHighlight();

    this.selectElement(element);
  }

  handleKeyDown(event) {
    if (!this.isActive) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.deactivate();

      // Notify background script that selection was deactivated
      chrome.runtime.sendMessage({
        action: "selectionDeactivated",
      });
      return;
    }

    // Navigation with arrow keys
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();

      // Use selectedElement as starting point if available, otherwise use highlightedElement
      const startElement = this.selectedElement || this.highlightedElement;
      if (!startElement) return;

      let targetElement = null;

      switch (event.key) {
        case "ArrowUp":
          targetElement = this.getParentElement(startElement);
          break;
        case "ArrowDown":
          targetElement = this.getFirstChildElement(startElement);
          break;
        case "ArrowLeft":
          targetElement = this.getPreviousSiblingElement(startElement);
          break;
        case "ArrowRight":
          targetElement = this.getNextSiblingElement(startElement);
          break;
      }

      if (targetElement) {
        this.highlightElement(targetElement);
        this.selectElement(targetElement);
      }
    }
  }

  highlightElement(element) {
    this.highlightedElement = element;

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    this.overlay.style.display = "block";
    this.overlay.style.left = rect.left + scrollLeft + "px";
    this.overlay.style.top = rect.top + scrollTop + "px";
    this.overlay.style.width = rect.width + "px";
    this.overlay.style.height = rect.height + "px";
  }

  highlightSelectedElement(element) {
    this.selectedElement = element;

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    this.selectedOverlay.style.display = "block";
    this.selectedOverlay.style.left = rect.left + scrollLeft + "px";
    this.selectedOverlay.style.top = rect.top + scrollTop + "px";
    this.selectedOverlay.style.width = rect.width + "px";
    this.selectedOverlay.style.height = rect.height + "px";
  }

  // Navigation helper methods
  getParentElement(element) {
    const parent = element.parentElement;
    if (
      parent &&
      parent !== document.body &&
      parent !== document.documentElement
    ) {
      return parent;
    }
    return null;
  }

  getFirstChildElement(element) {
    const children = Array.from(element.children).filter(
      (child) =>
        child !== this.overlay &&
        !child.id?.startsWith("xpath-") &&
        child.offsetWidth > 0 &&
        child.offsetHeight > 0
    );
    return children.length > 0 ? children[0] : null;
  }

  getPreviousSiblingElement(element) {
    let sibling = element.previousElementSibling;
    while (sibling) {
      if (
        sibling !== this.overlay &&
        !sibling.id?.startsWith("xpath-") &&
        sibling.offsetWidth > 0 &&
        sibling.offsetHeight > 0
      ) {
        return sibling;
      }
      sibling = sibling.previousElementSibling;
    }
    return null;
  }

  getNextSiblingElement(element) {
    let sibling = element.nextElementSibling;
    while (sibling) {
      if (
        sibling !== this.overlay &&
        !sibling.id?.startsWith("xpath-") &&
        sibling.offsetWidth > 0 &&
        sibling.offsetHeight > 0
      ) {
        return sibling;
      }
      sibling = sibling.nextElementSibling;
    }
    return null;
  }

  selectElement(element) {
    const xpathOptions = this.generateMultipleXPaths(element);
    const elementData = this.getElementData(element);

    // Highlight selected element with fixed border
    this.highlightSelectedElement(element);

    // Show XPath options directly on the page
    this.showXPathPanel(xpathOptions, elementData, element);

    // Keep selection mode active for better UX
    // User can manually turn off selection mode or press ESC
  }

  showXPathPanel(xpathOptions, elementInfo, targetElement) {
    // Remove existing panel if any
    this.removeXPathPanel();

    // Create panel container
    const panel = document.createElement("div");
    panel.id = "xpath-extractor-panel";
    panel.className = "xpath-panel";

    // Position panel at top-right corner
    panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 500px;
            min-width: 400px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 2147483648;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            color: #fff;
            backdrop-filter: blur(10px);
        `;

    // Create panel content
    panel.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h3 style="margin: 0; color: #4CAF50; font-size: 14px; font-weight: 600;">XPath Options</h3>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button id="xpath-nav-up" style="background: #333; border: none; color: #4CAF50; cursor: pointer; font-size: 14px; padding: 6px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: background 0.2s ease;" title="Di chuyển lên element cha" onmouseover="this.style.background='#4CAF50'; this.style.color='#fff'" onmouseout="this.style.background='#333'; this.style.color='#4CAF50'">↑</button>
                        <button id="xpath-nav-down" style="background: #333; border: none; color: #4CAF50; cursor: pointer; font-size: 14px; padding: 6px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: background 0.2s ease;" title="Di chuyển xuống element con" onmouseover="this.style.background='#4CAF50'; this.style.color='#fff'" onmouseout="this.style.background='#333'; this.style.color='#4CAF50'">↓</button>
                        <button id="xpath-panel-close" style="background: none; border: none; color: #999; cursor: pointer; font-size: 16px; padding: 4px;">✕</button>
                    </div>
                </div>
                <div style="font-size: 11px; color: #999;">
                    Element: <span style="color: #4CAF50;">${
                      elementInfo.tagName?.toLowerCase() || "unknown"
                    }</span>
                    ${elementInfo.id ? `#${elementInfo.id}` : ""}
                    ${
                      elementInfo.className
                        ? `.${elementInfo.className.split(" ").join(".")}`
                        : ""
                    }
                </div>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
                ${this.generateXPathOptionsHTML(xpathOptions)}
            </div>
            <div style="padding: 12px; border-top: 1px solid #333; background: #222;">
                <div style="display: flex; gap: 8px;">
                    <button id="xpath-copy-selected" style="flex: 1; padding: 8px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Copy Selected</button>
                    <button id="xpath-close-panel" style="padding: 8px 12px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Close</button>
                </div>
                <div id="xpath-status" style="margin-top: 8px; font-size: 11px; color: #999; text-align: center;">Click an XPath option to select</div>
            </div>
        `;

    // Add panel to page
    document.body.appendChild(panel);

    // Bind events
    this.bindXPathPanelEvents(panel, xpathOptions);

    // Auto-select first option
    if (xpathOptions.length > 0) {
      this.selectXPathOption(0, xpathOptions);
    }

    // No need to adjust position since panel is fixed at top-right
    // this.adjustPanelPosition(panel);
  }

  generateXPathOptionsHTML(xpathOptions) {
    return xpathOptions
      .map(
        (option, index) => `
            <div class="xpath-option" data-index="${index}" style="
                padding: 12px;
                border-bottom: 1px solid #333;
                cursor: pointer;
                transition: background 0.2s ease;
            " onmouseover="this.style.background='#2a2a2a'" onmouseout="this.style.background=''">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-weight: 600; color: #4CAF50; font-size: 11px; text-transform: uppercase;">${option.type}</span>
                    <span style="font-size: 10px; color: #999;">${option.description}</span>
                </div>
                <div style="font-family: 'Courier New', monospace; font-size: 11px; color: #ddd; word-break: break-all; line-height: 1.4;">${option.xpath}</div>
            </div>
        `
      )
      .join("");
  }

  bindXPathPanelEvents(panel, xpathOptions) {
    // Close button events
    panel.querySelector("#xpath-panel-close").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.removeXPathPanel();
    });

    panel.querySelector("#xpath-close-panel").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.removeXPathPanel();
    });

    // Navigation button events
    panel.querySelector("#xpath-nav-up").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.navigateToParentElement();
    });

    panel.querySelector("#xpath-nav-down").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.navigateToChildElement();
    });

    // XPath option selection
    panel.querySelectorAll(".xpath-option").forEach((optionEl, index) => {
      optionEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectXPathOption(index, xpathOptions);
      });
    });

    // Copy selected XPath
    panel
      .querySelector("#xpath-copy-selected")
      .addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.copySelectedXPath();
      });

    // Close panel when clicking outside
    document.addEventListener(
      "click",
      (e) => {
        if (
          !panel.contains(e.target) &&
          !e.target.closest(".xpath-selector-highlight")
        ) {
          this.removeXPathPanel();
        }
      },
      { once: true }
    );
  }

  selectXPathOption(index, xpathOptions) {
    const panel = document.getElementById("xpath-extractor-panel");
    if (!panel || !xpathOptions[index]) return;

    // Remove previous selection
    panel.querySelectorAll(".xpath-option").forEach((el) => {
      el.style.background = "";
      el.style.borderLeft = "";
    });

    // Add selection to clicked option
    const selectedOption = panel.querySelector(`[data-index="${index}"]`);
    if (selectedOption) {
      selectedOption.style.background = "rgba(76, 175, 80, 0.2)";
      selectedOption.style.borderLeft = "4px solid #4CAF50";
    }

    // Store selected XPath
    this.selectedXPath = xpathOptions[index].xpath;

    // Update status
    const statusEl = panel.querySelector("#xpath-status");
    if (statusEl) {
      statusEl.textContent = `Selected: ${xpathOptions[index].type} XPath`;
      statusEl.style.color = "#4CAF50";
    }
  }

  async copySelectedXPath() {
    if (!this.selectedXPath) {
      this.showXPathStatus("No XPath selected", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(this.selectedXPath);
      this.showXPathStatus("✅ XPath copied to clipboard!", "success");
    } catch (error) {
      console.error("Failed to copy XPath:", error);
      this.showXPathStatus("❌ Failed to copy XPath", "error");
    }
  }

  showXPathStatus(message, type) {
    const panel = document.getElementById("xpath-extractor-panel");
    if (!panel) return;

    const statusEl = panel.querySelector("#xpath-status");
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.color =
        type === "success" ? "#4CAF50" : type === "error" ? "#f44336" : "#999";

      // Reset after 3 seconds
      setTimeout(() => {
        if (statusEl) {
          statusEl.textContent = "Click an XPath option to select";
          statusEl.style.color = "#999";
        }
      }, 3000);
    }
  }

  adjustPanelPosition(panel) {
    const rect = panel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position if panel goes off screen
    if (rect.right > viewportWidth) {
      panel.style.left = viewportWidth - rect.width - 20 + "px";
    }

    // Adjust vertical position if panel goes off screen
    if (rect.bottom > viewportHeight) {
      const targetElement = document.querySelector(".xpath-selector-highlight");
      if (targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop;
        panel.style.top = targetRect.top + scrollTop - rect.height - 10 + "px";
      }
    }
  }

  navigateToParentElement() {
    const startElement = this.selectedElement || this.highlightedElement;
    if (!startElement) return;

    const parentElement = this.getParentElement(startElement);
    if (parentElement) {
      this.removeSelectedHighlight();
      this.highlightElement(parentElement);
      this.selectElement(parentElement);
    }
  }

  navigateToChildElement() {
    const startElement = this.selectedElement || this.highlightedElement;
    if (!startElement) return;

    const childElement = this.getFirstChildElement(startElement);
    if (childElement) {
      this.removeSelectedHighlight();
      this.highlightElement(childElement);
      this.selectElement(childElement);
    }
  }

  removeXPathPanel() {
    const existingPanel = document.getElementById("xpath-extractor-panel");
    if (existingPanel) {
      existingPanel.remove();
    }
    this.selectedXPath = null;
  }

  generateMultipleXPaths(element) {
    const xpaths = [];

    // 1. ID-based XPath (if available and unique)
    if (
      element.id &&
      document.querySelectorAll(`#${element.id}`).length === 1
    ) {
      xpaths.push({
        type: "ID",
        xpath: `//*[@id="${this.escapeXPathValue(element.id)}"]`,
        description: "Dựa trên ID (ổn định nhất)",
      });
    }

    // 2. Name attribute XPath (if available and unique)
    if (
      element.name &&
      document.querySelectorAll(`[name="${element.name}"]`).length === 1
    ) {
      xpaths.push({
        type: "Name",
        xpath: `//*[@name="${this.escapeXPathValue(element.name)}"]`,
        description: "Dựa trên thuộc tính name",
      });
    }

    // 3. Data attributes XPath
    const dataAttrs = this.getUniqueDataAttributes(element);
    if (dataAttrs.length > 0) {
      const dataXPath = `//*[${dataAttrs.join(" and ")}]`;
      if (
        document.evaluate(
          dataXPath,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        ).snapshotLength === 1
      ) {
        xpaths.push({
          type: "Data Attributes",
          xpath: dataXPath,
          description: "Dựa trên data attributes",
        });
      }
    }

    // 4. Class-based XPath
    if (element.className) {
      const classes = element.className
        .trim()
        .split(/\s+/)
        .filter(
          (c) =>
            c &&
            !c.startsWith("xpath-selector") &&
            !c.match(/^(active|selected|hover|focus)$/)
        );
      if (classes.length > 0) {
        const classXPath = `//${element.tagName.toLowerCase()}[@class="${classes.join(
          " "
        )}"]`;
        if (
          document.evaluate(
            classXPath,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          ).snapshotLength === 1
        ) {
          xpaths.push({
            type: "Class",
            xpath: classXPath,
            description: "Dựa trên class (có thể thay đổi)",
          });
        }

        // Contains class version
        xpaths.push({
          type: "Contains Class",
          xpath: `//${element.tagName.toLowerCase()}[contains(@class,"${
            classes[0]
          }")]`,
          description: "Chứa class chính (linh hoạt hơn)",
        });
      }
    }

    // 5. Text-based XPath
    const text = element.textContent?.trim();
    if (text && text.length > 0 && text.length < 100) {
      const escapedText = this.escapeXPathValue(text);
      const textXPath = `//${element.tagName.toLowerCase()}[text()="${escapedText}"]`;
      if (
        document.evaluate(
          textXPath,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        ).snapshotLength === 1
      ) {
        xpaths.push({
          type: "Text Content",
          xpath: textXPath,
          description: "Dựa trên nội dung text",
        });
      }
    }

    // 6. Attribute-based XPaths
    const uniqueAttrs = [
      "type",
      "value",
      "href",
      "src",
      "alt",
      "title",
      "placeholder",
      "role",
    ];
    for (const attrName of uniqueAttrs) {
      const attrValue = element.getAttribute(attrName);
      if (attrValue) {
        const attrXPath = `//${element.tagName.toLowerCase()}[@${attrName}="${this.escapeXPathValue(
          attrValue
        )}"]`;
        if (
          document.evaluate(
            attrXPath,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          ).snapshotLength === 1
        ) {
          xpaths.push({
            type: `Attribute (${attrName})`,
            xpath: attrXPath,
            description: `Dựa trên thuộc tính ${attrName}`,
          });
        }
      }
    }

    // 7. Position-based XPath (relative to parent)
    const parent = element.parentNode;
    if (parent && parent.nodeType === Node.ELEMENT_NODE) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === element.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(element) + 1;
        xpaths.push({
          type: "Position",
          xpath: `//${parent.tagName.toLowerCase()}/${element.tagName.toLowerCase()}[${index}]`,
          description: "Dựa trên vị trí (có thể thay đổi)",
        });
      }
    }

    // Absolute XPath đã được loại bỏ theo yêu cầu

    // Smart Path đã được loại bỏ theo yêu cầu

    // Remove duplicates and return
    const uniqueXPaths = xpaths.filter(
      (xpath, index, self) =>
        index === self.findIndex((x) => x.xpath === xpath.xpath)
    );

    return uniqueXPaths;
  }

  getAbsoluteXPath(element) {
    const parts = [];
    let current = element;

    while (
      current &&
      current.nodeType === Node.ELEMENT_NODE &&
      current !== document.documentElement
    ) {
      let selector = current.tagName.toLowerCase();

      if (current.parentNode) {
        const siblings = Array.from(current.parentNode.children).filter(
          (child) => child.tagName === current.tagName
        );

        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `[${index}]`;
        }
      }

      parts.unshift(selector);
      current = current.parentNode;
    }

    return "/" + parts.join("/");
  }

  generateXPath(element) {
    // Priority 1: Use ID if available and unique
    if (
      element.id &&
      document.querySelectorAll(`#${element.id}`).length === 1
    ) {
      return `//*[@id="${this.escapeXPathValue(element.id)}"]`;
    }

    // Priority 2: Use name attribute if available and unique
    if (
      element.name &&
      document.querySelectorAll(`[name="${element.name}"]`).length === 1
    ) {
      return `//*[@name="${this.escapeXPathValue(element.name)}"]`;
    }

    // Priority 3: Use data attributes if available
    const dataAttrs = this.getUniqueDataAttributes(element);
    if (dataAttrs.length > 0) {
      const dataXPath = `//*[${dataAttrs.join(" and ")}]`;
      if (
        document.evaluate(
          dataXPath,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        ).snapshotLength === 1
      ) {
        return dataXPath;
      }
    }

    // Priority 4: Use combination of tag + unique attributes
    const uniqueSelector = this.buildUniqueSelector(element);
    if (uniqueSelector) {
      return uniqueSelector;
    }

    // Priority 5: Use text content for links and buttons
    if (
      ["a", "button", "span", "div"].includes(element.tagName.toLowerCase())
    ) {
      const text = element.textContent?.trim();
      if (text && text.length < 50) {
        const textXPath = `//${element.tagName.toLowerCase()}[text()="${this.escapeXPathValue(
          text
        )}"]`;
        if (
          document.evaluate(
            textXPath,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          ).snapshotLength === 1
        ) {
          return textXPath;
        }
      }
    }

    // Fallback: Build path with smart positioning
    return this.buildSmartPath(element);
  }

  getUniqueDataAttributes(element) {
    const dataAttrs = [];
    for (const attr of element.attributes) {
      if (attr.name.startsWith("data-") && attr.value) {
        // Escape quotes in attribute values to prevent XPath syntax errors
        const escapedValue = this.escapeXPathValue(attr.value);
        dataAttrs.push(`@${attr.name}="${escapedValue}"`);
      }
    }
    return dataAttrs;
  }

  buildUniqueSelector(element) {
    const tag = element.tagName.toLowerCase();
    const attributes = [];

    // Check for unique class combinations
    if (element.className) {
      const classes = element.className
        .trim()
        .split(/\s+/)
        .filter(
          (c) =>
            c &&
            !c.startsWith("xpath-selector") &&
            !c.match(/^(active|selected|hover|focus)$/)
        );
      if (classes.length > 0) {
        const classSelector = `//${tag}[@class="${this.escapeXPathValue(
          classes.join(" ")
        )}"]`;
        if (
          document.evaluate(
            classSelector,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          ).snapshotLength === 1
        ) {
          return classSelector;
        }
      }
    }

    // Check for other unique attributes
    const uniqueAttrs = [
      "type",
      "value",
      "href",
      "src",
      "alt",
      "title",
      "placeholder",
    ];
    for (const attrName of uniqueAttrs) {
      const attrValue = element.getAttribute(attrName);
      if (attrValue) {
        const attrSelector = `//${tag}[@${attrName}="${this.escapeXPathValue(
          attrValue
        )}"]`;
        if (
          document.evaluate(
            attrSelector,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          ).snapshotLength === 1
        ) {
          return attrSelector;
        }
      }
    }

    return null;
  }

  buildSmartPath(element) {
    const parts = [];
    let current = element;

    while (
      current &&
      current.nodeType === Node.ELEMENT_NODE &&
      current !== document.body
    ) {
      let selector = current.tagName.toLowerCase();

      // Try to use stable attributes first
      if (current.id) {
        selector += `[@id="${this.escapeXPathValue(current.id)}"]`;
      } else if (current.className) {
        const stableClasses = current.className
          .trim()
          .split(/\s+/)
          .filter(
            (c) =>
              c &&
              !c.startsWith("xpath-selector") &&
              !c.match(/^(active|selected|hover|focus|ng-|js-)$/)
          );
        if (stableClasses.length > 0) {
          selector += `[contains(@class,"${this.escapeXPathValue(
            stableClasses[0]
          )}")]`;
        }
      } else {
        // Use position only as last resort
        const siblings = Array.from(current.parentNode?.children || []).filter(
          (child) => child.tagName === current.tagName
        );

        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `[${index}]`;
        }
      }

      parts.unshift(selector);

      // Stop if we found a unique identifier
      if (current.id || current.tagName.toLowerCase() === "form") {
        break;
      }

      current = current.parentNode;
    }

    return "//" + parts.join("/");
  }

  getElementInfo(element) {
    let info = element.tagName.toLowerCase();

    if (element.id) {
      info += `#${element.id}`;
    }

    if (element.className) {
      const classes = element.className
        .trim()
        .split(/\s+/)
        .filter((c) => c && !c.startsWith("xpath-selector"));
      if (classes.length > 0) {
        info += `.${classes.join(".")}`;
      }
    }

    return info;
  }

  getElementData(element) {
    const attributes = Array.from(element.attributes).map((attr) => ({
      name: attr.name,
      value: attr.value,
    }));

    return {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      text: element.textContent?.trim().substring(0, 100),
      attributes: attributes,
    };
  }

  removeHighlight() {
    if (this.overlay) {
      this.overlay.style.display = "none";
    }
    this.highlightedElement = null;
  }

  removeSelectedHighlight() {
    if (this.selectedOverlay) {
      this.selectedOverlay.style.display = "none";
    }
    this.selectedElement = null;
  }

  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.selectedOverlay) {
      this.selectedOverlay.remove();
      this.selectedOverlay = null;
    }
  }


}

// Initialize XPath selector
if (!window.xpathSelector) {
  window.xpathSelector = new XPathSelector();
}

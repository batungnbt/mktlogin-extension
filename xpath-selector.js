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

    this.initializeCropProperties();
    this.setupMessageListener();
    console.log("setupMessageListenter");
    this.setupElectronMessageListener();
  }

  initializeCropProperties() {
    // Crop mode properties
    this.isCropActive = false;
    this.cropStartX = 0;
    this.cropStartY = 0;
    this.cropEndX = 0;
    this.cropEndY = 0;
    this.isDragging = false;
    this.cropOverlay = null;
    this.dimmingOverlay = null;
    this.cropInstruction = null;
    this.cropHandlers = null;
  }

  // Helper function to escape XPath attribute values
  escapeXPathValue(value) {
    if (typeof value !== "string") return value;
    // Replace double quotes with &quot; to prevent XPath syntax errors
    return value.replace(/"/g, "&quot;");
  }

  setupElectronMessageListener() {
    // Event listener moved to content.js
    // This method is kept for backward compatibility but does nothing
  }

  handleElectronMessage(data) {
    if (!data || !data.action) {
      console.error("Invalid message data - missing action:", data);
      this.showNotification("Invalid message: missing action", "error");
      return;
    }

    try {
      switch (data.action) {
        case "openTool":
          this.handleOpenTool(data);
          break;
        case "activateXPath":
          if (this.isActive) {
            this.deactivate();
          }
          this.activate();
          break;
        case "activateCrop":
          if (this.isCropActive) {
            this.deactivateCropMode();
          }
          this.activateCropMode();
          break;
        case "deactivateAll":
          this.deactivate();
          this.deactivateCropMode();
          break;
        case "test":
          this.showNotification(
            `Extension test thành công! (${data.source || "unknown source"})`,
            "success"
          );
          break;
        default:
          console.warn("Unknown action:", data.action);
          this.showNotification(`Unknown action: ${data.action}`, "error");
      }

      // Gửi response về cho app
      const response = {
        type: "EXTENSION_RESPONSE",
        success: true,
        action: data.action,
        timestamp: Date.now(),
        extensionStatus: {
          xpathActive: this.isActive,
          cropActive: this.isCropActive,
        },
      };

      window.postMessage(response, "*");
    } catch (error) {
      console.error("❌ Error processing message:", error);
      console.error("❌ Error stack:", error.stack);

      const errorResponse = {
        type: "EXTENSION_RESPONSE",
        success: false,
        action: data.action,
        error: error.message,
        timestamp: Date.now(),
      };

      this.showNotification(`Error: ${error.message}`, "error");
      window.postMessage(errorResponse, "*");
    }
  }

  handleOpenTool(data) {
    console.log("Opening tool:", data.toolName);

    // Hiển thị thông báo cho user
    this.showNotification(
      `Tool "${data.toolName}" được kích hoạt từ MKTLogin app`,
      "success"
    );

    // Tự động mở popup extension nếu có
    chrome.runtime.sendMessage({
      type: "OPEN_POPUP_FROM_ELECTRON",
      data: data,
    });
  }

  showNotification(message, type = "info") {
    // Tạo notification element
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${
        type === "success"
          ? "#4CAF50"
          : type === "error"
          ? "#f44336"
          : "#2196F3"
      };
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 999999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Tự động xóa sau 3 giây
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
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
      } else if (message.type === "ACTIVATE_CROP_MODE") {
        this.activateCropMode();
        sendResponse({ success: true });
      } else if (message.type === "DEACTIVATE_CROP_MODE") {
        this.deactivateCropMode();
        sendResponse({ success: true });
      } else if (message.type === "PROCESS_CAPTURED_IMAGE") {
        this.processCapturedImage(
          message.dataUrl,
          message.cropArea,
          message.windowSize
        );
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
    document.body.style.cursor = "none";
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
    if (
      element === this.overlay ||
      element === this.tooltip ||
      element === this.selectedOverlay
    )
      return;

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
    // Save current panel position if it exists
    let savedPosition = null;
    const existingPanel = document.getElementById("xpath-extractor-panel");
    if (existingPanel) {
      const rect = existingPanel.getBoundingClientRect();
      savedPosition = {
        top: rect.top,
        left: rect.left,
      };
    }

    // Remove existing panel if any
    this.removeXPathPanel();

    // Create panel container
    const panel = document.createElement("div");
    panel.id = "xpath-extractor-panel";
    panel.className = "xpath-panel";

    // Use saved position or default position
    const panelTop = savedPosition ? savedPosition.top : 20;
    const panelLeft = savedPosition
      ? savedPosition.left
      : window.innerWidth - 370;

    // Position panel (draggable)
    panel.style.cssText = `
            position: fixed;
            top: ${panelTop}px;
            left: ${panelLeft}px;
            width: 350px;
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
            <div id="xpath-panel-header" style="padding: 16px; border-bottom: 1px solid #333; cursor: move; user-select: none; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h3 style="margin: 0; color: #4CAF50; font-size: 14px; font-weight: 600;">XPath Options</h3>
                    <div id="move-icon" style="position: absolute; top: -14px; left: -14px; opacity: 0; transition: opacity 0.2s ease; color: #4CAF50; pointer-events: auto; cursor: move; background: rgba(26, 26, 26, 0.9); border-radius: 50%; padding: 6px; border: 1px solid #333;">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13,11H18L16.5,9.5L17.92,8.08L21.84,12L17.92,15.92L16.5,14.5L18,13H13V18L14.5,16.5L15.92,17.92L12,21.84L8.08,17.92L9.5,16.5L11,18V13H6L7.5,14.5L6.08,15.92L2.16,12L6.08,8.08L7.5,9.5L6,11H11V6L9.5,7.5L8.08,6.08L12,2.16L15.92,6.08L14.5,7.5L13,6V11Z"/>
                        </svg>
                    </div>
                    <button id="xpath-panel-close" style="background: none; border: none; color: #999; cursor: pointer !important; font-size: 16px; padding: 4px; z-index: 10; position: relative;">✕</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
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
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button id="xpath-nav-up" style="background: #333; border: none; color: #4CAF50; cursor: pointer !important; font-size: 14px; padding: 6px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: background 0.2s ease;" title="Di chuyển lên element cha" onmouseover="this.style.background='#4CAF50'; this.style.color='#fff'" onmouseout="this.style.background='#333'; this.style.color='#4CAF50'"><svg viewBox="0 0 24 24" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(90deg); pointer-events: none;"><g><path fill="none" d="M0 0h24v24H0z"></path><path fill-rule="nonzero" d="M7.828 11H20v2H7.828l5.364 5.364-1.414 1.414L4 12l7.778-7.778 1.414 1.414z"></path></g></svg></button>
                        <button id="xpath-nav-down" style="background: #333; border: none; color: #4CAF50; cursor: pointer !important; font-size: 14px; padding: 6px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: background 0.2s ease;" title="Di chuyển xuống element con" onmouseover="this.style.background='#4CAF50'; this.style.color='#fff'" onmouseout="this.style.background='#333'; this.style.color='#4CAF50'"><svg viewBox="0 0 24 24" fill="currentColor" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(-90deg); pointer-events: none;"><g><path fill="none" d="M0 0h24v24H0z"></path><path fill-rule="nonzero" d="M7.828 11H20v2H7.828l5.364 5.364-1.414 1.414L4 12l7.778-7.778 1.414 1.414z"></path></g></svg></button>
                    </div>
                </div>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
                ${this.generateXPathOptionsHTML(xpathOptions)}
            </div>
            <div style="padding: 12px; border-top: 1px solid #333; background: #222;">
                <div id="xpath-status" style="margin-top: 8px; font-size: 11px; color: #999; text-align: center;">Chọn một Xpath để sao chép</div>
            </div>
        `;

    // Add panel to page
    document.body.appendChild(panel);

    // Bind events
    this.bindXPathPanelEvents(panel, xpathOptions);

    // No auto-selection - user must click to select and copy

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

    // Close button event is already handled above for #xpath-panel-close

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

    // Copy selected XPath functionality is now integrated into selectXPathOption

    // Prevent panel clicks from bubbling to document
    panel.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Close panel when clicking outside
    document.addEventListener(
      "click",
      (e) => {
        const moveIcon = panel.querySelector("#move-icon");
        if (
          !panel.contains(e.target) &&
          !e.target.closest(".xpath-selector-highlight") &&
          !(moveIcon && moveIcon.contains(e.target))
        ) {
          this.removeXPathPanel();
        }
      },
      { once: true }
    );

    // Drag functionality
    const header = panel.querySelector("#xpath-panel-header");
    const moveIcon = panel.querySelector("#move-icon");
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    // Show/hide move icon on hover
    header.addEventListener("mouseenter", () => {
      if (moveIcon) moveIcon.style.opacity = "1";
    });

    header.addEventListener("mouseleave", (e) => {
      // Don't hide icon if mouse is moving to the move icon or its background area
      const iconRect = moveIcon ? moveIcon.getBoundingClientRect() : null;
      if (moveIcon && iconRect) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const isInIconArea =
          mouseX >= iconRect.left &&
          mouseX <= iconRect.right &&
          mouseY >= iconRect.top &&
          mouseY <= iconRect.bottom;

        if (!isInIconArea && !moveIcon.contains(e.relatedTarget)) {
          moveIcon.style.opacity = "0";
        }
      } else if (moveIcon && !moveIcon.contains(e.relatedTarget)) {
        moveIcon.style.opacity = "0";
      }
    });

    // Keep icon visible when hovering over it
    if (moveIcon) {
      moveIcon.addEventListener("mouseenter", () => {
        moveIcon.style.opacity = "1";
      });

      moveIcon.addEventListener("mouseleave", (e) => {
        // Only hide if not moving back to header
        if (!header.contains(e.relatedTarget)) {
          moveIcon.style.opacity = "0";
        }
      });

      // Allow dragging from the icon itself
      moveIcon.addEventListener("mousedown", (e) => {
        // Trigger the same drag functionality as header
        const headerEvent = new MouseEvent("mousedown", {
          clientX: e.clientX,
          clientY: e.clientY,
          bubbles: true,
        });
        header.dispatchEvent(headerEvent);
        e.preventDefault();
        e.stopPropagation();
      });
    }

    header.addEventListener("mousedown", (e) => {
      // Don't drag if clicking on close button
      if (e.target.id === "xpath-panel-close") return;

      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep panel within viewport bounds
      const maxX = window.innerWidth - panel.offsetWidth;
      const maxY = window.innerHeight - panel.offsetHeight;

      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));

      panel.style.left = boundedX + "px";
      panel.style.top = boundedY + "px";
      panel.style.right = "auto";

      e.preventDefault();
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  async selectXPathOption(index, xpathOptions) {
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

    // Automatically copy XPath to clipboard
    try {
      await navigator.clipboard.writeText(this.selectedXPath);
      this.showXPathStatus("✅ Sao chép XPath thành công", "success");
    } catch (error) {
      console.error("Failed to copy XPath:", error);
      this.showXPathStatus("❌ Sao chép XPath thất bại", "error");
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
          statusEl.textContent = "Chọn một Xpath để sao chép";
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
      // Handle both string and DOMTokenList (for SVG elements)
      const classNameStr =
        typeof element.className === "string"
          ? element.className
          : element.className.baseVal || element.className.toString();

      const classes = classNameStr
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
      // Handle className for both HTML and SVG elements
      const classNameStr =
        typeof element.className === "string"
          ? element.className
          : element.className.baseVal || element.className.toString();

      const classes = classNameStr
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
        // Handle className for both HTML and SVG elements
        const classNameStr =
          typeof current.className === "string"
            ? current.className
            : current.className.baseVal || current.className.toString();

        const stableClasses = classNameStr
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
      // Handle className for both HTML and SVG elements
      const classNameStr =
        typeof element.className === "string"
          ? element.className
          : element.className.baseVal || element.className.toString();

      const classes = classNameStr
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

    // Handle className for both HTML and SVG elements
    let className = element.className;
    if (className && typeof className !== "string") {
      // For SVG elements, className is a DOMTokenList
      className = className.baseVal || className.toString();
    }

    return {
      tagName: element.tagName,
      id: element.id,
      className: className,
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

  // Crop Mode Methods
  activateCropMode() {
    console.log("Activating crop mode...");
    if (this.isCropActive) return;

    // Deactivate XPath mode if active
    if (this.isActive) {
      this.deactivate();
    }

    this.isCropActive = true;
    this.cropStartX = 0;
    this.cropStartY = 0;
    this.cropEndX = 0;
    this.cropEndY = 0;
    this.isDragging = false;

    this.createCropOverlay();
    this.addCropEventListeners();

    // Add visual indicator
    document.body.style.cursor = "none";
    document.body.classList.add("crop-mode-active");

    // Show instruction
    this.showCropInstruction();
    console.log("Crop mode activated successfully");
  }

  deactivateCropMode() {
    if (!this.isCropActive) return;

    this.isCropActive = false;
    this.removeCropEventListeners();
    this.removeCropOverlay();
    this.removeCropInstruction();

    // Reset cursor and class
    document.body.style.cursor = "";
    document.body.classList.remove("crop-mode-active");
  }

  createCropOverlay() {
    // Create crop selection overlay
    this.cropOverlay = document.createElement("div");
    this.cropOverlay.id = "crop-selection-overlay";
    this.cropOverlay.style.cssText = `
      position: fixed !important;
      border: none !important;
      background: transparent !important;
      z-index: 999999 !important;
      display: none !important;
      pointer-events: none !important;
      box-shadow: none !important;
      transition: all 0.1s ease !important;
    `;
    document.body.appendChild(this.cropOverlay);

    // Create dimming overlay
    this.dimmingOverlay = document.createElement("div");
    this.dimmingOverlay.id = "crop-dimming-overlay";
    this.dimmingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      z-index: 999998;
      pointer-events: none;
      display: block;
    `;
    document.body.appendChild(this.dimmingOverlay);
  }

  addCropEventListeners() {
    this.cropHandlers = {
      mousedown: this.handleCropMouseDown.bind(this),
      mousemove: this.handleCropMouseMove.bind(this),
      mouseup: this.handleCropMouseUp.bind(this),
      keydown: this.handleCropKeyDown.bind(this),
    };

    document.addEventListener("mousedown", this.cropHandlers.mousedown, true);
    document.addEventListener("mousemove", this.cropHandlers.mousemove, true);
    document.addEventListener("mouseup", this.cropHandlers.mouseup, true);
    document.addEventListener("keydown", this.cropHandlers.keydown, true);
  }

  removeCropEventListeners() {
    if (this.cropHandlers) {
      document.removeEventListener(
        "mousedown",
        this.cropHandlers.mousedown,
        true
      );
      document.removeEventListener(
        "mousemove",
        this.cropHandlers.mousemove,
        true
      );
      document.removeEventListener("mouseup", this.cropHandlers.mouseup, true);
      document.removeEventListener("keydown", this.cropHandlers.keydown, true);
    }
  }

  handleCropMouseDown(event) {
    console.log(
      "Crop mousedown event:",
      event,
      "isCropActive:",
      this.isCropActive
    );
    if (!this.isCropActive) return;

    event.preventDefault();
    event.stopPropagation();

    this.isDragging = true;
    this.cropStartX = event.clientX;
    this.cropStartY = event.clientY;
    this.cropEndX = event.clientX;
    this.cropEndY = event.clientY;

    console.log("Starting crop at:", this.cropStartX, this.cropStartY);
    this.updateCropOverlay();
  }

  handleCropMouseMove(event) {
    if (!this.isCropActive || !this.isDragging) return;

    event.preventDefault();
    event.stopPropagation();

    this.cropEndX = event.clientX;
    this.cropEndY = event.clientY;

    this.updateCropOverlay();
  }

  handleCropMouseUp(event) {
    if (!this.isCropActive || !this.isDragging) return;

    event.preventDefault();
    event.stopPropagation();

    this.isDragging = false;

    // Calculate crop area
    const cropArea = {
      x: Math.min(this.cropStartX, this.cropEndX),
      y: Math.min(this.cropStartY, this.cropEndY),
      width: Math.abs(this.cropEndX - this.cropStartX),
      height: Math.abs(this.cropEndY - this.cropStartY),
    };

    // Only proceed if area is large enough
    if (cropArea.width > 10 && cropArea.height > 10) {
      this.processCropArea(cropArea);
    }
  }

  handleCropKeyDown(event) {
    if (!this.isCropActive) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      this.deactivateCropMode();

      // Notify background script
      chrome.runtime.sendMessage({
        type: "CROP_MODE_DEACTIVATED",
      });
    }
  }

  updateCropOverlay() {
    if (!this.cropOverlay || !this.dimmingOverlay) return;

    const x = Math.min(this.cropStartX, this.cropEndX);
    const y = Math.min(this.cropStartY, this.cropEndY);
    const width = Math.abs(this.cropEndX - this.cropStartX);
    const height = Math.abs(this.cropEndY - this.cropStartY);

    // Update crop selection overlay (green border)
    this.cropOverlay.style.left = x + "px";
    this.cropOverlay.style.top = y + "px";
    this.cropOverlay.style.width = width + "px";
    this.cropOverlay.style.height = height + "px";
    this.cropOverlay.style.setProperty("display", "block", "important");

    // Update dimming overlay with clip-path to create "hole" effect
    // This makes the crop area appear bright while everything else is dimmed
    const clipPath = `polygon(
      0% 0%, 
      0% 100%, 
      ${x}px 100%, 
      ${x}px ${y}px, 
      ${x + width}px ${y}px, 
      ${x + width}px ${y + height}px, 
      ${x}px ${y + height}px, 
      ${x}px 100%, 
      100% 100%, 
      100% 0%
    )`;

    this.dimmingOverlay.style.clipPath = clipPath;
    this.dimmingOverlay.style.display = "block";
  }

  async processCropArea(cropArea) {
    try {
      // Send crop area to background script for processing
      const response = await chrome.runtime.sendMessage({
        type: "PROCESS_CROP_AREA",
        cropArea: cropArea,
        windowSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      });

      if (response && response.success) {
        // Success will be handled by processCapturedImage
      } else {
        this.showCropStatus("Lỗi khi crop ảnh", "error");
      }
    } catch (error) {
      console.error("Error processing crop area:", error);
      this.showCropStatus("Lỗi khi crop ảnh", "error");
    }
  }

  async processCapturedImage(dataUrl, cropArea, windowSize) {
    try {
      // Create image and canvas for cropping
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = cropArea.width;
          canvas.height = cropArea.height;
          const ctx = canvas.getContext("2d");

          // Calculate scale factors
          const scaleX = img.width / windowSize.width;
          const scaleY = img.height / windowSize.height;

          // Adjust crop coordinates for image scale
          const scaledX = cropArea.x * scaleX;
          const scaledY = cropArea.y * scaleY;
          const scaledWidth = cropArea.width * scaleX;
          const scaledHeight = cropArea.height * scaleY;

          // Draw cropped portion
          ctx.drawImage(
            img,
            scaledX,
            scaledY,
            scaledWidth,
            scaledHeight,
            0,
            0,
            cropArea.width,
            cropArea.height
          );

          // Convert canvas to data URL and show modal
          const croppedDataUrl = canvas.toDataURL("image/png");

          // Show crop result modal
          this.showCropResultModal(croppedDataUrl);
          this.deactivateCropMode();
        } catch (error) {
          console.error("Error cropping image:", error);
          this.showCropStatus("Lỗi khi crop ảnh", "error");
        }
      };

      img.onerror = () => {
        this.showCropStatus("Lỗi khi tải ảnh", "error");
      };

      img.src = dataUrl;
    } catch (error) {
      console.error("Error processing captured image:", error);
      this.showCropStatus("Lỗi khi xử lý ảnh", "error");
    }
  }

  showCropInstruction() {
    this.cropInstruction = document.createElement("div");
    this.cropInstruction.id = "crop-instruction";
    this.cropInstruction.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 1000000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    this.cropInstruction.textContent =
      "Kéo để chọn vùng cần crop. Nhấn ESC để thoát.";
    document.body.appendChild(this.cropInstruction);
  }

  removeCropInstruction() {
    if (this.cropInstruction) {
      this.cropInstruction.remove();
      this.cropInstruction = null;
    }
  }

  showCropStatus(message, type = "info") {
    const status = document.createElement("div");
    status.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: ${
        type === "success"
          ? "#4CAF50"
          : type === "error"
          ? "#f44336"
          : "#2196F3"
      };
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000001;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;
    status.textContent = message;
    document.body.appendChild(status);

    setTimeout(() => {
      if (status.parentNode) {
        status.parentNode.removeChild(status);
      }
    }, 3000);
  }

  removeCropOverlay() {
    if (this.cropOverlay) {
      this.cropOverlay.remove();
      this.cropOverlay = null;
    }
    if (this.dimmingOverlay) {
      this.dimmingOverlay.remove();
      this.dimmingOverlay = null;
    }
  }

  showCropResultModal(croppedDataUrl) {
    const modal = document.createElement("div");
    modal.id = "crop-result-modal";
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 2147483647;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: Arial, sans-serif;
    `;

    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 90%;
      max-height: 90%;
      overflow: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    `;

    const img = document.createElement("img");
    img.src = croppedDataUrl;
    img.style.cssText = `
      max-width: 100%;
      max-height: 60vh;
      border: 1px solid #ddd;
      border-radius: 4px;
    `;

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      margin-top: 15px;
      display: flex;
      gap: 10px;
      justify-content: center;
    `;

    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Tải xuống";
    downloadBtn.style.cssText = `
      padding: 10px 20px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    downloadBtn.onclick = () => this.downloadImage(croppedDataUrl);

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy Base64";
    copyBtn.style.cssText = `
      padding: 10px 20px;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    copyBtn.onclick = () => this.copyBase64ToClipboard(croppedDataUrl);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Đóng";
    closeBtn.style.cssText = `
      padding: 10px 20px;
      background: #666;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    closeBtn.onclick = () => modal.remove();

    buttonContainer.appendChild(downloadBtn);
    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(closeBtn);

    modalContent.appendChild(img);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  downloadImage(dataUrl) {
    const link = document.createElement("a");
    link.download = `crop-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  async copyBase64ToClipboard(dataUrl) {
    try {
      await navigator.clipboard.writeText(dataUrl);
      this.showCropStatus("✅ Base64 đã được copy!", "success");
    } catch (error) {
      console.error("Failed to copy base64:", error);
      this.showCropStatus("❌ Lỗi khi copy base64", "error");
    }
  }
}

// Initialize XPath Selector
const xpathSelector = new XPathSelector();

// Expose instance to window object for access from content.js
window.xpathSelector = xpathSelector;

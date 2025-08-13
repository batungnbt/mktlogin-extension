class XPathExtractor {
    constructor() {
        this.isActive = false;
        this.currentTabId = null;
        this.initializeElements();
        this.bindEvents();
        this.getCurrentTab();
        this.checkStoredXPath();
    }

    initializeElements() {
        this.toggleBtn = document.getElementById('toggleBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.xpathOptions = document.getElementById('xpathOptions');
        this.selectedXPath = document.getElementById('selectedXPath');
        this.selectedXPathContainer = document.querySelector('.selected-xpath');
        this.elementInfo = document.getElementById('elementInfo');
        this.status = document.getElementById('status');
        this.currentXPathOptions = [];
        this.selectedOption = null;
    }

    bindEvents() {
        // Bind events
        this.toggleBtn.addEventListener('click', () => this.toggleSelection());
        this.clearBtn.addEventListener('click', () => this.clearResults());
        this.copyBtn.addEventListener('click', () => this.copyXPath());
        
        // Add keyboard shortcuts for selected XPath
        this.selectedXPath.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.selectedXPath.select();
            }
        });
        
        // Auto-select text when clicked
        this.selectedXPath.addEventListener('click', () => {
            this.selectedXPath.select();
        });
        
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Popup received message:', message);
            
            if (message.type === 'XPATH_DATA_READY') {
                this.displayXPath(message.data);
                sendResponse({ success: true });
            } else if (message.type === 'SELECTION_DEACTIVATED_BY_KEY') {
                // Update UI when selection is deactivated via ESC key
                this.isActive = false;
                this.toggleBtn.textContent = 'Bật chế độ chọn';
                this.toggleBtn.classList.remove('active');
                this.updateStatus('Chế độ chọn đã tắt (ESC)', '');
                sendResponse({ success: true });
            }
            
            return true;
        });
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTabId = tab.id;
        } catch (error) {
            console.error('Error getting current tab:', error);
            this.updateStatus('Lỗi: Không thể truy cập tab hiện tại', 'error');
        }
    }

    async toggleSelection() {
        if (!this.currentTabId) {
            this.updateStatus('Lỗi: Không thể truy cập tab hiện tại', 'error');
            return;
        }

        try {
            this.isActive = !this.isActive;
            
            if (this.isActive) {
                // Ensure content script is injected
                await this.ensureContentScriptInjected();
                
                // Send message to activate selection mode
                await chrome.tabs.sendMessage(this.currentTabId, {
                    type: 'ACTIVATE_SELECTION'
                });
                
                this.toggleBtn.textContent = 'Tắt chế độ chọn';
                this.toggleBtn.classList.add('active');
                this.updateStatus('Chế độ chọn đã bật - Click vào phần tử để lấy XPath', 'active');
            } else {
                // Deactivate selection mode
                await chrome.tabs.sendMessage(this.currentTabId, {
                    type: 'DEACTIVATE_SELECTION'
                });
                
                this.toggleBtn.textContent = 'Bật chế độ chọn';
                this.toggleBtn.classList.remove('active');
                this.updateStatus('Chế độ chọn đã tắt', '');
            }
        } catch (error) {
            console.error('Error toggling selection:', error);
            this.updateStatus('Lỗi: Không thể kích hoạt chế độ chọn', 'error');
            this.isActive = false;
            this.toggleBtn.textContent = 'Bật chế độ chọn';
            this.toggleBtn.classList.remove('active');
        }
    }

    clearResults() {
        this.selectedXPath.value = '';
        this.selectedXPathContainer.style.display = 'none';
        this.xpathOptions.innerHTML = '<div class="placeholder-message">XPath options sẽ hiển thị ở đây...</div>';
        this.elementInfo.innerHTML = '<span class="placeholder">Chưa chọn phần tử nào</span>';
        this.currentXPathOptions = [];
        this.selectedOption = null;
        this.updateStatus('Đã xóa kết quả', '');
        
        // Clear stored data in background script
        chrome.runtime.sendMessage({
            type: 'CLEAR_STORED_XPATH'
        });
    }

    async copyXPath() {
        if (!this.selectedXPath.value) {
            this.updateStatus('Chưa chọn XPath để copy', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.selectedXPath.value);
            
            // Flash effect for textarea
            this.selectedXPath.style.background = '#e8f5e8';
            this.selectedXPath.style.transition = 'background 0.3s ease';
            
            this.updateStatus('📋 Đã copy XPath vào clipboard', 'active');
            
            // Reset textarea background
            setTimeout(() => {
                this.selectedXPath.style.background = '';
            }, 500);
            
            // Reset status after 2 seconds
            setTimeout(() => {
                if (!this.isActive) {
                    this.updateStatus('Sẵn sàng', '');
                }
            }, 2000);
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            this.updateStatus('Lỗi: Không thể copy', 'error');
        }
    }

    displayXPath(data) {
        // Handle both old format (single xpath) and new format (multiple xpaths)
        if (data.xpathOptions && Array.isArray(data.xpathOptions)) {
            this.currentXPathOptions = data.xpathOptions;
            this.displayXPathOptions(data.xpathOptions);
        } else if (data.xpath) {
            // Fallback for old format
            this.currentXPathOptions = [{
                type: 'Default',
                xpath: data.xpath,
                description: 'XPath mặc định'
            }];
            this.displayXPathOptions(this.currentXPathOptions);
        }
        
        // Display element information
        const info = this.formatElementInfo(data.element);
        this.elementInfo.innerHTML = info;
        
        this.updateStatus('✅ Đã tạo XPath options! Chọn một option từ danh sách', 'active');
        
        // Show instruction after 3 seconds
        setTimeout(() => {
            if (this.isActive) {
                this.updateStatus('💡 Tiếp tục chọn phần tử hoặc nhấn "Tắt chế độ chọn"', 'active');
            }
        }, 3000);
    }
    
    displayXPathOptions(xpathOptions) {
        this.xpathOptions.innerHTML = '';
        
        if (!xpathOptions || xpathOptions.length === 0) {
            this.xpathOptions.innerHTML = '<div class="placeholder-message">Không có XPath options</div>';
            return;
        }
        
        xpathOptions.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'xpath-option';
            optionElement.dataset.index = index;
            
            optionElement.innerHTML = `
                <div class="xpath-option-header">
                    <span class="xpath-option-type">${option.type}</span>
                    <span class="xpath-option-description">${option.description}</span>
                </div>
                <div class="xpath-option-value">${option.xpath}</div>
            `;
            
            optionElement.addEventListener('click', () => this.selectXPathOption(index));
            this.xpathOptions.appendChild(optionElement);
        });
        
        // Auto-select first option
        if (xpathOptions.length > 0) {
            this.selectXPathOption(0);
        }
    }
    
    selectXPathOption(index) {
        if (!this.currentXPathOptions[index]) return;
        
        // Remove previous selection
        this.xpathOptions.querySelectorAll('.xpath-option').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Add selection to clicked option
        const selectedElement = this.xpathOptions.querySelector(`[data-index="${index}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        
        // Update selected XPath
        this.selectedOption = this.currentXPathOptions[index];
        this.selectedXPath.value = this.selectedOption.xpath;
        this.selectedXPathContainer.style.display = 'block';
        
        // Auto-select text in textarea
        setTimeout(() => {
            this.selectedXPath.select();
        }, 100);
    }

    formatElementInfo(element) {
        let info = [];
        
        if (element.tagName) {
            info.push(`<div><strong class="element-tag">Tag:</strong> ${element.tagName.toLowerCase()}</div>`);
        }
        
        if (element.id) {
            info.push(`<div><strong class="element-id">ID:</strong> ${element.id}</div>`);
        }
        
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim()).join(', ');
            info.push(`<div><strong class="element-class">Class:</strong> ${classes}</div>`);
        }
        
        if (element.text && element.text.trim()) {
            const text = element.text.length > 50 ? element.text.substring(0, 50) + '...' : element.text;
            info.push(`<div><strong class="element-text">Text:</strong> ${text}</div>`);
        }
        
        if (element.attributes && element.attributes.length > 0) {
            const attrs = element.attributes.slice(0, 3).map(attr => `${attr.name}="${attr.value}"`).join(', ');
            const moreAttrs = element.attributes.length > 3 ? ` (+${element.attributes.length - 3} more)` : '';
            info.push(`<div><strong>Attributes:</strong> ${attrs}${moreAttrs}</div>`);
        }
        
        return info.length > 0 ? info.join('') : '<span class="placeholder">Không có thông tin</span>';
    }

    async checkStoredXPath() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_STORED_XPATH'
            });
            
            if (response && response.success && response.data) {
                this.displayXPath(response.data);
            }
        } catch (error) {
            console.log('No stored XPath data available');
        }
    }

    async ensureContentScriptInjected() {
        try {
            // Try to ping the content script
            await chrome.tabs.sendMessage(this.currentTabId, { type: 'PING' });
        } catch (error) {
            // Content script not available, inject it
            console.log('Injecting content script...');
            
            try {
                // Inject CSS first
                await chrome.scripting.insertCSS({
                    target: { tabId: this.currentTabId },
                    files: ['content.css']
                });
                
                // Then inject JavaScript
                await chrome.scripting.executeScript({
                    target: { tabId: this.currentTabId },
                    files: ['content.js']
                });
                
                // Wait a bit for script to initialize
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (injectionError) {
                console.error('Failed to inject content script:', injectionError);
                throw new Error('Không thể inject content script');
            }
        }
    }

    updateStatus(message, type = '') {
        this.status.textContent = message;
        this.status.className = 'status';
        if (type) {
            this.status.classList.add(type);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new XPathExtractor();
});
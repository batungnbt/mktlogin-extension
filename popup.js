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
        this.status = document.getElementById('status');
    }

    bindEvents() {
        // Bind events
        this.toggleBtn.addEventListener('click', () => this.toggleSelection());
        this.clearBtn.addEventListener('click', () => this.clearResults());
        
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Popup received message:', message);
            
            if (message.type === 'SELECTION_DEACTIVATED_BY_KEY') {
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
        this.updateStatus('Đã xóa kết quả', '');
        
        // Clear stored data in background script
        chrome.runtime.sendMessage({
            type: 'CLEAR_STORED_XPATH'
        });
    }




    

    




    async checkStoredXPath() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_STORED_XPATH'
            });
            
            if (response && response.success && response.data) {
                console.log('Stored XPath data found:', response.data);
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
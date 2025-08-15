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
        this.status = document.getElementById('status');
        
        // Main feature buttons
        this.xpathBtn = document.getElementById('xpathBtn');
        this.cropBtn = document.getElementById('cropBtn');
    }

    bindEvents() {
        // Main feature button events
        this.xpathBtn.addEventListener('click', () => this.activateXPathMode());
        this.cropBtn.addEventListener('click', () => this.activateCropMode());
        
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Popup received message:', message);
            
            if (message.type === 'SELECTION_DEACTIVATED_BY_KEY') {
                // Update UI when selection is deactivated via ESC key
                this.isActive = false;
                this.xpathBtn.classList.remove('active');
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

    async activateXPathMode() {
        try {
            if (!this.currentTabId) {
                this.updateStatus('Không thể lấy thông tin tab hiện tại', 'error');
                return;
            }

            await this.ensureContentScriptInjected();

            if (this.isActive) {
                // Deactivate selection
                await chrome.tabs.sendMessage(this.currentTabId, { type: 'DEACTIVATE_SELECTION' });
                this.isActive = false;
                this.xpathBtn.classList.remove('active');
                this.cropBtn.classList.remove('active');
                this.updateStatus('Chế độ XPath đã tắt', '');
            } else {
                // Activate XPath selection
                await chrome.tabs.sendMessage(this.currentTabId, { type: 'ACTIVATE_SELECTION' });
                this.isActive = true;
                this.xpathBtn.classList.add('active');
                this.cropBtn.classList.remove('active');
                this.updateStatus('Chế độ XPath đã bật - Click vào phần tử để lấy XPath', 'success');
            }
        } catch (error) {
            console.error('Error activating XPath mode:', error);
            this.updateStatus('Lỗi khi bật chế độ XPath', 'error');
        }
    }

    async activateCropMode() {
        try {
            if (!this.currentTabId) {
                this.updateStatus('Không thể lấy thông tin tab hiện tại', 'error');
                return;
            }

            await this.ensureContentScriptInjected();

            // Deactivate XPath mode if active
            if (this.isActive) {
                await chrome.tabs.sendMessage(this.currentTabId, { type: 'DEACTIVATE_SELECTION' });
                this.isActive = false;
            }

            // Activate crop mode
            await chrome.tabs.sendMessage(this.currentTabId, { type: 'ACTIVATE_CROP_MODE' });
            this.xpathBtn.classList.remove('active');
            this.cropBtn.classList.add('active');
            this.updateStatus('Chế độ Crop đã bật - Kéo để chọn vùng cần crop', 'success');
            
            // Listen for crop completion
            this.listenForCropCompletion();
            
        } catch (error) {
            console.error('Error activating crop mode:', error);
            this.updateStatus('Lỗi khi bật chế độ Crop', 'error');
        }
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

    // Direct Crop Methods
    

    
    listenForCropCompletion() {
        const messageListener = (message, sender, sendResponse) => {
            if (message.type === 'CROP_COMPLETED') {
                this.updateStatus('Crop hoàn thành! Ảnh đã được tải xuống.', 'success');
                this.cropBtn.classList.remove('active');
                
                // Remove this listener
                chrome.runtime.onMessage.removeListener(messageListener);
                sendResponse({ success: true });
            } else if (message.type === 'CROP_CANCELLED') {
                this.updateStatus('Crop đã bị hủy', '');
                this.cropBtn.classList.remove('active');
                
                // Remove this listener
                chrome.runtime.onMessage.removeListener(messageListener);
                sendResponse({ success: true });
            }
            
            return true;
        };
        
        chrome.runtime.onMessage.addListener(messageListener);
    }
    

}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new XPathExtractor();
});
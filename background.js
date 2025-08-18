// Background script for XPath Extractor

// Store XPath data temporarily
let storedXPathData = null;

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    switch (message.type) {
        case 'XPATH_SELECTED':
            // Store the XPath data from content script
            storedXPathData = message.data;
            console.log('Stored XPath data:', storedXPathData);
            
            // XPath options will be displayed directly on the page
            
            // Try to send to popup/side panel if it's open
            chrome.runtime.sendMessage({
                type: 'XPATH_DATA_READY',
                data: storedXPathData
            }).catch(error => {
                console.log('UI not available, data stored for later:', error.message);
            });
            
            sendResponse({ success: true });
            break;
            
        case 'GET_STORED_XPATH':
            // Popup is requesting stored XPath data
            if (storedXPathData) {
                sendResponse({ 
                    success: true, 
                    data: storedXPathData 
                });
                // Clear stored data after sending
                storedXPathData = null;
            } else {
                sendResponse({ 
                    success: false, 
                    message: 'No XPath data available' 
                });
            }
            break;
            
        case 'CLEAR_STORED_XPATH':
            // Clear stored data
            storedXPathData = null;
            sendResponse({ success: true });
            break;
            
        case 'OPEN_POPUP_FROM_ELECTRON':
            // Nhận yêu cầu mở popup từ Electron app thông qua content script
            console.log('Request to open popup from Electron app:', message.data);
            
            // Lưu trữ data từ Electron để popup có thể truy cập
            chrome.storage.local.set({
                electronData: message.data,
                electronTimestamp: Date.now()
            });
            
            // Thông báo cho popup nếu đang mở
            chrome.runtime.sendMessage({
                type: 'ELECTRON_DATA_AVAILABLE',
                data: message.data
            }).catch(error => {
                console.log('Popup not open, data stored for later access');
            });
            
            sendResponse({ success: true });
            break;
            
        case 'PROCESS_CROP_AREA':
            // Handle crop area processing
            handleCropAreaProcessing(message, sender, sendResponse);
            return true; // Keep channel open for async response
            

            
        case 'SELECTION_DEACTIVATED':
            // Notify popup that selection was deactivated via ESC key
            chrome.runtime.sendMessage({
                type: 'SELECTION_DEACTIVATED_BY_KEY'
            }).catch(error => {
                console.log('Popup not available:', error.message);
            });
            
            sendResponse({ success: true });
            break;
    }
    
    return true; // Keep message channel open
});

// Handle crop area processing
async function handleCropAreaProcessing(message, sender, sendResponse) {
    try {
        const { cropArea, windowSize } = message;
        const tabId = sender.tab.id;
        
        console.log('Processing crop area:', cropArea);
        
        // Capture the visible tab
        const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {
            format: 'png'
        });
        
        // Send the captured image back to content script for processing
        chrome.tabs.sendMessage(tabId, {
            type: 'PROCESS_CAPTURED_IMAGE',
            dataUrl: dataUrl,
            cropArea: cropArea,
            windowSize: windowSize
        });
        
        // Send success response
        sendResponse({ success: true });
        
    } catch (error) {
        console.error('Error processing crop area:', error);
        sendResponse({ success: false, error: error.message });
        
        // Notify popup about error
        chrome.runtime.sendMessage({
            type: 'CROP_AREA_PROCESSED',
            success: false,
            error: error.message
        }).catch(err => {
            console.log('Popup not available:', err.message);
        });
    }
}

// Extension icon click will open popup (default behavior)

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('XPath Extractor installed/updated:', details.reason);
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('XPath Extractor started');
    storedXPathData = null; // Clear any stored data on startup
});
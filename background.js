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
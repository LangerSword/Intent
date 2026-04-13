/**
 * Intent - Background Script
 * Handles tab updates and triggers intent overlay
 */

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_TAB') {
    getCurrentTab().then(sendResponse);
    return true;
  }
  
  if (message.type === 'GET_SETTINGS') {
    browser.storage.local.get('intent_settings').then(sendResponse);
    return true;
  }
  
  if (message.type === 'CHECK_BOOKMARK') {
    window.IntentStorage.getBookmarkByUrl(message.url).then(bookmark => {
      sendResponse(bookmark);
    });
    return true;
  }
  
  if (message.type === 'BOOKMARK_SAVED') {
    if (message.bookmark && message.tabId) {
      browser.tabs.sendMessage(message.tabId, {
        type: 'BOOKMARK_UPDATED',
        bookmark: message.bookmark,
      }).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }
});

// Handle tab updates
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  
  // Skip internal pages
  const forbidden = ['chrome:', 'chrome-extension:', 'about:', 'moz-extension:', 'view-source:', 'browser:'];
  if (forbidden.some(proto => tab.url.startsWith(proto))) return;
  
  try {
    const bookmark = await window.IntentStorage.getBookmarkByUrl(tab.url);
    if (bookmark) {
      await window.IntentStorage.recordVisit(tab.url);
      
      // Send to content script
      browser.tabs.sendMessage(tabId, {
        type: 'SHOW_INTENT_OVERLAY',
        bookmark: bookmark,
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Intent: Error in tab update', error);
  }
});

// Get current tab info
async function getCurrentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  
  if (!tab) return null;
  
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    favicon: tab.favIconUrl || '',
  };
}
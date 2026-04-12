/**
 * Intent - Background Service Worker
 * Technical Note: Using ES Modules requires correct path resolution in Firefox
 */

import './lib/browser-polyfill.js';
import { getBookmarkByUrl, recordVisit, getSettings } from './lib/storage.js'; // Ensure path is relative to background.js

// This must be at the top level, not inside an async block
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_CURRENT_TAB') {
        // We use a promise here because sendResponse is synchronous in some contexts
        getCurrentTab().then(sendResponse);
        return true; // ESSENTIAL: Tells Firefox to keep the message channel open
    }
});

// Helper to ensure content script is ready
async function sendMessageWithRetry(tabId, message, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await browser.tabs.sendMessage(tabId, message);
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))); // Exponential backoff
        }
    }
}

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    // Filter out internal pages - expanded for Firefox
    const forbiddenProtocols = ['chrome:', 'chrome-extension:', 'about:', 'moz-extension:', 'view-source:', 'browser:'];
    if (forbiddenProtocols.some(proto => tab.url.startsWith(proto))) return;

    try {
        const bookmark = await getBookmarkByUrl(tab.url);
        if (bookmark) {
            await recordVisit(tab.url);
            // Use the retry helper to avoid "Receiver does not exist"
            await sendMessageWithRetry(tabId, {
                type: 'SHOW_INTENT_OVERLAY',
                bookmark: bookmark,
            });
        }
    } catch (error) {
        console.error('Intent: Error in tab update logic', error);
    }
});


async function handleMessage(message, sender) {
    try {
        switch (message.type) {
            case 'GET_CURRENT_TAB':
                return await getCurrentTab();
            case 'CHECK_BOOKMARK':
                return await getBookmarkByUrl(message.url);
            case 'GET_SETTINGS':
                return await getSettings();
            case 'BOOKMARK_SAVED':
                if (message.bookmark && message.tabId) {
                    browser.tabs.sendMessage(message.tabId, {
                        type: 'BOOKMARK_UPDATED',
                        bookmark: message.bookmark,
                    }).catch(() => { });
                }
                return { success: true };
            default:
                return { error: 'Unknown message type' };
        }
    } catch (err) {
        return { error: err.message };
    }
}

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

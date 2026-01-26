/**
 * Intent - Background Service Worker
 * Handles bookmark operations and coordinates between popup and content scripts
 */

import { getBookmarkByUrl, recordVisit, getSettings } from '../lib/storage.js';

// Listen for tab updates to check for saved bookmarks
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only check when navigation is complete
    if (changeInfo.status !== 'complete' || !tab.url) return;

    // Skip chrome:// and extension pages
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
        return;
    }

    try {
        const bookmark = await getBookmarkByUrl(tab.url);

        if (bookmark) {
            // Record the visit
            await recordVisit(tab.url);

            // Send message to content script to show overlay
            chrome.tabs.sendMessage(tabId, {
                type: 'SHOW_INTENT_OVERLAY',
                bookmark: bookmark,
            }).catch(() => {
                // Content script might not be ready yet, that's okay
            });
        }
    } catch (error) {
        console.error('Intent: Error checking bookmark', error);
    }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Keep channel open for async response
});

/**
 * Handle incoming messages
 */
async function handleMessage(message, sender) {
    switch (message.type) {
        case 'GET_CURRENT_TAB':
            return getCurrentTab();

        case 'CHECK_BOOKMARK':
            return getBookmarkByUrl(message.url);

        case 'GET_SETTINGS':
            return getSettings();

        case 'BOOKMARK_SAVED':
            // Notify content script if on the same page
            if (message.bookmark && message.tabId) {
                chrome.tabs.sendMessage(message.tabId, {
                    type: 'BOOKMARK_UPDATED',
                    bookmark: message.bookmark,
                }).catch(() => { });
            }
            return { success: true };

        default:
            return { error: 'Unknown message type' };
    }
}

/**
 * Get the current active tab
 */
async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
        return null;
    }

    return {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl || '',
    };
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Intent: Extension installed successfully! 🎯');

        // Could open a welcome page here
        // chrome.tabs.create({ url: 'welcome.html' });
    } else if (details.reason === 'update') {
        console.log(`Intent: Updated to version ${chrome.runtime.getManifest().version}`);
    }
});

// Keep service worker alive during development
// Remove in production for battery efficiency
self.addEventListener('activate', () => {
    console.log('Intent: Service worker activated');
});

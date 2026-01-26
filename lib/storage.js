/**
 * Intent - Local Storage Manager
 * Handles bookmark storage using Chrome Storage API
 */

const STORAGE_KEY = 'intent_bookmarks';
const SETTINGS_KEY = 'intent_settings';

/**
 * Default settings
 */
const DEFAULT_SETTINGS = {
  overlayDuration: 5000, // ms before auto-dismiss
  overlayPosition: 'bottom-right', // bottom-right, bottom-left, top-right, top-left
  darkMode: true,
  syncEnabled: false,
  minIntentTime: 3000, // 3 second reflection time
};

/**
 * Generate a unique ID for bookmarks
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all bookmarks from local storage
 * @returns {Promise<Array>} Array of bookmark objects
 */
export async function getBookmarks() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  } catch (error) {
    console.error('Intent: Error getting bookmarks', error);
    return [];
  }
}

/**
 * Save a new bookmark
 * @param {Object} bookmark - Bookmark object with url, title, intent
 * @returns {Promise<Object>} The saved bookmark with generated ID
 */
export async function saveBookmark(bookmark) {
  const bookmarks = await getBookmarks();
  
  // Check if URL already exists
  const existingIndex = bookmarks.findIndex(b => b.url === bookmark.url);
  
  const newBookmark = {
    id: existingIndex >= 0 ? bookmarks[existingIndex].id : generateId(),
    url: bookmark.url,
    title: bookmark.title || 'Untitled',
    intent: bookmark.intent,
    favicon: bookmark.favicon || '',
    createdAt: existingIndex >= 0 ? bookmarks[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    visitedCount: existingIndex >= 0 ? bookmarks[existingIndex].visitedCount : 0,
    lastVisitedAt: null,
    tags: bookmark.tags || [],
    isArchived: false,
    synced: false,
  };

  if (existingIndex >= 0) {
    // Update existing bookmark
    bookmarks[existingIndex] = newBookmark;
  } else {
    // Add new bookmark at the beginning
    bookmarks.unshift(newBookmark);
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: bookmarks });
  return newBookmark;
}

/**
 * Get a bookmark by URL
 * @param {string} url - The URL to search for
 * @returns {Promise<Object|null>} The bookmark or null if not found
 */
export async function getBookmarkByUrl(url) {
  const bookmarks = await getBookmarks();
  // Normalize URLs for comparison
  const normalizedUrl = normalizeUrl(url);
  return bookmarks.find(b => normalizeUrl(b.url) === normalizedUrl) || null;
}

/**
 * Normalize URL for consistent comparison
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    // Remove trailing slash and fragment
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * Update bookmark visit count
 * @param {string} url - The URL that was visited
 */
export async function recordVisit(url) {
  const bookmarks = await getBookmarks();
  const index = bookmarks.findIndex(b => normalizeUrl(b.url) === normalizeUrl(url));
  
  if (index >= 0) {
    bookmarks[index].visitedCount += 1;
    bookmarks[index].lastVisitedAt = new Date().toISOString();
    await chrome.storage.local.set({ [STORAGE_KEY]: bookmarks });
  }
}

/**
 * Delete a bookmark by ID
 * @param {string} id - Bookmark ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteBookmark(id) {
  const bookmarks = await getBookmarks();
  const filtered = bookmarks.filter(b => b.id !== id);
  
  if (filtered.length !== bookmarks.length) {
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
    return true;
  }
  return false;
}

/**
 * Archive a bookmark (soft delete)
 * @param {string} id - Bookmark ID to archive
 */
export async function archiveBookmark(id) {
  const bookmarks = await getBookmarks();
  const index = bookmarks.findIndex(b => b.id === id);
  
  if (index >= 0) {
    bookmarks[index].isArchived = true;
    bookmarks[index].updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [STORAGE_KEY]: bookmarks });
  }
}

/**
 * Get settings
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
  } catch (error) {
    console.error('Intent: Error getting settings', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update settings
 * @param {Object} newSettings - Partial settings to update
 */
export async function updateSettings(newSettings) {
  const currentSettings = await getSettings();
  const updated = { ...currentSettings, ...newSettings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
}

/**
 * Search bookmarks by query
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching bookmarks
 */
export async function searchBookmarks(query) {
  const bookmarks = await getBookmarks();
  const lowerQuery = query.toLowerCase();
  
  return bookmarks.filter(b => 
    !b.isArchived && (
      b.title.toLowerCase().includes(lowerQuery) ||
      b.intent.toLowerCase().includes(lowerQuery) ||
      b.url.toLowerCase().includes(lowerQuery) ||
      b.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  );
}

/**
 * Export all bookmarks as JSON
 * @returns {Promise<string>} JSON string of all bookmarks
 */
export async function exportBookmarks() {
  const bookmarks = await getBookmarks();
  const settings = await getSettings();
  
  return JSON.stringify({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    bookmarks,
    settings,
  }, null, 2);
}

/**
 * Import bookmarks from JSON
 * @param {string} jsonString - JSON string to import
 * @param {boolean} merge - If true, merge with existing; if false, replace
 */
export async function importBookmarks(jsonString, merge = true) {
  try {
    const data = JSON.parse(jsonString);
    
    if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
      throw new Error('Invalid import format');
    }

    if (merge) {
      const existing = await getBookmarks();
      const existingUrls = new Set(existing.map(b => normalizeUrl(b.url)));
      
      const newBookmarks = data.bookmarks.filter(
        b => !existingUrls.has(normalizeUrl(b.url))
      );
      
      await chrome.storage.local.set({
        [STORAGE_KEY]: [...newBookmarks, ...existing],
      });
    } else {
      await chrome.storage.local.set({ [STORAGE_KEY]: data.bookmarks });
    }

    return true;
  } catch (error) {
    console.error('Intent: Import failed', error);
    return false;
  }
}

/**
 * Get bookmark statistics
 * @returns {Promise<Object>} Statistics object
 */
export async function getStats() {
  const bookmarks = await getBookmarks();
  const active = bookmarks.filter(b => !b.isArchived);
  
  return {
    total: active.length,
    archived: bookmarks.length - active.length,
    totalVisits: active.reduce((sum, b) => sum + b.visitedCount, 0),
    mostVisited: active.sort((a, b) => b.visitedCount - a.visitedCount).slice(0, 5),
    recentlyAdded: active.slice(0, 5),
  };
}

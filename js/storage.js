/**
 * Intent - Storage Module
 * Simple local storage for bookmarks (no login required)
 */

const STORAGE_KEY = 'intent_bookmarks';
const SETTINGS_KEY = 'intent_settings';

const DEFAULT_SETTINGS = {
  overlayDuration: 5000,
  overlayPosition: 'bottom-right',
  darkMode: true,
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
  } catch {
    return url;
  }
}

// Get all bookmarks
async function getBookmarks() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  } catch (error) {
    console.error('Intent: Error getting bookmarks', error);
    return [];
  }
}

// Save a bookmark
async function saveBookmark(data) {
  const bookmarks = await getBookmarks();
  const existingIndex = bookmarks.findIndex(b => normalizeUrl(b.url) === normalizeUrl(data.url));
  
  const bookmark = {
    id: existingIndex >= 0 ? bookmarks[existingIndex].id : generateId(),
    url: data.url,
    title: data.title || 'Untitled',
    intent: data.intent,
    favicon: data.favicon || '',
    createdAt: existingIndex >= 0 ? bookmarks[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    visitedCount: existingIndex >= 0 ? bookmarks[existingIndex].visitedCount : 0,
    lastVisitedAt: null,
    tags: data.tags || [],
    isArchived: false,
  };

  if (existingIndex >= 0) {
    bookmarks[existingIndex] = bookmark;
  } else {
    bookmarks.unshift(bookmark);
  }

  await browser.storage.local.set({ [STORAGE_KEY]: bookmarks });
  return bookmark;
}

// Get bookmark by URL
async function getBookmarkByUrl(url) {
  const bookmarks = await getBookmarks();
  return bookmarks.find(b => normalizeUrl(b.url) === normalizeUrl(url)) || null;
}

// Delete bookmark
async function deleteBookmark(id) {
  const bookmarks = await getBookmarks();
  const filtered = bookmarks.filter(b => b.id !== id);
  
  if (filtered.length !== bookmarks.length) {
    await browser.storage.local.set({ [STORAGE_KEY]: filtered });
    return true;
  }
  return false;
}

// Record a visit
async function recordVisit(url) {
  const bookmarks = await getBookmarks();
  const index = bookmarks.findIndex(b => normalizeUrl(b.url) === normalizeUrl(url));
  
  if (index >= 0) {
    bookmarks[index].visitedCount += 1;
    bookmarks[index].lastVisitedAt = new Date().toISOString();
    await browser.storage.local.set({ [STORAGE_KEY]: bookmarks });
  }
}

// Search bookmarks
async function searchBookmarks(query) {
  const bookmarks = await getBookmarks();
  const lowerQuery = query.toLowerCase();
  
  return bookmarks.filter(b => 
    !b.isArchived && (
      b.title.toLowerCase().includes(lowerQuery) ||
      b.intent.toLowerCase().includes(lowerQuery) ||
      b.url.toLowerCase().includes(lowerQuery)
    )
  );
}

// Get settings
async function getSettings() {
  try {
    const result = await browser.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
  } catch (error) {
    console.error('Intent: Error getting settings', error);
    return DEFAULT_SETTINGS;
  }
}

// Update settings
async function updateSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await browser.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
}

// Export bookmarks
async function exportBookmarks() {
  const bookmarks = await getBookmarks();
  const settings = await getSettings();
  
  return JSON.stringify({
    version: '2.0',
    exportedAt: new Date().toISOString(),
    bookmarks,
    settings,
  }, null, 2);
}

// Import bookmarks
async function importBookmarks(jsonString, merge = true) {
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
      
      await browser.storage.local.set({
        [STORAGE_KEY]: [...newBookmarks, ...existing],
      });
    } else {
      await browser.storage.local.set({ [STORAGE_KEY]: data.bookmarks });
    }

    return true;
  } catch (error) {
    console.error('Intent: Import failed', error);
    return false;
  }
}

// Sync module (optional GitHub sync)
const Sync = {
  token: null,
  gistId: null,
  
  isConfigured() {
    return this.token !== null;
  },
  
  setToken(token) {
    this.token = token;
  },
  
  async request(endpoint, options = {}) {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || `HTTP ${response.status}`);
      throw error;
    }

    return data;
  },
  
  async findGist() {
    const gists = await this.request('/gists');
    for (const gist of gists) {
      if (gist.files && gist.files['intent-bookmarks.json']) {
        return gist;
      }
    }
    return null;
  },
  
  async pushBookmarks(bookmarks) {
    const content = {
      version: '2.0',
      updatedAt: new Date().toISOString(),
      bookmarks: bookmarks,
    };
    
    const existingGist = await this.findGist();
    
    if (existingGist) {
      await this.request(`/gists/${existingGist.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          files: {
            'intent-bookmarks.json': {
              content: JSON.stringify(content, null, 2),
            },
          },
        }),
      });
    } else {
      const newGist = await this.request('/gists', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Intent Bookmarks Backup',
          public: false,
          files: {
            'intent-bookmarks.json': {
              content: JSON.stringify(content, null, 2),
            },
          },
        }),
      });
      this.gistId = newGist.id;
    }
    
    return { synced: bookmarks.length };
  },
  
  async pullBookmarks() {
    const existingGist = await this.findGist();
    
    if (!existingGist || !existingGist.files || !existingGist.files['intent-bookmarks.json']) {
      return [];
    }
    
    const content = JSON.parse(existingGist.files['intent-bookmarks.json'].content);
    return content.bookmarks || [];
  },
  
  async sync(localBookmarks) {
    const cloudBookmarks = await this.pullBookmarks();
    
    if (cloudBookmarks.length === 0) {
      await this.pushBookmarks(localBookmarks);
      return localBookmarks;
    }
    
    // Simple merge: combine and dedupe by URL
    const localMap = new Map(localBookmarks.map(b => [normalizeUrl(b.url), b]));
    const cloudMap = new Map(cloudBookmarks.map(b => [normalizeUrl(b.url), b]));
    
    const merged = [];
    const allUrls = new Set([...localMap.keys(), ...cloudMap.keys()]);
    
    for (const url of allUrls) {
      const local = localMap.get(url);
      const cloud = cloudMap.get(url);
      
      if (local && cloud) {
        // Keep the more recently updated
        const localTime = new Date(local.updatedAt).getTime();
        const cloudTime = new Date(cloud.updatedAt).getTime();
        merged.push(localTime >= cloudTime ? local : cloud);
      } else if (local) {
        merged.push(local);
      } else if (cloud) {
        merged.push(cloud);
      }
    }
    
    await this.pushBookmarks(merged);
    return merged;
  }
};

// Export for use in other scripts
window.IntentStorage = {
  getBookmarks,
  saveBookmark,
  getBookmarkByUrl,
  deleteBookmark,
  recordVisit,
  searchBookmarks,
  getSettings,
  updateSettings,
  exportBookmarks,
  importBookmarks,
  Sync
};
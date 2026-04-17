/**
 * Intent - Popup Script
 * Simple, working bookmark saving with optional cloud sync
 */

const MIN_INTENT_TIME = 3000;

const INTENT_PLACEHOLDERS = [
  'Research for project X...',
  'Read later for inspiration...',
  'Reference for upcoming task...',
  'Tutorial to learn from...',
  'Share with team later...',
  'Compare with alternatives...',
];

let currentTab = null;
let existingBookmark = null;
let timerStartTime = null;
let timerInterval = null;
let settings = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Load settings
  settings = await window.IntentStorage.getSettings();
  applySettings();

  // Set up event listeners
  setupEventListeners();

  // Get current tab info
  await loadCurrentTab();

  // Load bookmarks
  await loadBookmarks();

  // Check sync status
  checkSyncStatus();

  // Set random placeholder
  setRandomPlaceholder();
}

// Event Listeners
function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Intent input
  document.getElementById('intentInput').addEventListener('input', handleIntentInput);
  document.getElementById('intentInput').addEventListener('focus', startTimer);

  // Save button
  document.getElementById('saveBtn').addEventListener('click', handleSave);

  // Update button
  document.getElementById('updateBtn').addEventListener('click', handleUpdate);

  // Search
  document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => openModal('settings'));
  document.querySelector('[data-close="settings"]').addEventListener('click', () => closeModal('settings'));
  document.getElementById('overlayDuration').addEventListener('change', handleSettingChange);
  document.getElementById('overlayPosition').addEventListener('change', handleSettingChange);
  document.getElementById('darkModeToggle').addEventListener('change', handleSettingChange);
  
  // Theme toggle
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);

  // Export/Import
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('importInput').addEventListener('change', handleImport);

  // Sync
  document.getElementById('syncBtn').addEventListener('click', () => openModal('sync'));
  document.querySelector('[data-close="sync"]').addEventListener('click', () => closeModal('sync'));
  document.getElementById('connectSyncBtn').addEventListener('click', () => openModal('sync'));
  document.getElementById('connectBtn').addEventListener('click', handleConnect);
  document.getElementById('syncNowBtn').addEventListener('click', handleSyncNow);
  document.getElementById('disconnectBtn').addEventListener('click', handleDisconnect);
  document.getElementById('tokenHelp').addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: 'https://github.com/settings/tokens' });
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('settings');
      closeModal('sync');
    }
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('visible');
      }
    });
  });
}

// Tab Switching
function switchTab(tabId) {
  document.querySelector('.tabs-container').dataset.active = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabId}Tab`);
  });
}

// Load Current Tab
async function loadCurrentTab() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_TAB' });
    
    if (!response || !response.url) {
      document.getElementById('pageTitle').textContent = 'Unsupported page';
      document.getElementById('pageUrl').textContent = 'Cannot save this page';
      return;
    }

    currentTab = response;

    // Update UI
    document.getElementById('pageFavicon').src = currentTab.favicon || getDefaultFavicon(currentTab.url);
    document.getElementById('pageTitle').textContent = currentTab.title || 'Untitled';
    document.getElementById('pageUrl').textContent = new URL(currentTab.url).hostname;

    // Check if already saved
    existingBookmark = await window.IntentStorage.getBookmarkByUrl(currentTab.url);
    if (existingBookmark) {
      showSavedState();
    } else {
      showSaveForm();
    }
  } catch (error) {
    console.error('Intent: Error loading tab', error);
    document.getElementById('pageTitle').textContent = 'Error';
    document.getElementById('pageUrl').textContent = error.message;
  }
}

function showSaveForm() {
  document.getElementById('saveSection').querySelector('.intent-input-wrapper').classList.remove('hidden');
  document.getElementById('saveBtn').classList.remove('hidden');
  document.getElementById('savedState').classList.add('hidden');
}

function showSavedState() {
  document.getElementById('saveSection').querySelector('.intent-input-wrapper').classList.add('hidden');
  document.getElementById('saveBtn').classList.add('hidden');
  document.getElementById('savedState').classList.remove('hidden');

  document.getElementById('savedIntent').textContent = `"${existingBookmark.intent}"`;
  document.getElementById('savedDate').textContent = formatRelativeTime(existingBookmark.createdAt);
  document.getElementById('visitCount').textContent = `${existingBookmark.visitedCount} visit${existingBookmark.visitedCount !== 1 ? 's' : ''}`;
}

function getDefaultFavicon(url) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return '';
  }
}

function setRandomPlaceholder() {
  const placeholder = INTENT_PLACEHOLDERS[Math.floor(Math.random() * INTENT_PLACEHOLDERS.length)];
  document.getElementById('intentInput').placeholder = placeholder;
}

// Timer
function startTimer() {
  if (timerStartTime || existingBookmark) return;

  timerStartTime = Date.now();
  document.getElementById('timerSection').classList.remove('hidden');

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - timerStartTime;
    const progress = Math.min((elapsed / MIN_INTENT_TIME) * 100, 100);

    document.getElementById('timerProgress').style.width = `${progress}%`;

    if (elapsed >= MIN_INTENT_TIME) {
      clearInterval(timerInterval);
      document.querySelector('.timer-text').textContent = 'Ready to save!';
      updateSaveButtonState();
    }
  }, 100);
}

function handleIntentInput(e) {
  const value = e.target.value;
  document.getElementById('charCount').textContent = `${value.length}/500`;
  updateSaveButtonState();
}

function updateSaveButtonState() {
  const hasIntent = document.getElementById('intentInput').value.trim().length > 0;
  const timerComplete = timerStartTime && (Date.now() - timerStartTime >= MIN_INTENT_TIME);
  const isUpdate = existingBookmark !== null;

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = !hasIntent || (!timerComplete && !isUpdate);
}

// Save
async function handleSave() {
  if (!currentTab) return;

  const intent = document.getElementById('intentInput').value.trim();
  if (!intent) return;

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const bookmark = await window.IntentStorage.saveBookmark({
      url: currentTab.url,
      title: currentTab.title,
      intent: intent,
      favicon: currentTab.favicon,
    });

    existingBookmark = bookmark;

    // Notify background
    browser.runtime.sendMessage({
      type: 'BOOKMARK_SAVED',
      bookmark: bookmark,
      tabId: currentTab.id,
    });

    showSavedState();
    await loadBookmarks();
  } catch (error) {
    console.error('Intent: Error saving', error);
    saveBtn.textContent = 'Error! Try again';
    saveBtn.disabled = false;
  }
}

function handleUpdate() {
  const oldIntent = existingBookmark?.intent || '';

  existingBookmark = null;
  timerStartTime = Date.now() - MIN_INTENT_TIME;

  document.getElementById('savedState').classList.add('hidden');
  document.querySelector('.intent-input-wrapper').classList.remove('hidden');
  document.getElementById('saveBtn').classList.remove('hidden');
  document.getElementById('saveBtn').textContent = 'Update Intent';

  document.getElementById('intentInput').value = oldIntent;
  handleIntentInput({ target: document.getElementById('intentInput') });

  document.getElementById('intentInput').focus();
  updateSaveButtonState();
}

// Bookmarks List
async function loadBookmarks(query = '') {
  try {
    let bookmarks;

    if (query) {
      bookmarks = await window.IntentStorage.searchBookmarks(query);
    } else {
      bookmarks = await window.IntentStorage.getBookmarks();
      bookmarks = bookmarks.filter(b => !b.isArchived);
    }

    renderBookmarks(bookmarks);
  } catch (error) {
    console.error('Intent: Error loading bookmarks', error);
  }
}

function renderBookmarks(bookmarks) {
  document.getElementById('bookmarkCount').textContent = bookmarks.length;

  const listEl = document.getElementById('bookmarksList');
  const emptyEl = document.getElementById('emptyState');

  if (bookmarks.length === 0) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }

  listEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  listEl.innerHTML = bookmarks.map(bookmark => `
    <div class="bookmark-item" data-url="${encodeURIComponent(bookmark.url)}">
      <img class="bookmark-favicon" src="${bookmark.favicon || getDefaultFavicon(bookmark.url)}" alt="">
      <div class="bookmark-content">
        <span class="bookmark-title">${escapeHtml(bookmark.title)}</span>
        <span class="bookmark-intent">${escapeHtml(bookmark.intent)}</span>
        <span class="bookmark-meta">${formatRelativeTime(bookmark.createdAt)}</span>
      </div>
      <button class="delete-btn" data-id="${bookmark.id}" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `).join('');

  // Click handlers
  listEl.querySelectorAll('.bookmark-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) return;
      const url = decodeURIComponent(item.dataset.url);
      browser.tabs.create({ url });
    });
  });

  listEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (await window.IntentStorage.deleteBookmark(id)) {
        loadBookmarks(document.getElementById('searchInput').value);
      }
    });
  });
}

async function handleSearch(e) {
  await loadBookmarks(e.target.value.trim());
}

// Settings
function applySettings() {
  if (!settings) return;

  document.getElementById('overlayDuration').value = settings.overlayDuration;
  document.getElementById('overlayPosition').value = settings.overlayPosition;
  document.getElementById('darkModeToggle').checked = settings.darkMode;
  
  // Apply theme - darkMode: true = dark, false = light
  if (settings.darkMode === false) {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function toggleTheme() {
  const isLight = document.documentElement.hasAttribute('data-theme');
  
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('darkModeToggle').checked = true;
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('darkModeToggle').checked = false;
  }
  
  handleSettingChange();
}

async function handleSettingChange() {
  // Use the checkbox value directly since we sync it in toggleTheme
  const isDark = document.getElementById('darkModeToggle').checked;
  const newSettings = {
    overlayDuration: parseInt(document.getElementById('overlayDuration').value),
    overlayPosition: document.getElementById('overlayPosition').value,
    darkMode: isDark,
  };

  await window.IntentStorage.updateSettings(newSettings);
  settings = newSettings;
}

async function handleExport() {
  try {
    const json = await window.IntentStorage.exportBookmarks();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `intent-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Intent: Export failed', error);
  }
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const success = await window.IntentStorage.importBookmarks(text, true);

    if (success) {
      await loadBookmarks();
      closeModal('settings');
    } else {
      alert('Import failed. Check file format.');
    }
  } catch (error) {
    console.error('Intent: Import failed', error);
    alert('Import failed. Check file format.');
  }

  e.target.value = '';
}

// Sync
function checkSyncStatus() {
  const syncStatus = document.getElementById('syncStatus');
  const connectBtn = document.getElementById('connectSyncBtn');

  const stored = window.localStorage.getItem('intent_sync_token');
  
  if (stored) {
    window.IntentStorage.Sync.setToken(stored);
    syncStatus.className = 'sync-status connected';
    syncStatus.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>Cloud sync connected</span>
    `;
    connectBtn.textContent = 'Manage Sync';
  } else {
    syncStatus.className = 'sync-status disconnected';
    syncStatus.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      <span>Cloud sync not connected</span>
    `;
    connectBtn.textContent = 'Connect Cloud Sync';
  }
}

async function handleConnect() {
  const token = document.getElementById('githubToken').value.trim();
  
  if (!token) {
    alert('Please enter your GitHub token');
    return;
  }

  // Test the token
  window.IntentStorage.Sync.setToken(token);
  
  try {
    await window.IntentStorage.Sync.request('/user');
    
    // Save token
    window.localStorage.setItem('intent_sync_token', token);
    
    // Update UI
    document.getElementById('syncFormView').classList.add('hidden');
    document.getElementById('syncConnectedView').classList.remove('hidden');
    checkSyncStatus();
    closeModal('settings');
    
    // Initial sync
    await handleSyncNow();
  } catch (error) {
    alert('Invalid token. Please check and try again.');
    window.IntentStorage.Sync.setToken(null);
  }
}

async function handleSyncNow() {
  const syncNowBtn = document.getElementById('syncNowBtn');
  syncNowBtn.disabled = true;
  syncNowBtn.textContent = 'Syncing...';

  try {
    const localBookmarks = await window.IntentStorage.getBookmarks();
    const merged = await window.IntentStorage.Sync.sync(localBookmarks);
    
    await browser.storage.local.set({ intent_bookmarks: merged });
    
    await loadBookmarks();
    
    syncNowBtn.textContent = 'Synced!';
    setTimeout(() => {
      syncNowBtn.textContent = 'Sync Now';
      syncNowBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Intent: Sync failed', error);
    syncNowBtn.textContent = 'Sync failed';
    syncNowBtn.disabled = false;
  }
}

function handleDisconnect() {
  window.localStorage.removeItem('intent_sync_token');
  window.IntentStorage.Sync.setToken(null);
  
  document.getElementById('syncFormView').classList.remove('hidden');
  document.getElementById('syncConnectedView').classList.add('hidden');
  document.getElementById('githubToken').value = '';
  
  checkSyncStatus();
}

// Modals
function openModal(name) {
  const modal = document.getElementById(`${name}Modal`);
  if (modal) {
    modal.classList.add('visible');
    
    // Update sync modal based on connection state
    if (name === 'sync') {
      const stored = window.localStorage.getItem('intent_sync_token');
      if (stored) {
        document.getElementById('syncFormView').classList.add('hidden');
        document.getElementById('syncConnectedView').classList.remove('hidden');
      } else {
        document.getElementById('syncFormView').classList.remove('hidden');
        document.getElementById('syncConnectedView').classList.add('hidden');
      }
    }
  }
}

function closeModal(name) {
  const modal = document.getElementById(`${name}Modal`);
  if (modal) {
    modal.classList.remove('visible');
  }
}

// Utilities
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
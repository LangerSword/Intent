/**
 * Intent - Popup Script
 * Main UI logic for saving bookmarks with intent
 */

import {
    getBookmarks,
    saveBookmark,
    deleteBookmark,
    getBookmarkByUrl,
    searchBookmarks,
    getSettings,
    updateSettings,
    exportBookmarks,
    importBookmarks
} from '../lib/storage.js';

import { getSupabase, isConfigured } from '../lib/supabase.js';

// DOM Elements
const elements = {
    // Current page
    currentPage: document.getElementById('currentPage'),
    pageFavicon: document.getElementById('pageFavicon'),
    pageTitle: document.getElementById('pageTitle'),
    pageUrl: document.getElementById('pageUrl'),

    // Save section
    saveSection: document.getElementById('saveSection'),
    intentInput: document.getElementById('intentInput'),
    charCount: document.getElementById('charCount'),
    timerSection: document.getElementById('timerSection'),
    timerProgress: document.getElementById('timerProgress'),
    saveBtn: document.getElementById('saveBtn'),

    // Saved state
    savedState: document.getElementById('savedState'),
    savedIntent: document.getElementById('savedIntent'),
    savedDate: document.getElementById('savedDate'),
    visitCount: document.getElementById('visitCount'),
    updateBtn: document.getElementById('updateBtn'),

    // Bookmarks
    searchInput: document.getElementById('searchInput'),
    bookmarksList: document.getElementById('bookmarksList'),
    bookmarkCount: document.getElementById('bookmarkCount'),
    emptyState: document.getElementById('emptyState'),

    // Header buttons
    settingsBtn: document.getElementById('settingsBtn'),
    syncBtn: document.getElementById('syncBtn'),

    // Settings modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    overlayDuration: document.getElementById('overlayDuration'),
    overlayPosition: document.getElementById('overlayPosition'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    exportBtn: document.getElementById('exportBtn'),
    importInput: document.getElementById('importInput'),

    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Auth modal
    authModal: document.getElementById('authModal'),
    closeAuthBtn: document.getElementById('closeAuthBtn'),
    authModalTitle: document.getElementById('authModalTitle'),
    authStatus: document.getElementById('authStatus'),
    authUserEmail: document.getElementById('authUserEmail'),
    syncNowBtn: document.getElementById('syncNowBtn'),
    signOutBtn: document.getElementById('signOutBtn'),
    authForm: document.getElementById('authForm'),
    authError: document.getElementById('authError'),
    authEmail: document.getElementById('authEmail'),
    authPassword: document.getElementById('authPassword'),
    authSubmitBtn: document.getElementById('authSubmitBtn'),
    authToggleText: document.getElementById('authToggleText'),
    authToggleBtn: document.getElementById('authToggleBtn'),
    forgotPasswordBtn: document.getElementById('forgotPasswordBtn'),

    // Onboarding
    onboardingModal: document.getElementById('onboardingModal'),
    onboardingSlides: document.querySelectorAll('.onboarding-slide'),
    onboardingFinish: document.getElementById('onboardingFinish'),
    onboardingNext1: document.getElementById('onboardingNext1'),
    onboardingNext2: document.getElementById('onboardingNext2'),
    onboardingSkip1: document.getElementById('onboardingSkip1'),
    onboardingSkip2: document.getElementById('onboardingSkip2'),
    onboardingSkip3: document.getElementById('onboardingSkip3'),
};

// State
let currentTab = null;
let existingBookmark = null;
let timerInterval = null;
let timerStartTime = null;
let settings = null;
let isSignUpMode = false;
let currentUser = null;

const MIN_INTENT_TIME = 3000; // 3 seconds
const INTENT_PLACEHOLDERS = [
    'Research for project X...',
    'Read later for inspiration...',
    'Reference for upcoming task...',
    'Tutorial to learn from...',
    'Share with team later...',
    'Compare with alternatives...',
    'Bookmark for portfolio ideas...',
    'Revisit when working on...',
];

// ========================================
// INITIALIZATION
// ========================================

async function init() {
    // Load settings
    settings = await getSettings();
    applySettings();

    // Set up event listeners FIRST (so onboarding works)
    setupEventListeners();

    // Check onboarding
    handleOnboarding();

    // Get current tab info
    await loadCurrentTab();

    // Load bookmarks list
    await loadBookmarks();

    // Check auth status
    await checkAuthStatus();

    // Set random placeholder
    setRandomPlaceholder();
}

async function checkAuthStatus() {
    const supabase = getSupabase();
    if (!supabase) {
        // Supabase not configured, hide sync button or show config message
        elements.syncBtn.title = 'Cloud sync not configured';
        return;
    }

    try {
        currentUser = await supabase.getUser();
        updateSyncButtonState();
    } catch (error) {
        console.error('Intent: Error checking auth status', error);
    }
}

function updateSyncButtonState() {
    if (currentUser) {
        elements.syncBtn.classList.add('authenticated');
        elements.syncBtn.title = `Synced as ${currentUser.email}`;
    } else {
        elements.syncBtn.classList.remove('authenticated');
        elements.syncBtn.title = 'Sign in to sync';
    }
}

async function loadCurrentTab() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' });

        if (!response || !response.url) {
            showUnsupportedPage();
            return;
        }

        currentTab = response;

        // Update UI
        elements.pageFavicon.src = currentTab.favicon || getDefaultFavicon(currentTab.url);
        elements.pageFavicon.onerror = () => {
            elements.pageFavicon.src = getDefaultFavicon(currentTab.url);
        };
        elements.pageTitle.textContent = currentTab.title || 'Untitled';
        elements.pageUrl.textContent = new URL(currentTab.url).hostname;

        // Check if already bookmarked
        existingBookmark = await getBookmarkByUrl(currentTab.url);

        if (existingBookmark) {
            showSavedState();
        } else {
            showSaveForm();
        }
    } catch (error) {
        console.error('Intent: Error loading current tab', error);
        showUnsupportedPage();
    }
}

function showUnsupportedPage() {
    elements.pageTitle.textContent = 'Unsupported page';
    elements.pageUrl.textContent = 'Cannot save this page';
    elements.saveSection.classList.add('hidden');
}

function showSaveForm() {
    elements.intentInput.parentElement.classList.remove('hidden');
    elements.saveBtn.classList.remove('hidden');
    elements.savedState.classList.add('hidden');
}

function showSavedState() {
    elements.intentInput.parentElement.classList.add('hidden');
    elements.saveBtn.classList.add('hidden');
    elements.timerSection.classList.add('hidden');
    elements.savedState.classList.remove('hidden');

    elements.savedIntent.textContent = `"${existingBookmark.intent}"`;
    elements.savedDate.textContent = formatRelativeTime(existingBookmark.createdAt);
    elements.visitCount.textContent = `${existingBookmark.visitedCount} visit${existingBookmark.visitedCount !== 1 ? 's' : ''}`;
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
    elements.intentInput.placeholder = placeholder;
}

function applySettings() {
    // Apply dark mode
    if (settings.darkMode) {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }

    // Update settings form
    elements.overlayDuration.value = settings.overlayDuration;
    elements.overlayPosition.value = settings.overlayPosition;
    elements.darkModeToggle.checked = settings.darkMode;
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Intent input
    elements.intentInput.addEventListener('input', handleIntentInput);
    elements.intentInput.addEventListener('focus', startTimer);

    // Save button
    elements.saveBtn.addEventListener('click', handleSave);

    // Update button
    elements.updateBtn.addEventListener('click', handleUpdate);

    // Search
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Settings
    elements.settingsBtn.addEventListener('click', () => openModal('settings'));
    elements.closeSettingsBtn.addEventListener('click', () => closeModal('settings'));

    // Check if modal backdrop exists before adding listener
    const settingsBackdrop = elements.settingsModal.querySelector('.modal-backdrop');
    if (settingsBackdrop) {
        settingsBackdrop.addEventListener('click', () => closeModal('settings'));
    }

    elements.overlayDuration.addEventListener('change', handleSettingChange);
    elements.overlayPosition.addEventListener('change', handleSettingChange);
    elements.darkModeToggle.addEventListener('change', handleSettingChange);

    elements.exportBtn.addEventListener('click', handleExport);
    elements.importInput.addEventListener('change', handleImport);

    // Auth
    elements.syncBtn.addEventListener('click', () => openModal('auth'));
    elements.closeAuthBtn.addEventListener('click', () => closeModal('auth'));

    // Check if auth backdrop exists
    const authBackdrop = elements.authModal.querySelector('.modal-backdrop');
    if (authBackdrop) {
        authBackdrop.addEventListener('click', () => closeModal('auth'));
    }

    elements.authForm.addEventListener('submit', handleAuthSubmit);
    elements.authToggleBtn.addEventListener('click', toggleAuthMode);
    elements.forgotPasswordBtn.addEventListener('click', handleForgotPassword);
    elements.signOutBtn.addEventListener('click', handleSignOut);
    elements.syncNowBtn.addEventListener('click', handleSyncNow);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    // Tab switching
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Onboarding - use event delegation for reliability
    const onboardingModal = document.getElementById('onboardingModal');
    if (onboardingModal) {
        onboardingModal.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.id === 'onboardingNext1') {
                showSlide(2);
            } else if (target.id === 'onboardingNext2') {
                showSlide(3);
            } else if (target.id === 'onboardingFinish' ||
                target.id === 'onboardingSkip1' ||
                target.id === 'onboardingSkip2' ||
                target.id === 'onboardingSkip3') {
                finishOnboarding();
            }
        });
    }
}

async function handleOnboarding() {
    const result = await chrome.storage.local.get('hasSeenOnboarding');
    if (!result.hasSeenOnboarding) {
        // Show onboarding
        setTimeout(() => {
            elements.onboardingModal.classList.add('visible');
        }, 500);
    }
}

function showSlide(step) {
    elements.onboardingSlides.forEach(slide => {
        if (parseInt(slide.dataset.step) === step) {
            slide.classList.add('active');
        } else {
            slide.classList.remove('active');
        }
    });
}

function finishOnboarding() {
    const modal = document.getElementById('onboardingModal');
    if (modal) {
        modal.classList.remove('visible');
    }
    chrome.storage.local.set({ hasSeenOnboarding: true });
}

// ========================================
// MODAL FUNCTIONS
// ========================================

function openModal(name) {
    if (name === 'settings') {
        elements.settingsModal.classList.remove('hidden');
        elements.settingsModal.classList.add('visible');
    } else if (name === 'auth') {
        elements.authModal.classList.remove('hidden');
        elements.authModal.classList.add('visible');

        // Show appropriate state
        if (currentUser) {
            showAuthenticatedState();
        } else {
            showLoginForm();
        }
    }
}

function closeModal(name) {
    if (name === 'settings') {
        elements.settingsModal.classList.remove('visible');
        elements.settingsModal.classList.add('hidden');
    } else if (name === 'auth') {
        elements.authModal.classList.remove('visible');
        elements.authModal.classList.add('hidden');
    }
}

function switchTab(tabId) {
    // Update container data attribute for indicator animation
    const tabsContainer = document.querySelector('.tabs-container');
    if (tabsContainer) {
        tabsContainer.setAttribute('data-active-tab', tabId);
    }

    // Update buttons
    elements.tabBtns.forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update content
    elements.tabContents.forEach(content => {
        if (content.id === `${tabId}Tab`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

function handleIntentInput(e) {
    const value = e.target.value;
    const length = value.length;

    // Update character count
    elements.charCount.textContent = `${length}/500`;

    // Enable/disable save button based on content
    updateSaveButtonState();
}

function startTimer() {
    if (timerStartTime || existingBookmark) return;

    timerStartTime = Date.now();
    elements.timerSection.classList.remove('hidden');

    timerInterval = setInterval(() => {
        const elapsed = Date.now() - timerStartTime;
        const progress = Math.min((elapsed / MIN_INTENT_TIME) * 100, 100);

        elements.timerProgress.style.width = `${progress}%`;

        if (elapsed >= MIN_INTENT_TIME) {
            clearInterval(timerInterval);
            elements.timerSection.querySelector('.timer-text').textContent = 'Ready to save!';
            updateSaveButtonState();
        }
    }, 100);
}

function updateSaveButtonState() {
    const hasIntent = elements.intentInput.value.trim().length > 0;
    const timerComplete = timerStartTime && (Date.now() - timerStartTime >= MIN_INTENT_TIME);

    elements.saveBtn.disabled = !hasIntent || !timerComplete;
}

async function handleSave() {
    if (!currentTab) return;

    const intent = elements.intentInput.value.trim();
    if (!intent) return;

    // Disable button and show loading
    elements.saveBtn.disabled = true;
    elements.saveBtn.querySelector('.btn-text').textContent = 'Saving...';

    try {
        const bookmark = await saveBookmark({
            url: currentTab.url,
            title: currentTab.title,
            intent: intent,
            favicon: currentTab.favicon,
        });

        existingBookmark = bookmark;

        // Notify background script
        chrome.runtime.sendMessage({
            type: 'BOOKMARK_SAVED',
            bookmark: bookmark,
            tabId: currentTab.id,
        });

        // Update UI
        showSavedState();
        await loadBookmarks();

        // Success animation
        elements.savedState.classList.add('slide-up');

        // Auto-sync if authenticated
        if (currentUser) {
            syncInBackground();
        }
    } catch (error) {
        console.error('Intent: Error saving bookmark', error);
        elements.saveBtn.querySelector('.btn-text').textContent = 'Error! Try again';
        elements.saveBtn.disabled = false;
    }
}

function handleUpdate() {
    // Store old intent before resetting
    const oldIntent = existingBookmark?.intent || '';

    // Reset to save form mode
    existingBookmark = null;
    timerStartTime = Date.now() - MIN_INTENT_TIME; // Skip timer for updates

    elements.savedState.classList.add('hidden');
    elements.intentInput.parentElement.classList.remove('hidden');
    elements.saveBtn.classList.remove('hidden');
    elements.saveBtn.querySelector('.btn-text').textContent = 'Update Intent';

    // Pre-fill with old intent
    elements.intentInput.value = oldIntent;
    handleIntentInput({ target: elements.intentInput });

    elements.intentInput.focus();
}

// ========================================
// BOOKMARKS LIST
// ========================================

async function loadBookmarks(query = '') {
    try {
        let bookmarks;

        if (query) {
            bookmarks = await searchBookmarks(query);
        } else {
            bookmarks = await getBookmarks();
            bookmarks = bookmarks.filter(b => !b.isArchived);
        }

        renderBookmarks(bookmarks);
    } catch (error) {
        console.error('Intent: Error loading bookmarks', error);
    }
}

function renderBookmarks(bookmarks) {
    elements.bookmarkCount.textContent = bookmarks.length;

    if (bookmarks.length === 0) {
        elements.bookmarksList.classList.add('hidden');
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.bookmarksList.classList.remove('hidden');
    elements.emptyState.classList.add('hidden');

    elements.bookmarksList.innerHTML = bookmarks.map(bookmark => `
    <div class="bookmark-item" data-id="${bookmark.id}" data-url="${encodeURIComponent(bookmark.url)}">
      <img 
        class="bookmark-favicon" 
        src="${bookmark.favicon || getDefaultFavicon(bookmark.url)}" 
        alt=""
        onerror="this.src='${getDefaultFavicon(bookmark.url)}'"
      >
      <div class="bookmark-content">
        <span class="bookmark-title">${escapeHtml(bookmark.title)}</span>
        <span class="bookmark-intent">${escapeHtml(bookmark.intent)}</span>
        <span class="bookmark-meta">${formatRelativeTime(bookmark.createdAt)}</span>
      </div>
      <div class="bookmark-actions">
        <button class="delete-btn" data-id="${bookmark.id}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

    // Add click handlers
    elements.bookmarksList.querySelectorAll('.bookmark-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) return;
            const url = decodeURIComponent(item.dataset.url);
            chrome.tabs.create({ url });
        });
    });

    elements.bookmarksList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;

            if (await deleteBookmark(id)) {
                // Animate removal
                const item = btn.closest('.bookmark-item');
                item.style.opacity = '0';
                item.style.transform = 'translateX(10px)';

                setTimeout(() => {
                    loadBookmarks(elements.searchInput.value);
                }, 200);
            }
        });
    });
}

async function handleSearch(e) {
    const query = e.target.value.trim();
    await loadBookmarks(query);
}

// ========================================
// SETTINGS
// ========================================

async function handleSettingChange() {
    const newSettings = {
        overlayDuration: parseInt(elements.overlayDuration.value),
        overlayPosition: elements.overlayPosition.value,
        darkMode: elements.darkModeToggle.checked,
    };

    settings = await updateSettings(newSettings);
    applySettings();
}

async function handleExport() {
    try {
        const json = await exportBookmarks();
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
        const success = await importBookmarks(text, true);

        if (success) {
            await loadBookmarks();
            closeModal('settings');
        } else {
            alert('Import failed. Please check the file format.');
        }
    } catch (error) {
        console.error('Intent: Import failed', error);
        alert('Import failed. Please check the file format.');
    }

    // Reset input
    e.target.value = '';
}

// ========================================
// AUTHENTICATION
// ========================================

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;

    if (isSignUpMode) {
        elements.authModalTitle.textContent = 'Create Account';
        elements.authSubmitBtn.querySelector('.btn-text').textContent = 'Sign Up';
        elements.authToggleText.textContent = 'Already have an account?';
        elements.authToggleBtn.textContent = 'Sign In';
        elements.forgotPasswordBtn.classList.add('hidden');
    } else {
        elements.authModalTitle.textContent = 'Sign In';
        elements.authSubmitBtn.querySelector('.btn-text').textContent = 'Sign In';
        elements.authToggleText.textContent = "Don't have an account?";
        elements.authToggleBtn.textContent = 'Sign Up';
        elements.forgotPasswordBtn.classList.remove('hidden');
    }

    // Clear error
    hideAuthError();
}

function showAuthError(message) {
    elements.authError.textContent = message;
    elements.authError.classList.remove('hidden');
}

function hideAuthError() {
    elements.authError.classList.add('hidden');
}

function setAuthLoading(loading) {
    elements.authSubmitBtn.disabled = loading;
    const btnText = elements.authSubmitBtn.querySelector('.btn-text');
    const btnLoader = elements.authSubmitBtn.querySelector('.btn-loader');

    if (loading) {
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
    } else {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();

    const supabase = getSupabase();
    if (!supabase) {
        showAuthError('Cloud sync is not configured. Please set up Supabase credentials.');
        return;
    }

    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value;

    hideAuthError();
    setAuthLoading(true);

    try {
        if (isSignUpMode) {
            const result = await supabase.signUp(email, password);

            if (result.needsConfirmation) {
                showAuthError('Please check your email to confirm your account.');
                setAuthLoading(false);
                return;
            }

            currentUser = result.user;
        } else {
            const result = await supabase.signIn(email, password);
            currentUser = result.user;
        }

        // Success - update UI
        updateSyncButtonState();
        showAuthenticatedState();

        // Sync bookmarks
        await handleSyncNow();
    } catch (error) {
        console.error('Intent: Auth error', error);

        // Detailed error handling
        let message = error.message || 'Authentication failed. Please try again.';

        if (message.includes('Invalid email or password')) {
            message = 'Incorrect email or password.';
            // If they are in Sign In mode, maybe they need to Sign Up?
            if (!isSignUpMode) {
                // We could show a hint, but keeping it simple is better.
                // Just ensuring the message is friendly.
            }
        } else if (message.includes('User already registered')) {
            message = 'This email is already registered. Try signing in?';
            if (isSignUpMode) {
                // Auto-switch to sign in? No, let user choose.
            }
        }

        showAuthError(message);
    } finally {
        setAuthLoading(false);
    }
}

async function handleForgotPassword() {
    const supabase = getSupabase();
    if (!supabase) {
        showAuthError('Cloud sync is not configured.');
        return;
    }

    const email = elements.authEmail.value.trim();

    if (!email) {
        showAuthError('Please enter your email address first.');
        return;
    }

    try {
        await supabase.resetPassword(email);
        showAuthError('Password reset email sent! Check your inbox.');
    } catch (error) {
        showAuthError(error.message || 'Failed to send reset email.');
    }
}

async function handleSignOut() {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        await supabase.signOut();
        currentUser = null;
        updateSyncButtonState();
        showLoginForm();
    } catch (error) {
        console.error('Intent: Sign out error', error);
    }
}

async function handleSyncNow() {
    const supabase = getSupabase();
    if (!supabase || !currentUser) return;

    elements.syncNowBtn.classList.add('syncing');
    elements.syncNowBtn.disabled = true;

    try {
        const localBookmarks = await getBookmarks();
        const mergedBookmarks = await supabase.syncBookmarks(localBookmarks);

        // Update local storage with merged bookmarks
        await chrome.storage.local.set({ intent_bookmarks: mergedBookmarks });

        // Reload UI
        await loadBookmarks();

        // Show success
        const originalText = elements.syncNowBtn.innerHTML;
        elements.syncNowBtn.innerHTML = '✓ Synced!';
        setTimeout(() => {
            elements.syncNowBtn.innerHTML = originalText;
        }, 2000);
    } catch (error) {
        console.error('Intent: Sync error', error);
        showAuthError('Sync failed: ' + error.message);
    } finally {
        elements.syncNowBtn.classList.remove('syncing');
        elements.syncNowBtn.disabled = false;
    }
}

function syncInBackground() {
    // Silent background sync
    handleSyncNow().catch(console.error);
}

function showAuthenticatedState() {
    elements.authForm.classList.add('hidden');
    elements.authStatus.classList.remove('hidden');
    elements.authUserEmail.textContent = currentUser?.email || '';
    elements.forgotPasswordBtn.classList.add('hidden');

    // Hide toggle
    elements.authToggleText.parentElement.classList.add('hidden');
}

function showLoginForm() {
    elements.authForm.classList.remove('hidden');
    elements.authStatus.classList.add('hidden');
    elements.forgotPasswordBtn.classList.remove('hidden');
    elements.authToggleText.parentElement.classList.remove('hidden');

    // Reset form
    elements.authEmail.value = '';
    elements.authPassword.value = '';
    hideAuthError();
}

// ========================================
// KEYBOARD SHORTCUTS
// ========================================

function handleKeyDown(e) {
    // Escape to close modals
    if (e.key === 'Escape') {
        closeModal('settings');
        closeModal('auth');
    }

    // Ctrl+Enter to save
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (!elements.saveBtn.disabled) {
            handleSave();
        }
    }
}

// ========================================
// UTILITIES
// ========================================

function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    if (diffWeek < 4) return `${diffWeek}w ago`;
    if (diffMonth < 12) return `${diffMonth}mo ago`;

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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

/**
 * Intent - Content Script
 * Displays intent overlay when user visits a saved bookmark
 */

// Overlay configuration
let overlayConfig = {
    duration: 5000,
    position: 'bottom-right',
};

// Overlay element reference
let overlayElement = null;
let dismissTimeout = null;

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_INTENT_OVERLAY') {
        showOverlay(message.bookmark);
        sendResponse({ success: true });
    } else if (message.type === 'BOOKMARK_UPDATED') {
        // Update overlay if visible
        if (overlayElement) {
            updateOverlay(message.bookmark);
        }
    }
});

// Load settings on init
async function loadSettings() {
    try {
        const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
        if (response) {
            overlayConfig.duration = response.overlayDuration || 5000;
            overlayConfig.position = response.overlayPosition || 'bottom-right';
        }
    } catch (error) {
        console.error('Intent: Error loading settings', error);
    }
}

loadSettings();

/**
 * Show the intent overlay
 * @param {Object} bookmark - The bookmark object with intent
 */
function showOverlay(bookmark) {
    // Remove existing overlay if any
    removeOverlay();

    // Create overlay container
    overlayElement = document.createElement('div');
    overlayElement.id = 'intent-overlay';
    overlayElement.className = `intent-overlay intent-overlay--${overlayConfig.position}`;

    // Calculate time since saved
    const timeSince = formatRelativeTime(bookmark.createdAt);
    const visitText = bookmark.visitedCount > 1
        ? `Visit #${bookmark.visitedCount}`
        : 'First revisit!';

    overlayElement.innerHTML = `
    <div class="intent-overlay__header">
      <svg class="intent-overlay__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="intent-overlay__title">Your Intent</span>
      <button class="intent-overlay__close" aria-label="Close">x</button>
    </div>
    <div class="intent-overlay__content">
      <p class="intent-overlay__intent">"${escapeHtml(bookmark.intent)}"</p>
      <div class="intent-overlay__meta">
        <span class="intent-overlay__time">${timeSince}</span>
        <span class="intent-overlay__separator">•</span>
        <span class="intent-overlay__visits">${visitText}</span>
      </div>
    </div>
    <div class="intent-overlay__progress">
      <div class="intent-overlay__progress-bar"></div>
    </div>
  `;

    // Append to body
    document.body.appendChild(overlayElement);

    // Add event listeners
    overlayElement.querySelector('.intent-overlay__close').addEventListener('click', removeOverlay);
    overlayElement.addEventListener('mouseenter', pauseDismiss);
    overlayElement.addEventListener('mouseleave', resumeDismiss);

    // Trigger entrance animation
    requestAnimationFrame(() => {
        overlayElement.classList.add('intent-overlay--visible');

        // Start progress bar animation
        if (overlayConfig.duration > 0) {
            const progressBar = overlayElement.querySelector('.intent-overlay__progress-bar');
            progressBar.style.transition = `width ${overlayConfig.duration}ms linear`;
            progressBar.style.width = '0%';
        }
    });

    // Auto-dismiss after duration
    if (overlayConfig.duration > 0) {
        startDismissTimer();
    }
}

/**
 * Update the overlay content
 * @param {Object} bookmark - Updated bookmark object
 */
function updateOverlay(bookmark) {
    if (!overlayElement) return;

    const intentEl = overlayElement.querySelector('.intent-overlay__intent');
    if (intentEl) {
        intentEl.textContent = `"${bookmark.intent}"`;
    }
}

/**
 * Remove the overlay with exit animation
 */
function removeOverlay() {
    if (!overlayElement) return;

    clearTimeout(dismissTimeout);

    overlayElement.classList.remove('intent-overlay--visible');
    overlayElement.classList.add('intent-overlay--exiting');

    setTimeout(() => {
        if (overlayElement && overlayElement.parentNode) {
            overlayElement.parentNode.removeChild(overlayElement);
        }
        overlayElement = null;
    }, 300);
}

/**
 * Start auto-dismiss timer
 */
function startDismissTimer() {
    clearTimeout(dismissTimeout);
    dismissTimeout = setTimeout(removeOverlay, overlayConfig.duration);
}

/**
 * Pause auto-dismiss when hovering
 */
function pauseDismiss() {
    clearTimeout(dismissTimeout);

    const progressBar = overlayElement?.querySelector('.intent-overlay__progress-bar');
    if (progressBar) {
        progressBar.style.transition = 'none';
        const computed = getComputedStyle(progressBar);
        progressBar.style.width = computed.width;
    }
}

/**
 * Resume auto-dismiss when mouse leaves
 */
function resumeDismiss() {
    if (overlayConfig.duration <= 0) return;

    const progressBar = overlayElement?.querySelector('.intent-overlay__progress-bar');
    if (progressBar) {
        const currentWidth = parseFloat(progressBar.style.width);
        const remainingTime = (currentWidth / 100) * overlayConfig.duration;

        progressBar.style.transition = `width ${remainingTime}ms linear`;
        progressBar.style.width = '0%';
    }

    startDismissTimer();
}

/**
 * Format relative time
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted relative time
 */
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

    if (diffSec < 60) return 'Saved just now';
    if (diffMin < 60) return `Saved ${diffMin}m ago`;
    if (diffHour < 24) return `Saved ${diffHour}h ago`;
    if (diffDay < 7) return `Saved ${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffWeek < 4) return `Saved ${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
    if (diffMonth < 12) return `Saved ${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;

    return `Saved on ${date.toLocaleDateString()}`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

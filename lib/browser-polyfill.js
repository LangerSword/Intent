/**
 * Intent - Cross-Browser Polyfill
 * 
 * Normalizes the extension API namespace so that all code can use `browser.*`.
 * - Firefox: `browser` is available natively (Promise-based).
 * - Chrome (MV3): `chrome` APIs return Promises when no callback is given.
 *   This shim aliases `browser` to `chrome` so the same code works everywhere.
 *
 * Load this script BEFORE any other extension code:
 *   - Content scripts: listed first in manifest "js" array.
 *   - ES module entry points: `import './browser-polyfill.js';` at the top.
 */

if (typeof globalThis.browser === 'undefined') {
    globalThis.browser = chrome;
}

# Intent

**Save links with purpose. Never forget why you bookmarked something.**

Intent is a cross-browser extension (Chrome and Firefox) that transforms passive bookmarking into intentional research by capturing *why* you save a link, not just *what* you save.

---

## Features

- **Cross-Browser Support** - Works on both Chromium-based browsers (Chrome, Edge, Brave, Opera) and Firefox with a single codebase
- **3-Second Reflection** - Forces a brief pause to capture your specific thought or purpose before saving
- **Context Restoration** - When you revisit a saved page, your original intent appears as a subtle overlay
- **Clean UI** - Minimal, dark-themed glassmorphism design
- **Search and Organize** - Find bookmarks by title, intent, or URL
- **Import/Export** - Backup and restore your bookmarks as JSON
- **Cloud Sync** - Optional sync across devices using GitHub Gists (free, no server required)
- **Open Source Ready** - Credentials are kept separate and gitignored

---

## Browser Compatibility

Intent uses a unified manifest that works on both Chrome and Firefox:

| Feature | Chrome / Chromium | Firefox |
|---------|-------------------|---------|
| **Manifest Version** | MV3 | MV3 |
| **Background Script** | Service Worker | Background Script |
| **Extension API** | `chrome.*` (polyfilled as `browser.*`) | `browser.*` (native) |
| **Minimum Version** | Chrome 92+ | Firefox 109+ |
| **Storage API** | `browser.storage.local` (via polyfill) | `browser.storage.local` (native) |

A lightweight polyfill (`lib/browser-polyfill.js`) ensures all source code uses the `browser.*` namespace uniformly.

---

## Security

This extension is designed for open-source distribution:

- **No hardcoded credentials** - GitHub config is in a separate file (`config.js`) that is gitignored
- **Private Gists** - Bookmarks are stored in a private Gist only you can access
- **Local-first** - Works fully offline; cloud sync is optional

---

## Installation

### Chrome / Chromium

1. Open Chrome (or Edge / Brave) and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top right
3. Click **Load unpacked**
4. Select the `Intent` folder

### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the `manifest.json` file inside the `Intent` folder

> **Note:** The same `manifest.json` works for both browsers. The Firefox-specific settings (`browser_specific_settings.gecko`) are ignored by Chrome.

### Production Build

This extension uses vanilla JavaScript with no build step required:

- **Chrome Web Store** - Zip the folder and upload
- **Firefox Add-ons** - Zip the folder and upload to AMO

---

## Cloud Sync Setup (Optional)

Cloud sync is optional. Bookmarks work fully offline. To sync across devices, use GitHub Gists.

### 1. Create a GitHub Personal Access Token

1. Go to [GitHub Settings](https://github.com/settings/tokens) > **Developer settings** > **Personal access tokens**
2. Click **Generate new token (classic)**
3. Give it a descriptive name (e.g., "Intent Bookmark Sync")
4. Select the **gist** scope
5. Click **Generate token**
6. **Copy the token immediately** - you won't see it again!

> **Security Note:** Tokens with only the `gist` scope can only read/write your gists, nothing else. This is safe to use in the extension.

### 2. Configure the Extension

1. Copy `lib/config.example.js` to `lib/config.js`
2. Add your GitHub token:

```javascript
export const CONFIG = {
  GITHUB_TOKEN: 'ghp_your_token_here',
  GITHUB_USERNAME: 'your-username',  // optional
  APP_NAME: 'Intent',
  APP_VERSION: '1.0.0',
};

export function isConfigured() {
  return CONFIG.GITHUB_TOKEN !== 'YOUR_GITHUB_TOKEN' && CONFIG.GITHUB_TOKEN.length > 0;
}
```

3. **Important**: `config.js` is gitignored. Do not commit it with real credentials.

### 3. Connect in the Extension

1. Click the Intent extension icon
2. Click the sync icon (top right)
3. Paste your GitHub token in the field
4. Click "Connect GitHub"

Your bookmarks will sync to a private Gist that only you can access.

---

## Usage

### Save a Bookmark

1. Navigate to any webpage
2. Click the Intent extension icon
3. Write your reason for saving (minimum 3 seconds for reflection)
4. Click "Save with Intent"

### Revisit Context

When you open a saved page, a subtle overlay shows your original intent, helping you instantly recall why you bookmarked it.

### Sync Across Devices

1. Click the sync icon in the popup
2. Enter your GitHub Personal Access Token
3. Your bookmarks will sync automatically

---

## Settings

| Setting | Description |
|---------|-------------|
| Overlay Duration | How long the intent overlay stays visible (3s, 5s, 10s, or manual) |
| Overlay Position | Where the overlay appears (any corner of the screen) |
| Dark Mode | Toggle between dark and light themes |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Extension | Manifest V3 (Chrome + Firefox) |
| Frontend | Vanilla JavaScript |
| Styling | CSS Variables, Glassmorphism |
| Local Storage | WebExtension Storage API (`browser.storage.local`) |
| Cross-Browser | Custom polyfill (`lib/browser-polyfill.js`) |
| Cloud Sync | GitHub Gists API |
| Auth | GitHub Personal Access Token |

---

## Project Structure

```
Intent/
├── manifest.json              # Unified manifest (Chrome + Firefox)
├── background.js              # Background script / service worker
├── .gitignore                 # Excludes config.js from version control
├── LICENSE                    # MIT License
├── README.md
├── popup/
│   ├── popup.html             # Main popup UI
│   ├── popup.css              # Glassmorphism styles
│   └── popup.js               # UI logic and auth integration
├── content/
│   ├── content.js             # Intent overlay injection
│   └── content.css            # Overlay styles
├── lib/
│   ├── browser-polyfill.js   # Cross-browser API shim
│   ├── storage.js            # WebExtension Storage wrapper
│   ├── config.example.js     # Template for GitHub credentials
│   └── github-sync.js        # GitHub Gists sync client
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Chrome vs. Firefox — Key Differences

| Aspect | Chrome (Chromium) | Firefox |
|--------|-------------------|---------|
| **Background execution** | Service Worker — suspends when idle, wakes on events | Background script — stays alive while browser is open |
| **API namespace** | `chrome.*` (polyfilled to `browser.*`) | `browser.*` (native) |
| **Filtered internal URLs** | `chrome://`, `chrome-extension://` | `about:`, `moz-extension://`, `browser:` |
| **Addon signing** | Chrome Web Store required for production | AMO required for production |

---

## Troubleshooting

### "Cloud sync not configured"
- Copy `lib/config.example.js` to `lib/config.js` and add your GitHub token

### "Sync failed" or authentication errors
- Verify your GitHub token has the `gist` scope
- Check your token hasn't expired or been revoked
- Try generating a new token

### Extension doesn't load in Firefox
- Make sure you're using Firefox 109+
- Check `about:debugging` for any error messages

### Overlay doesn't appear when revisiting bookmarks
- Ensure you're not on a restricted page (about:, chrome:, etc.)
- Check browser console for errors

---

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

**Important**: Never commit `config.js` with real credentials. Test your changes on **both** Chrome and Firefox before submitting.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with modern web technologies and designed for intentional browsing across all major browsers.
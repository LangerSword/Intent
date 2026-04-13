# Intent

<p align="center">
  <img src="icons/icon128.png" width="128" height="128" alt="Intent Logo">
</p>

**Save links with purpose. Never forget why you bookmarked something.**

Intent transforms passive bookmarking into intentional research. It captures *why* you save a link, not just *what* you save — making your bookmarks actually useful when you revisit them.

---

## What's New (v2.0)

### Fixed: Background Script Not Loading

The previous version used `service_worker` in the manifest which is **disabled by default** in many browser configurations and doesn't work properly on Firefox.

**Solution:** Changed to `background.scripts` which works on both Chrome and Firefox:

```json
// Before (broken)
"background": {
  "service_worker": "js/background.js"
}

// After (works)
"background": {
  "scripts": ["js/background.js"]
}
```

This ensures the background script runs reliably on all supported browsers.

### Other Updates
- Sleeker black UI with sharper contrast
- Light mode toggle with bulb icon in header
- Improved theme persistence
- Streamlined codebase (no more broken ES module imports)

---

## Features

- **Works Offline** — Full functionality without any account or login
- **3-Second Reflection** — Thoughtful pause before saving helps you articulate your intent
- **Context Overlay** — When you revisit a saved page, your original intent appears as a subtle overlay
- **Cross-Browser** — Works on Chrome, Firefox, Edge, Brave, and other Chromium browsers
- **Theme Toggle** — Click the moon/sun icon to switch between dark and light modes
- **Search & Organize** — Find bookmarks by title, intent, or URL
- **Import/Export** — Backup and restore your data as JSON
- **Optional Cloud Sync** — Sync across devices using your GitHub account

---

## Installation

### Chrome / Chromium

1. Open **Extensions** → `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `Intent` folder

### Firefox

1. Open **Add-ons** → `about:addons`
2. Click the **gear** icon → **Debug Add-ons**
3. Click **Load Temporary Add-on...**
4. Select `manifest.json` from the `Intent` folder

> **Note:** The same `manifest.json` works for both Chrome and Firefox. The Firefox-specific settings are ignored by Chrome.

---

## How It Works

### Save a Bookmark

1. Navigate to any webpage
2. Click the Intent extension icon
3. Write your reason for saving
4. Click **Save with Intent**

The 3-second timer encourages thoughtful reflection. You can update your intent anytime.

### Toggle Theme

Click the **moon icon** in the header to switch to light mode. Click the **sun icon** to switch back to dark mode. Theme preference is saved automatically.

### Revisit Context

When you open a saved page, an overlay appears showing your original intent — instant recall of why you bookmarked it.

### Library

All saved bookmarks are stored in the **Library** tab. Search by title, intent, or URL. Click any bookmark to open it.

---

## Settings

| Setting | Options | Description |
|---------|---------|-------------|
| Overlay Duration | 3s / 5s / 10s / Manual | How long the intent overlay stays visible |
| Overlay Position | Bottom Right / Left, Top Right / Left | Where the overlay appears |
| Dark Mode | On / Off | Toggle theme |
| Export/Import | JSON | Backup or restore bookmarks |

---

## Cloud Sync (Optional)

Cloud sync is entirely optional. Your bookmarks work fully offline.

### Connect GitHub

1. Open **Settings** → Click **Connect Cloud Sync**
2. Create a GitHub Personal Access Token:
   - Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
   - Generate new token (classic)
   - Select the `gist` scope
   - Copy the token
3. Paste the token in the extension
4. Click **Connect GitHub**

Your bookmarks sync to a private Gist only you can access.

### Disconnect

Click **Disconnect** in the sync settings to stop syncing. Your local bookmarks remain.

---

## Security

- **Local-first** — Works fully offline
- **No required account** — Use without any login
- **Token stored locally** — GitHub token never leaves your device
- **Private Gist** — Synced bookmarks go to a private Gist only you can access
- **No tracking** — No analytics, no external calls except when you connect sync

---

## Tech Stack

- **Manifest V3** — Modern extension API
- **Vanilla JavaScript** — No frameworks, no build step
- **WebExtension Storage** — Browser-native local storage
- **GitHub Gists API** — Optional cloud sync

---

## Project Structure

```
Intent/
├── manifest.json         # Extension manifest (works for Chrome + Firefox)
├── popup.html            # Main popup UI with embedded styles
├── js/
│   ├── popup.js          # Popup logic
│   ├── storage.js        # Local storage + optional sync
│   ├── background.js    # Background script
│   └── content.js       # Intent overlay injection
├── css/
│   └── content.css      # Overlay styles
├── icons/               # Extension icons
└── README.md
```

---

## Contributing

1. Fork the repository
2. Make your changes
3. Test on both Chrome and Firefox
4. Open a Pull Request

---

## License

MIT — See [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with modern web technologies for intentional browsing across all major browsers.
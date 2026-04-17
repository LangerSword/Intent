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

**Solution:** Changed to `background.scripts` which works on both Chrome and Firefox.

### Fixed: Theme Toggle

The theme toggle now works correctly. Toggle between dark and light modes using the sun icon in the header. Theme preference is saved and persists.

### New UI

- Clean black & white design (no more purple/gradients)
- High contrast: black background, white text in dark mode
- White background, black text in light mode
- Simple, minimal styling inspired by clean design principles

---

## Features

- **Works Offline** — Full functionality without any account or login
- **3-Second Reflection** — Thoughtful pause before saving
- **Context Overlay** — See your intent when revisiting saved pages
- **Cross-Browser** — Works on Chrome, Firefox, Edge, Brave
- **Theme Toggle** — Click the sun icon to switch between dark/light modes
- **Search & Organize** — Find bookmarks by title, intent, or URL
- **Import/Export** — Backup and restore as JSON
- **Optional Cloud Sync** — Sync via GitHub Gists

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

---

## How It Works

### Save a Bookmark

1. Navigate to any webpage
2. Click the Intent extension icon
3. Write your reason for saving
4. Click **Save with Intent**

### Toggle Theme

Click the **sun icon** in the header to switch to light mode. Click again to switch back to dark mode.

### Library

All saved bookmarks are in the **Library** tab. Search by title, intent, or URL. Click any bookmark to open it.

---

## Settings

| Setting | Options | Description |
|---------|---------|-------------|
| Overlay Duration | 3s / 5s / 10s / Manual | How long the overlay stays |
| Overlay Position | Bottom/Top + Left/Right | Where the overlay appears |
| Dark Mode | On / Off | Toggle theme |

---

## Cloud Sync (Optional)

Cloud sync is optional. Your bookmarks work fully offline.

### Connect GitHub

1. Open **Settings** → **Connect Cloud Sync**
2. Create a GitHub Personal Access Token with `gist` scope
3. Paste the token and click **Connect GitHub**

---

## Security

- **Local-first** — Works fully offline
- **No required account** — Use without login
- **Token stored locally** — GitHub token never leaves your device
- **Private Gist** — Synced bookmarks go to a private Gist only you can access

---

## Project Structure

```
Intent/
├── manifest.json         # Extension manifest
├── popup.html            # Main popup UI
├── js/
│   ├── popup.js          # Popup logic
│   ├── storage.js        # Local storage + sync
│   ├── background.js    # Background script
│   └── content.js       # Intent overlay
├── css/
│   └── content.css      # Overlay styles
└── icons/               # Extension icons
```

---

## License

MIT — See [LICENSE](LICENSE) for details.

## GitHub Actions – AI Test Loop

This repo uses an AI-powered test-fix loop that runs automatically on every push and pull request (except `main`).

### Required: Add Repository Secrets

Before pushing, you must add the following secrets to your GitHub repository, or the workflow will fail:

| Secret Name | Description |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID |
| `CLOUDFLARE_API_KEY` | Your Cloudflare API Key |

**How to add secrets:**
1. Go to your repository on GitHub
2. Navigate to **Settings -> Secrets and variables -> Actions**
3. Click **"New repository secret"**
4. Add each secret listed above

### What it does

On every push/PR to a non-`main` branch, the workflow:
1. Checks out your repository
2. Verifies Docker and Docker Compose are available
3. Runs the AI test-fix loop via `docker compose up`
4. Cleans up containers and volumes after completion

The workflow file lives at `.github/workflows/ai-test-loop.yml`.

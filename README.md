# Intent

**Save links with purpose. Never forget why you bookmarked something.**

Intent is a browser extension that transforms passive bookmarking into intentional research by capturing *why* you save a link, not just *what* you save.

---

## Features

- **3-Second Reflection** - Forces a brief pause to capture your specific thought or purpose before saving
- **Context Restoration** - When you revisit a saved page, your original intent appears as a subtle overlay
- **Clean UI** - Minimal, dark-themed glassmorphism design
- **Search and Organize** - Find bookmarks by title, intent, or URL
- **Import/Export** - Backup and restore your bookmarks as JSON
- **Cloud Sync** - Optional sync across devices with email/password authentication (Supabase)
- **Open Source Ready** - Credentials are kept separate and gitignored

---

## Security

This extension is designed for open-source distribution:

- **No hardcoded credentials** - Supabase config is in a separate file (`config.js`) that is gitignored
- **Secure authentication** - Email/password auth with hashed passwords (handled by Supabase)
- **Row Level Security** - Users can only access their own bookmarks in the database
- **Local-first** - Works fully offline; cloud sync is optional

---

## Installation

### Load as Unpacked Extension (Development)

1. Open Chrome or Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
2. Enable **Developer mode** using the toggle in the top right
3. Click **Load unpacked**
4. Select the `Intent` folder

### Production Build

This extension uses vanilla JavaScript with no build step required. To distribute, simply zip the folder.

---

## Cloud Sync Setup (Optional)

Cloud sync is optional. To enable it:

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Note your **Project URL** and **anon/public key** from Settings > API

### 2. Set Up the Database

Go to the **SQL Editor** in your Supabase dashboard and run:

```sql
-- Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  intent TEXT NOT NULL,
  favicon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  visited_count INT DEFAULT 0,
  last_visited_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  is_archived BOOLEAN DEFAULT FALSE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS bookmarks_url_idx ON bookmarks(url);

-- Enable Row Level Security
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own bookmarks" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks" ON bookmarks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookmarks_updated_at
  BEFORE UPDATE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 3. Configure the Extension

1. Copy `lib/config.example.js` to `lib/config.js`
2. Update with your Supabase credentials:

```javascript
export const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here',
  APP_NAME: 'Intent',
  APP_VERSION: '1.0.0',
};
```

**Important**: `config.js` is gitignored. Each user or deployment needs their own Supabase project.

### 4. Enable Email Authentication

In your Supabase dashboard:
1. Go to **Authentication** > **Providers**
2. Ensure **Email** is enabled
3. Optionally disable email confirmation for easier testing

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
2. Sign up or sign in with email and password
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
| Extension | Manifest V3 |
| Frontend | Vanilla JavaScript |
| Styling | CSS Variables, Glassmorphism |
| Local Storage | Chrome Storage API |
| Backend | Supabase (PostgreSQL + Auth) |
| Auth | Email/Password (Supabase Auth) |

---

## Project Structure

```
Intent/
├── manifest.json              # Extension configuration
├── .gitignore                 # Excludes config.js from version control
├── LICENSE                    # MIT License
├── README.md
├── background/
│   └── service-worker.js      # Background script for tab monitoring
├── popup/
│   ├── popup.html             # Main popup UI
│   ├── popup.css              # Glassmorphism styles
│   └── popup.js               # UI logic and auth integration
├── content/
│   ├── content.js             # Intent overlay injection
│   └── content.css            # Overlay styles
├── lib/
│   ├── storage.js             # Chrome Storage wrapper
│   ├── config.example.js      # Template for Supabase credentials
│   └── supabase.js            # Auth and sync client
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

**Important**: Never commit `config.js` with real credentials.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Built with modern web technologies and designed for intentional browsing.

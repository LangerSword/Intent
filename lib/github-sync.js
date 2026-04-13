/**
 * Intent - GitHub Gists Sync
 * Uses GitHub Personal Access Token for authentication
 * Stores bookmarks in a private Gist
 */

let CONFIG = {
    GITHUB_TOKEN: '',
    GITHUB_USERNAME: '',
    APP_NAME: 'Intent',
    APP_VERSION: '1.0.0',
};

let isConfigured = () => false;

try {
    const configModule = await import('./config.js');
    if (configModule.CONFIG) CONFIG = configModule.CONFIG;
    if (typeof configModule.isConfigured === 'function') {
        isConfigured = configModule.isConfigured;
    }
} catch {
    console.warn('Intent: config.js not found. Copy config.example.js to config.js to enable sync.');
}

const GIST_FILENAME = 'intent-bookmarks.json';
const GIST_DESCRIPTION = 'Intent Bookmarks Backup';

class GitHubSync {
    constructor() {
        this.token = CONFIG.GITHUB_TOKEN;
        this.username = CONFIG.GITHUB_USERNAME;
        this.gistId = null;
    }

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
            error.code = response.status;
            throw error;
        }

        return data;
    }

    async getAuthenticatedUser() {
        return this.request('/user');
    }

    async findExistingGist() {
        const gists = await this.request('/gists');
        for (const gist of gists) {
            if (gist.files[GIST_FILENAME]) {
                return gist;
            }
        }
        return null;
    }

    async createGist(content) {
        return this.request('/gists', {
            method: 'POST',
            body: JSON.stringify({
                description: GIST_DESCRIPTION,
                public: false,
                files: {
                    [GIST_FILENAME]: {
                        content: JSON.stringify(content, null, 2),
                    },
                },
            }),
        });
    }

    async updateGist(gistId, content) {
        return this.request(`/gists/${gistId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                files: {
                    [GIST_FILENAME]: {
                        content: JSON.stringify(content, null, 2),
                    },
                },
            }),
        });
    }

    async getGistContent(gistId) {
        const gist = await this.request(`/gists/${gistId}`);
        const file = gist.files[GIST_FILENAME];
        if (file) {
            return JSON.parse(file.content);
        }
        return null;
    }

    async init() {
        if (!this.gistId) {
            const existingGist = await this.findExistingGist();
            if (existingGist) {
                this.gistId = existingGist.id;
            }
        }
    }

    async pushBookmarks(bookmarks) {
        await this.init();

        const content = {
            version: '1.0',
            updatedAt: new Date().toISOString(),
            bookmarks: bookmarks,
        };

        if (this.gistId) {
            await this.updateGist(this.gistId, content);
        } else {
            const newGist = await this.createGist(content);
            this.gistId = newGist.id;
        }

        await browser.storage.local.set({ intent_gist_id: this.gistId });

        return { synced: bookmarks.length };
    }

    async pullBookmarks() {
        await this.init();

        if (!this.gistId) {
            const stored = await browser.storage.local.get('intent_gist_id');
            this.gistId = stored.intent_gist_id;
        }

        if (!this.gistId) {
            return [];
        }

        const content = await this.getGistContent(this.gistId);
        if (content && content.bookmarks) {
            return content.bookmarks.map(b => ({
                id: b.id,
                url: b.url,
                title: b.title,
                intent: b.intent,
                favicon: b.favicon,
                createdAt: b.createdAt,
                updatedAt: b.updatedAt,
                visitedCount: b.visitedCount || 0,
                lastVisitedAt: b.lastVisitedAt,
                tags: b.tags || [],
                isArchived: b.isArchived || false,
                synced: true,
            }));
        }

        return [];
    }

    async deleteBookmark(id) {
        const bookmarks = await this.pullBookmarks();
        const filtered = bookmarks.filter(b => b.id !== id);
        await this.pushBookmarks(filtered);
    }

    async syncBookmarks(localBookmarks) {
        const cloudBookmarks = await this.pullBookmarks();

        const localMap = new Map(localBookmarks.map(b => [b.id, b]));
        const cloudMap = new Map(cloudBookmarks.map(b => [b.id, b]));

        const merged = [];
        const toUpload = [];

        const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

        for (const id of allIds) {
            const local = localMap.get(id);
            const cloud = cloudMap.get(id);

            if (local && cloud) {
                const localTime = new Date(local.updatedAt).getTime();
                const cloudTime = new Date(cloud.updatedAt).getTime();

                if (localTime >= cloudTime) {
                    merged.push({ ...local, synced: true });
                    toUpload.push(local);
                } else {
                    merged.push({ ...cloud, synced: true });
                }
            } else if (local) {
                merged.push({ ...local, synced: true });
                toUpload.push(local);
            } else if (cloud) {
                merged.push(cloud);
            }
        }

        if (toUpload.length > 0 || cloudBookmarks.length === 0) {
            await this.pushBookmarks(merged);
        }

        return merged;
    }
}

let githubInstance = null;

export function getGitHubSync() {
    if (!isConfigured()) {
        console.warn('Intent: GitHub sync not configured. Copy config.example.js to config.js');
        return null;
    }

    if (!githubInstance) {
        githubInstance = new GitHubSync();
    }

    return githubInstance;
}

export { isConfigured };
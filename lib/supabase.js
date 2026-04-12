/**
 * Intent - Supabase Client
 * Secure cloud sync and email/password authentication
 * 
 * SECURITY MODEL:
 * - Credentials are stored in config.js (gitignored)
 * - Uses Supabase anon key (designed for client-side, protected by RLS)
 * - All data access controlled by Row Level Security policies
 * - Passwords are hashed by Supabase (never stored in plain text)
 */

import { CONFIG, isConfigured } from './config.js';

// ========================================
// SUPABASE CLIENT
// ========================================

class SupabaseClient {
    constructor() {
        this.url = CONFIG.SUPABASE_URL;
        this.key = CONFIG.SUPABASE_ANON_KEY;
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
        this.sessionExpiry = null;
    }

    /**
     * Make authenticated request to Supabase
     */
    async request(endpoint, options = {}) {
        const headers = {
            'apikey': this.key,
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const response = await fetch(`${this.url}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = new Error(data.error_description || data.message || data.msg || `HTTP ${response.status}`);
            error.code = data.error || response.status;
            throw error;
        }

        return data;
    }

    // ========================================
    // EMAIL/PASSWORD AUTHENTICATION
    // ========================================

    /**
     * Sign up with email and password
     * @param {string} email - User's email
     * @param {string} password - User's password (min 6 characters)
     * @returns {Promise<{user, session, error}>}
     */
    async signUp(email, password) {
        try {
            // Validate inputs
            if (!email || !this.isValidEmail(email)) {
                throw new Error('Please enter a valid email address');
            }
            if (!password || password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            const data = await this.request('/auth/v1/signup', {
                method: 'POST',
                body: JSON.stringify({
                    email: email.toLowerCase().trim(),
                    password
                }),
            });

            // If email confirmation is required, user won't have a session yet
            if (data.access_token) {
                await this.setSession(data);
            }

            return {
                user: data.user,
                session: data.access_token ? data : null,
                needsConfirmation: !data.access_token,
            };
        } catch (error) {
            console.error('Intent: Sign up error', error);
            throw error;
        }
    }

    /**
     * Sign in with email and password
     * @param {string} email - User's email
     * @param {string} password - User's password
     * @returns {Promise<{user, session}>}
     */
    async signIn(email, password) {
        try {
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            const data = await this.request('/auth/v1/token?grant_type=password', {
                method: 'POST',
                body: JSON.stringify({
                    email: email.toLowerCase().trim(),
                    password
                }),
            });

            await this.setSession(data);

            return { user: data.user, session: data };
        } catch (error) {
            // Provide user-friendly error messages
            if (error.code === 'invalid_grant' || error.message.includes('Invalid')) {
                throw new Error('Invalid email or password');
            }
            console.error('Intent: Sign in error', error);
            throw error;
        }
    }

    /**
     * Sign out current user
     */
    async signOut() {
        try {
            if (this.accessToken) {
                await this.request('/auth/v1/logout', {
                    method: 'POST',
                }).catch(() => { }); // Ignore errors on logout
            }
        } finally {
            // Always clear local session
            this.accessToken = null;
            this.refreshToken = null;
            this.user = null;
            this.sessionExpiry = null;
            await browser.storage.local.remove('intent_auth_session');
        }
    }

    /**
     * Request password reset email
     * @param {string} email - User's email
     */
    async resetPassword(email) {
        if (!email || !this.isValidEmail(email)) {
            throw new Error('Please enter a valid email address');
        }

        await this.request('/auth/v1/recover', {
            method: 'POST',
            body: JSON.stringify({
                email: email.toLowerCase().trim()
            }),
        });

        return { message: 'Password reset email sent' };
    }

    /**
     * Update user's password (when logged in)
     * @param {string} newPassword - New password
     */
    async updatePassword(newPassword) {
        if (!this.accessToken) {
            throw new Error('You must be logged in to change password');
        }

        if (!newPassword || newPassword.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        const data = await this.request('/auth/v1/user', {
            method: 'PUT',
            body: JSON.stringify({ password: newPassword }),
        });

        this.user = data;
        return { user: data };
    }

    // ========================================
    // SESSION MANAGEMENT
    // ========================================

    /**
     * Set session from auth response
     */
    async setSession(authData) {
        this.accessToken = authData.access_token;
        this.refreshToken = authData.refresh_token;
        this.user = authData.user;
        this.sessionExpiry = Date.now() + (authData.expires_in * 1000);

        // Persist session securely
        await browser.storage.local.set({
            intent_auth_session: {
                accessToken: this.accessToken,
                refreshToken: this.refreshToken,
                expiresAt: this.sessionExpiry,
                userId: this.user?.id,
                userEmail: this.user?.email,
            },
        });
    }

    /**
     * Restore session from storage
     * @returns {Promise<boolean>} Whether a valid session was restored
     */
    async restoreSession() {
        try {
            const result = await browser.storage.local.get('intent_auth_session');
            const session = result.intent_auth_session;

            if (!session || !session.accessToken) {
                return false;
            }

            // Check if expired (with 5 minute buffer)
            const isExpired = session.expiresAt && (Date.now() > session.expiresAt - 300000);

            if (isExpired && session.refreshToken) {
                // Try to refresh the token
                return await this.refreshSession(session.refreshToken);
            } else if (isExpired) {
                // No refresh token, session is dead
                await this.signOut();
                return false;
            }

            // Restore valid session
            this.accessToken = session.accessToken;
            this.refreshToken = session.refreshToken;
            this.sessionExpiry = session.expiresAt;
            this.user = { id: session.userId, email: session.userEmail };

            return true;
        } catch (error) {
            console.error('Intent: Error restoring session', error);
            return false;
        }
    }

    /**
     * Refresh the access token
     */
    async refreshSession(refreshToken) {
        try {
            const data = await this.request('/auth/v1/token?grant_type=refresh_token', {
                method: 'POST',
                body: JSON.stringify({ refresh_token: refreshToken }),
            });

            await this.setSession(data);
            return true;
        } catch (error) {
            console.error('Intent: Token refresh failed', error);
            await this.signOut();
            return false;
        }
    }

    /**
     * Get current user (restores session if needed)
     * @returns {Promise<Object|null>} Current user or null
     */
    async getUser() {
        if (!this.accessToken) {
            const restored = await this.restoreSession();
            if (!restored) return null;
        }

        try {
            const data = await this.request('/auth/v1/user');
            this.user = data;
            return data;
        } catch (error) {
            // Token might be invalid
            if (this.refreshToken) {
                const refreshed = await this.refreshSession(this.refreshToken);
                if (refreshed) {
                    return this.user;
                }
            }
            await this.signOut();
            return null;
        }
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
        const user = await this.getUser();
        return user !== null;
    }

    // ========================================
    // BOOKMARKS SYNC
    // ========================================

    /**
     * Push local bookmarks to cloud
     * @param {Array} bookmarks - Local bookmarks to upload
     */
    async pushBookmarks(bookmarks) {
        const user = await this.getUser();
        if (!user) {
            throw new Error('Please sign in to sync bookmarks');
        }

        // Prepare bookmarks with user_id
        const records = bookmarks.map(b => ({
            id: b.id,
            user_id: user.id,
            url: b.url,
            title: b.title,
            intent: b.intent,
            favicon: b.favicon,
            created_at: b.createdAt,
            updated_at: b.updatedAt,
            visited_count: b.visitedCount || 0,
            last_visited_at: b.lastVisitedAt,
            tags: b.tags || [],
            is_archived: b.isArchived || false,
        }));

        // Upsert bookmarks (insert or update on conflict)
        await this.request('/rest/v1/bookmarks', {
            method: 'POST',
            headers: {
                'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify(records),
        });

        return { synced: records.length };
    }

    /**
     * Pull bookmarks from cloud
     * @returns {Promise<Array>} Cloud bookmarks
     */
    async pullBookmarks() {
        const user = await this.getUser();
        if (!user) {
            throw new Error('Please sign in to sync bookmarks');
        }

        const data = await this.request(
            '/rest/v1/bookmarks?select=*&order=created_at.desc'
        );

        // Transform to local format
        return data.map(b => ({
            id: b.id,
            url: b.url,
            title: b.title,
            intent: b.intent,
            favicon: b.favicon,
            createdAt: b.created_at,
            updatedAt: b.updated_at,
            visitedCount: b.visited_count,
            lastVisitedAt: b.last_visited_at,
            tags: b.tags || [],
            isArchived: b.is_archived,
            synced: true,
        }));
    }

    /**
     * Delete bookmark from cloud
     * @param {string} id - Bookmark ID to delete
     */
    async deleteBookmark(id) {
        const user = await this.getUser();
        if (!user) {
            throw new Error('Please sign in to delete synced bookmarks');
        }

        await this.request(`/rest/v1/bookmarks?id=eq.${id}`, {
            method: 'DELETE',
        });
    }

    /**
     * Full sync: merge local and cloud bookmarks
     * @param {Array} localBookmarks - Current local bookmarks
     * @returns {Promise<Array>} Merged bookmarks
     */
    async syncBookmarks(localBookmarks) {
        const user = await this.getUser();
        if (!user) {
            throw new Error('Please sign in to sync');
        }

        // Pull cloud bookmarks
        const cloudBookmarks = await this.pullBookmarks();

        // Create lookup maps
        const localMap = new Map(localBookmarks.map(b => [b.id, b]));
        const cloudMap = new Map(cloudBookmarks.map(b => [b.id, b]));

        const merged = [];
        const toUpload = [];

        // Get all unique bookmark IDs
        const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

        for (const id of allIds) {
            const local = localMap.get(id);
            const cloud = cloudMap.get(id);

            if (local && cloud) {
                // Both exist: keep the newer one
                const localTime = new Date(local.updatedAt).getTime();
                const cloudTime = new Date(cloud.updatedAt).getTime();

                if (localTime > cloudTime) {
                    merged.push({ ...local, synced: true });
                    toUpload.push(local);
                } else {
                    merged.push({ ...cloud, synced: true });
                }
            } else if (local && !local.synced) {
                // Only local (new): upload and keep
                merged.push({ ...local, synced: true });
                toUpload.push(local);
            } else if (local) {
                // Local but was synced (deleted from cloud?)
                // Keep local, re-upload
                merged.push({ ...local, synced: true });
                toUpload.push(local);
            } else if (cloud) {
                // Only cloud: download to local
                merged.push(cloud);
            }
        }

        // Upload new/updated bookmarks
        if (toUpload.length > 0) {
            await this.pushBookmarks(toUpload);
        }

        return merged;
    }

    // ========================================
    // UTILITIES
    // ========================================

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

let supabaseInstance = null;

/**
 * Get Supabase client instance
 * @returns {SupabaseClient|null} Client or null if not configured
 */
export function getSupabase() {
    if (!isConfigured()) {
        console.warn('Intent: Supabase not configured. Copy config.example.js to config.js');
        return null;
    }

    if (!supabaseInstance) {
        supabaseInstance = new SupabaseClient();
    }

    return supabaseInstance;
}

export { isConfigured };

// ========================================
// SUPABASE SQL SCHEMA
// ========================================

/*
Run this SQL in your Supabase SQL Editor to set up the database:

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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS bookmarks_url_idx ON bookmarks(url);
CREATE INDEX IF NOT EXISTS bookmarks_created_at_idx ON bookmarks(created_at DESC);

-- Enable Row Level Security (CRITICAL for security!)
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own bookmarks
CREATE POLICY "Users can view own bookmarks" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can only insert their own bookmarks
CREATE POLICY "Users can insert own bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own bookmarks
CREATE POLICY "Users can update own bookmarks" ON bookmarks
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can only delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks" ON bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp
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
*/

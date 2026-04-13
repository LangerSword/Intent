/**
 * Intent - Configuration Template
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to config.js in the same directory
 * 2. Replace the placeholder values with your GitHub credentials
 * 3. config.js is gitignored and will not be committed to version control
 * 
 * GET YOUR CREDENTIALS:
 * 1. Go to GitHub > Settings > Developer settings > Personal access tokens
 * 2. Generate new token (classic) with 'gist' scope
 * 3. Copy the token (you won't see it again)
 */

export const CONFIG = {
    // Your GitHub Personal Access Token (with gist scope)
    GITHUB_TOKEN: 'YOUR_GITHUB_TOKEN',

    // Your GitHub username (optional, for verification)
    GITHUB_USERNAME: '',

    // App metadata
    APP_NAME: 'Intent',
    APP_VERSION: '1.0.0',
};

/**
 * Check if GitHub sync is properly configured
 * @returns {boolean} True if configured with valid credentials
 */
export function isConfigured() {
    return (
        CONFIG.GITHUB_TOKEN !== 'YOUR_GITHUB_TOKEN' &&
        CONFIG.GITHUB_TOKEN.length > 0
    );
}
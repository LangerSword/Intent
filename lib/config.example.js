/**
 * Intent - Configuration Template
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to config.js in the same directory
 * 2. Replace the placeholder values with your Supabase credentials
 * 3. config.js is gitignored and will not be committed to version control
 * 
 * GET YOUR CREDENTIALS:
 * 1. Create a project at https://supabase.com (free tier available)
 * 2. Go to Settings > API
 * 3. Copy your Project URL and anon/public key
 * 
 * SECURITY NOTE:
 * The anon key is designed for client-side use and is safe to include.
 * Row Level Security (RLS) in the database protects user data.
 * Never expose your service_role key.
 */

export const CONFIG = {
    // Your Supabase project URL
    // Example: 'https://abcdefghijklmnop.supabase.co'
    SUPABASE_URL: 'YOUR_SUPABASE_URL',

    // Your Supabase anon/public key (NOT the service_role key)
    // Found in: Supabase Dashboard > Settings > API > anon public
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',

    // App metadata
    APP_NAME: 'Intent',
    APP_VERSION: '1.0.0',
};

/**
 * Check if Supabase is properly configured
 * @returns {boolean} True if configured with valid credentials
 */
export function isConfigured() {
    return (
        CONFIG.SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
        CONFIG.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
        CONFIG.SUPABASE_URL.includes('.supabase.co')
    );
}

/**
 * Rate Limiting Utility
 *
 * Persistent rate limiting using Supabase database.
 * Falls back to in-memory for development/testing.
 */

const { createClient } = require('@supabase/supabase-js');

// SECURITY: Rate limiting configuration
// These values protect against brute force attacks
const MAX_ATTEMPTS_PER_EMAIL = 5;      // 5 attempts per email
const MAX_ATTEMPTS_PER_IP = 50;        // 50 attempts per IP (allows multiple users)
const LOCKOUT_DURATION_MINUTES = 15;   // 15 minute lockout
const DB_TIMEOUT_MS = 5000; // 5 second timeout for DB operations

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operation - Operation name for error message
 * @returns {Promise}
 */
function withTimeout(promise, ms, operation = 'Operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
        )
    ]);
}

// In-memory fallback for development/testing
const memoryStore = new Map();

// Lazy-loaded Supabase client
let supabase = null;
function getClient() {
    if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
    }
    return supabase;
}

/**
 * Check if database rate limiting is available
 */
function isDatabaseAvailable() {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

/**
 * Check rate limit using database
 * @param {string} key - Rate limit key (email:xxx or ip:xxx)
 * @param {number} maxAttempts - Maximum allowed attempts
 * @returns {Promise<{allowed: boolean, retryAfter: number|null, attempts: number}>}
 */
async function checkRateLimitDb(key, maxAttempts) {
    const client = getClient();
    if (!client) {
        return checkRateLimitMemory(key, maxAttempts);
    }

    try {
        const { data, error } = await withTimeout(
            client.rpc('check_rate_limit', {
                p_key: key,
                p_max_attempts: maxAttempts,
                p_lockout_minutes: LOCKOUT_DURATION_MINUTES
            }),
            DB_TIMEOUT_MS,
            'Rate limit check'
        );

        if (error) {
            console.error('Rate limit check error:', error);
            // Fall back to memory on error
            return checkRateLimitMemory(key, maxAttempts);
        }

        const result = data[0];
        return {
            allowed: result.allowed,
            retryAfter: result.allowed ? null : result.retry_after_seconds,
            attempts: result.current_attempts
        };
    } catch (err) {
        console.error('Rate limit exception:', err.message);
        return checkRateLimitMemory(key, maxAttempts);
    }
}

/**
 * Record failed attempt in database
 * @param {string} key - Rate limit key
 * @returns {Promise<number>} - Current attempt count
 */
async function recordFailedAttemptDb(key) {
    const client = getClient();
    if (!client) {
        return recordFailedAttemptMemory(key);
    }

    try {
        const { data, error } = await withTimeout(
            client.rpc('record_failed_attempt', {
                p_key: key,
                p_lockout_minutes: LOCKOUT_DURATION_MINUTES
            }),
            DB_TIMEOUT_MS,
            'Record failed attempt'
        );

        if (error) {
            console.error('Record attempt error:', error);
            return recordFailedAttemptMemory(key);
        }

        return data;
    } catch (err) {
        console.error('Record attempt exception:', err.message);
        return recordFailedAttemptMemory(key);
    }
}

/**
 * Clear rate limit in database
 * @param {string} key - Rate limit key
 */
async function clearRateLimitDb(key) {
    const client = getClient();
    if (!client) {
        return clearRateLimitMemory(key);
    }

    try {
        await withTimeout(
            client.rpc('clear_rate_limit', { p_key: key }),
            DB_TIMEOUT_MS,
            'Clear rate limit'
        );
    } catch (err) {
        console.error('Clear rate limit error:', err.message);
        clearRateLimitMemory(key);
    }
}

// ============================================
// In-Memory Fallback Functions
// ============================================

function checkRateLimitMemory(key, maxAttempts) {
    const now = Date.now();
    const data = memoryStore.get(key);

    // Clean expired
    if (data && data.resetAt < now) {
        memoryStore.delete(key);
        return { allowed: true, retryAfter: null, attempts: 0 };
    }

    if (!data) {
        return { allowed: true, retryAfter: null, attempts: 0 };
    }

    if (data.attempts >= maxAttempts) {
        return {
            allowed: false,
            retryAfter: Math.ceil((data.resetAt - now) / 1000),
            attempts: data.attempts
        };
    }

    return { allowed: true, retryAfter: null, attempts: data.attempts };
}

function recordFailedAttemptMemory(key) {
    const now = Date.now();
    const resetAt = now + (LOCKOUT_DURATION_MINUTES * 60 * 1000);

    const existing = memoryStore.get(key);
    if (existing && existing.resetAt > now) {
        existing.attempts++;
        memoryStore.set(key, existing);
        return existing.attempts;
    }

    memoryStore.set(key, { attempts: 1, resetAt });
    return 1;
}

function clearRateLimitMemory(key) {
    memoryStore.delete(key);
}

// ============================================
// Public API
// ============================================

/**
 * Check rate limit for email and IP
 * @param {string} email - User email
 * @param {string} ip - Client IP address
 * @returns {Promise<{allowed: boolean, retryAfter: number|null}>}
 */
async function checkRateLimit(email, ip) {
    const emailKey = `email:${email.toLowerCase()}`;
    const ipKey = `ip:${ip}`;

    // Check both email and IP limits
    const [emailCheck, ipCheck] = await Promise.all([
        checkRateLimitDb(emailKey, MAX_ATTEMPTS_PER_EMAIL),
        checkRateLimitDb(ipKey, MAX_ATTEMPTS_PER_IP)
    ]);

    // If either is blocked, return blocked
    if (!emailCheck.allowed) {
        return { allowed: false, retryAfter: emailCheck.retryAfter };
    }
    if (!ipCheck.allowed) {
        return { allowed: false, retryAfter: ipCheck.retryAfter };
    }

    return { allowed: true, retryAfter: null };
}

/**
 * Record failed login attempt for email and IP
 * @param {string} email - User email
 * @param {string} ip - Client IP address
 */
async function recordFailedAttempt(email, ip) {
    const emailKey = `email:${email.toLowerCase()}`;
    const ipKey = `ip:${ip}`;

    await Promise.all([
        recordFailedAttemptDb(emailKey),
        recordFailedAttemptDb(ipKey)
    ]);
}

/**
 * Clear rate limit on successful login
 * @param {string} email - User email
 */
async function clearRateLimit(email) {
    const emailKey = `email:${email.toLowerCase()}`;
    await clearRateLimitDb(emailKey);
}

module.exports = {
    checkRateLimit,
    recordFailedAttempt,
    clearRateLimit,
    isDatabaseAvailable,
    // Export constants for testing
    MAX_ATTEMPTS_PER_EMAIL,
    MAX_ATTEMPTS_PER_IP,
    LOCKOUT_DURATION_MINUTES
};

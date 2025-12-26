/**
 * Admin Password Reset Utility
 * POST /api/reset-admin-password
 *
 * Use this to reset an admin password without SQL
 * Requires a secret key for security (MUST be set in environment)
 */

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

// SECURITY: No fallback - secret MUST be configured
const RESET_SECRET = process.env.ADMIN_RESET_SECRET;
const BCRYPT_ROUNDS = 12;

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    process.env.SITE_URL,
    process.env.URL,
    'http://localhost:8888',
    'http://localhost:3000'
].filter(Boolean);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Simple in-memory rate limiting for this endpoint
const resetAttempts = new Map();
const MAX_RESET_ATTEMPTS = 3;
const RESET_LOCKOUT_MINUTES = 60;

function checkResetRateLimit(ip) {
    const now = Date.now();
    const key = `reset:${ip}`;
    const record = resetAttempts.get(key);

    if (!record || record.resetAt <= now) {
        return { allowed: true };
    }

    if (record.attempts >= MAX_RESET_ATTEMPTS) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return { allowed: false, retryAfter };
    }

    return { allowed: true };
}

function recordResetAttempt(ip) {
    const now = Date.now();
    const key = `reset:${ip}`;
    const record = resetAttempts.get(key);
    const resetAt = now + (RESET_LOCKOUT_MINUTES * 60 * 1000);

    if (!record || record.resetAt <= now) {
        resetAttempts.set(key, { attempts: 1, resetAt });
    } else {
        record.attempts++;
    }
}

function getCorsOrigin(requestOrigin) {
    if (ALLOWED_ORIGINS.includes(requestOrigin)) {
        return requestOrigin;
    }
    return ALLOWED_ORIGINS[0] || 'http://localhost:8888';
}

exports.handler = async (event) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     event.headers['client-ip'] ||
                     'unknown';

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getCorsOrigin(requestOrigin),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // SECURITY: Require environment variable - no fallback
    if (!RESET_SECRET) {
        console.error('ADMIN_RESET_SECRET not configured');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Reset functionality not configured' })
        };
    }

    // Check rate limit
    const rateCheck = checkResetRateLimit(clientIP);
    if (!rateCheck.allowed) {
        return {
            statusCode: 429,
            headers,
            body: JSON.stringify({
                error: 'Too many reset attempts. Try again later.',
                retryAfter: rateCheck.retryAfter
            })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { email, newPassword, secret } = body;

        // Record attempt before validation
        recordResetAttempt(clientIP);

        // Verify secret with timing-safe comparison
        if (!secret || secret.length !== RESET_SECRET.length ||
            !require('crypto').timingSafeEqual(
                Buffer.from(secret),
                Buffer.from(RESET_SECRET)
            )) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Invalid secret key' })
            };
        }

        if (!email || !newPassword) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Email and newPassword required' })
            };
        }

        // Strong password validation (same as admin-users.js)
        if (newPassword.length < 8) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Password must be at least 8 characters' })
            };
        }

        // Validate password complexity
        const hasUppercase = /[A-Z]/.test(newPassword);
        const hasLowercase = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

        if (!hasUppercase || !hasLowercase || !hasNumber) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Password must contain uppercase, lowercase, and number'
                })
            };
        }

        // Generate bcrypt hash with consistent rounds
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

        // SECURITY: Only update existing users, never create
        const { data, error } = await supabase
            .from('admin_users')
            .update({
                password_hash: passwordHash
            })
            .eq('email', email.toLowerCase())
            .select('id, email, name, role')
            .single();

        if (error || !data) {
            // Don't reveal if user exists or not
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Password reset failed' })
            };
        }

        // Clear any rate limits for this email
        await supabase
            .from('rate_limits')
            .delete()
            .eq('key', `email:${email.toLowerCase()}`);

        // Audit log the reset
        try {
            await supabase.from('audit_logs').insert({
                user_id: data.id,
                user_email: data.email,
                action: 'password_reset',
                resource_type: 'admin_user',
                resource_id: data.id.toString(),
                ip_address: clientIP,
                details: { method: 'admin_reset_endpoint' }
            });
        } catch (auditError) {
            console.error('Failed to log password reset:', auditError);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Password reset successful'
            })
        };

    } catch (error) {
        console.error('Password reset error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'An error occurred' })
        };
    }
};

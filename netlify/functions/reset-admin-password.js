/**
 * Admin Password Reset Utility
 * POST /api/reset-admin-password
 *
 * Two modes:
 * 1. Email mode (action: 'request') - sends reset email with token
 * 2. Direct mode (with secret) - immediate reset (requires ADMIN_RESET_SECRET)
 *
 * POST /api/reset-admin-password?action=request - Request password reset email
 * POST /api/reset-admin-password?action=reset - Complete reset with token
 * POST /api/reset-admin-password - Direct reset with secret (legacy)
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const { sendAdminPasswordReset } = require('./utils/email');

// SECURITY: No fallback - secret MUST be configured
const RESET_SECRET = process.env.ADMIN_RESET_SECRET;
const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_MINUTES = 60;

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

    const params = event.queryStringParameters || {};

    try {
        const body = JSON.parse(event.body);

        // Handle email-based reset request
        if (params.action === 'request') {
            const { email } = body;

            if (!email) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Email required' })
                };
            }

            recordResetAttempt(clientIP);

            // Check if user exists (but always return success to prevent enumeration)
            const { data: user } = await supabase
                .from('admin_users')
                .select('id, email, name')
                .eq('email', email.toLowerCase())
                .single();

            if (user) {
                // Generate secure reset token
                const resetToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

                // Store token in database
                await supabase
                    .from('admin_users')
                    .update({
                        reset_token: resetToken,
                        reset_token_expires: expiresAt.toISOString()
                    })
                    .eq('id', user.id);

                // Build reset URL
                const siteUrl = process.env.URL || process.env.SITE_URL || 'http://localhost:8888';
                const resetUrl = `${siteUrl}/admin/reset-password.html?token=${resetToken}`;

                // Send email
                const emailResult = await sendAdminPasswordReset(user.email, resetUrl, RESET_TOKEN_EXPIRY_MINUTES);
                if (emailResult.success) {
                    console.log('Password reset email sent to:', user.email);
                } else {
                    console.error('Password reset email failed:', emailResult.error);
                }
            }

            // Always return success to prevent email enumeration
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'If an account exists with this email, you will receive a password reset link.'
                })
            };
        }

        // Handle token-based reset completion
        if (params.action === 'reset') {
            const { token, newPassword } = body;

            if (!token || !newPassword) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Token and newPassword required' })
                };
            }

            recordResetAttempt(clientIP);

            // Validate password strength
            if (newPassword.length < 8) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Password must be at least 8 characters' })
                };
            }

            const hasUppercase = /[A-Z]/.test(newPassword);
            const hasLowercase = /[a-z]/.test(newPassword);
            const hasNumber = /[0-9]/.test(newPassword);

            if (!hasUppercase || !hasLowercase || !hasNumber) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Password must contain uppercase, lowercase, and number'
                    })
                };
            }

            // Find user with valid token
            const { data: user, error: findError } = await supabase
                .from('admin_users')
                .select('id, email, name, reset_token_expires')
                .eq('reset_token', token)
                .single();

            if (findError || !user) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid or expired reset token' })
                };
            }

            // Check if token is expired
            if (new Date(user.reset_token_expires) < new Date()) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Reset token has expired. Please request a new one.' })
                };
            }

            // Hash new password and update
            const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

            const { error: updateError } = await supabase
                .from('admin_users')
                .update({
                    password_hash: passwordHash,
                    reset_token: null,
                    reset_token_expires: null
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('Password update error:', updateError);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Failed to reset password' })
                };
            }

            // Clear rate limits
            await supabase
                .from('rate_limits')
                .delete()
                .eq('key', `email:${user.email.toLowerCase()}`);

            // Audit log
            try {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    user_email: user.email,
                    action: 'password_reset',
                    resource_type: 'admin_user',
                    resource_id: user.id.toString(),
                    ip_address: clientIP,
                    details: { method: 'email_token' }
                });
            } catch (auditError) {
                console.error('Failed to log password reset:', auditError);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Password reset successful. You can now log in.'
                })
            };
        }

        // Legacy direct reset with secret
        const { email, newPassword, secret } = body;

        // Record attempt before validation
        recordResetAttempt(clientIP);

        // SECURITY: Require environment variable - no fallback
        if (!RESET_SECRET) {
            console.error('ADMIN_RESET_SECRET not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Direct reset not configured. Use email reset instead.' })
            };
        }

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

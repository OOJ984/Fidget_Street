/**
 * Admin Password Reset Utility
 * POST /api/reset-admin-password
 *
 * Use this to reset an admin password without SQL
 * Requires a secret key for security
 */

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const RESET_SECRET = process.env.ADMIN_RESET_SECRET || 'fidget-reset-2024';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
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

    try {
        const body = JSON.parse(event.body);
        const { email, newPassword, secret } = body;

        // Verify secret
        if (secret !== RESET_SECRET) {
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

        if (newPassword.length < 6) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Password must be at least 6 characters' })
            };
        }

        // Generate bcrypt hash
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update user
        const { data, error } = await supabase
            .from('admin_users')
            .update({
                password_hash: passwordHash,
                role: 'website_admin',
                is_active: true
            })
            .eq('email', email.toLowerCase())
            .select('id, email, name, role')
            .single();

        if (error || !data) {
            // Try to create user if doesn't exist
            const { data: newUser, error: createError } = await supabase
                .from('admin_users')
                .insert({
                    email: email.toLowerCase(),
                    password_hash: passwordHash,
                    name: 'Admin',
                    role: 'website_admin',
                    is_active: true
                })
                .select('id, email, name, role')
                .single();

            if (createError) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Failed to update/create user', details: createError.message })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Admin user created',
                    user: newUser
                })
            };
        }

        // Clear any rate limits for this email
        await supabase
            .from('rate_limits')
            .delete()
            .eq('key', `email:${email.toLowerCase()}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Password reset successful',
                user: data
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

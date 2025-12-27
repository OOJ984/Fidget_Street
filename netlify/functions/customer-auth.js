/**
 * Customer Authentication API
 * POST /api/customer-auth - Request magic link
 * GET /api/customer-auth?token=xxx - Verify magic link token
 *
 * Passwordless authentication for customers to view their orders.
 * No account required - just email verification.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    errorResponse,
    successResponse
} = require('./utils/security');
const { sendMagicLink } = require('./utils/email');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;
const MAGIC_LINK_EXPIRY = 15 * 60 * 1000; // 15 minutes
const CUSTOMER_SESSION_EXPIRY = '24h'; // Reduced from 7d for security

// Rate limiting (in-memory, resets on cold start)
const rateLimits = new Map();
const RATE_LIMIT = {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000 // 1 hour
};

function checkRateLimit(email) {
    const now = Date.now();
    const key = email.toLowerCase();
    const record = rateLimits.get(key);

    if (!record || now - record.firstAttempt > RATE_LIMIT.windowMs) {
        rateLimits.set(key, { count: 1, firstAttempt: now });
        return true;
    }

    if (record.count >= RATE_LIMIT.maxRequests) {
        return false;
    }

    record.count++;
    return true;
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'POST', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!JWT_SECRET) {
        console.error('JWT_SECRET not configured');
        return errorResponse(500, 'Server configuration error', headers);
    }

    try {
        // POST - Request magic link
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { email } = body;

            if (!email) {
                return errorResponse(400, 'Email is required', headers);
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return errorResponse(400, 'Invalid email format', headers);
            }

            const normalizedEmail = email.toLowerCase().trim();

            // Rate limit check
            if (!checkRateLimit(normalizedEmail)) {
                return {
                    statusCode: 429,
                    headers: { ...headers, 'Retry-After': '3600' },
                    body: JSON.stringify({ error: 'Too many requests. Please try again later.' })
                };
            }

            // Check if customer has any orders
            const { data: orders, error: orderError } = await supabase
                .from('orders')
                .select('id')
                .eq('customer_email', normalizedEmail)
                .limit(1);

            if (orderError) throw orderError;

            // Always return success (prevent email enumeration)
            // But only actually send if orders exist
            if (!orders || orders.length === 0) {
                // No orders - still return success but don't send email
                console.log(`Magic link requested for ${normalizedEmail} - no orders found`);
                return successResponse({
                    success: true,
                    message: 'If you have orders with us, you will receive an email shortly.'
                }, headers);
            }

            // Generate magic link token
            const token = generateToken();
            const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY);

            // Store or update customer record
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .eq('email', normalizedEmail)
                .single();

            if (existingCustomer) {
                await supabase
                    .from('customers')
                    .update({
                        magic_link_token: token,
                        magic_link_expires: expiresAt.toISOString()
                    })
                    .eq('id', existingCustomer.id);
            } else {
                await supabase
                    .from('customers')
                    .insert([{
                        email: normalizedEmail,
                        magic_link_token: token,
                        magic_link_expires: expiresAt.toISOString()
                    }]);
            }

            // Build magic link URL
            const siteUrl = process.env.URL || process.env.SITE_URL || 'http://localhost:8888';
            const magicLinkUrl = `${siteUrl}/account/verify.html?token=${token}`;

            // Send email using centralized email utility
            const emailResult = await sendMagicLink(normalizedEmail, magicLinkUrl);

            if (!emailResult.success) {
                console.error('Failed to send magic link email:', emailResult.error);
                // Still return success to prevent enumeration
            }

            return successResponse({
                success: true,
                message: 'If you have orders with us, you will receive an email shortly.'
            }, headers);
        }

        // GET - Verify magic link token
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};
            const { token } = params;

            if (!token) {
                return errorResponse(400, 'Token is required', headers);
            }

            // Find customer with this token
            const { data: customer, error } = await supabase
                .from('customers')
                .select('id, email, magic_link_expires')
                .eq('magic_link_token', token)
                .single();

            if (error || !customer) {
                return errorResponse(400, 'Invalid or expired link', headers);
            }

            // Check expiry
            if (new Date(customer.magic_link_expires) < new Date()) {
                return errorResponse(400, 'This link has expired. Please request a new one.', headers);
            }

            // Clear the token (single use)
            await supabase
                .from('customers')
                .update({
                    magic_link_token: null,
                    magic_link_expires: null,
                    is_verified: true,
                    last_login: new Date().toISOString()
                })
                .eq('id', customer.id);

            // Generate customer session JWT
            const sessionToken = jwt.sign(
                {
                    customerId: customer.id,
                    email: customer.email,
                    type: 'customer'
                },
                JWT_SECRET,
                { expiresIn: CUSTOMER_SESSION_EXPIRY }
            );

            return successResponse({
                success: true,
                token: sessionToken,
                email: customer.email
            }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Customer auth error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

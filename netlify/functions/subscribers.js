/**
 * Newsletter Subscribers Management API
 * GET /api/subscribers - Get all subscribers (admin only)
 * DELETE /api/subscribers - Unsubscribe an email
 */

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Verify admin token
function verifyToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    try {
        const token = authHeader.split(' ')[1];
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return null;
    }
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // GET - Fetch all subscribers (admin only)
    if (event.httpMethod === 'GET') {
        // Verify admin token
        const user = verifyToken(event.headers.authorization);
        if (!user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        try {
            const { data, error } = await supabase
                .from('newsletter_subscribers')
                .select('*')
                .order('subscribed_at', { ascending: false });

            if (error) throw error;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data || [])
            };

        } catch (error) {
            console.error('Fetch subscribers error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to fetch subscribers' })
            };
        }
    }

    // DELETE - Unsubscribe an email
    if (event.httpMethod === 'DELETE') {
        try {
            const { email, token: unsubToken } = JSON.parse(event.body || '{}');

            // Admin can unsubscribe anyone with auth token
            const user = verifyToken(event.headers.authorization);

            // If no admin auth, require unsubscribe token (for user self-unsubscribe)
            if (!user && !unsubToken) {
                // Public unsubscribe by email only (simple version)
                if (!email) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Email is required' })
                    };
                }
            }

            if (!email) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Email is required' })
                };
            }

            // Update to inactive (soft delete)
            const { error } = await supabase
                .from('newsletter_subscribers')
                .update({
                    is_active: false,
                    unsubscribed_at: new Date().toISOString()
                })
                .eq('email', email.toLowerCase());

            if (error) throw error;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Successfully unsubscribed'
                })
            };

        } catch (error) {
            console.error('Unsubscribe error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to unsubscribe' })
            };
        }
    }

    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};

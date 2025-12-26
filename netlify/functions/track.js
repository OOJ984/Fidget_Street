/**
 * Page View Tracking API
 * POST /api/track - Record a page view
 *
 * Lightweight, privacy-friendly analytics
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Simple device detection
function getDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)) {
        return /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
    }
    return 'desktop';
}

// Generate session ID (stored in cookie on client)
function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substring(2, 15);
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
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
        const body = JSON.parse(event.body || '{}');
        const { path, title, referrer, sessionId } = body;

        if (!path) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Path is required' })
            };
        }

        // Get device type from user agent
        const userAgent = event.headers['user-agent'] || '';
        const deviceType = getDeviceType(userAgent);

        // Get country from Netlify geo headers (if available)
        const country = event.headers['x-country'] ||
                       event.headers['x-nf-country'] ||
                       null;

        // Record page view
        const { error } = await supabase
            .from('page_views')
            .insert([{
                page_path: path,
                page_title: title || null,
                referrer: referrer || null,
                country: country,
                device_type: deviceType,
                session_id: sessionId || generateSessionId()
            }]);

        if (error) {
            console.error('Track error:', error);
            throw error;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error('Track error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to track' })
        };
    }
};

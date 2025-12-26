/**
 * Supabase Public Config API
 * Returns the public Supabase URL and anon key for frontend use
 * These are intentionally public - security is handled by Row Level Security
 */

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const { getCorsHeaders } = require('./utils/security');
    const corsHeaders = getCorsHeaders(requestOrigin, ['GET', 'OPTIONS']);
    const headers = {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Return public Supabase config from environment variables
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            url: process.env.SUPABASE_URL,
            anonKey: process.env.SUPABASE_ANON_KEY
        })
    };
};

/**
 * Public Sizes API
 * GET /api/sizes - List all sizes (public, for dropdowns)
 */

const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    errorResponse,
    successResponse
} = require('./utils/security');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return errorResponse(405, 'Method not allowed', headers);
    }

    try {
        // Try normal query first
        let { data, error } = await supabase
            .from('sizes')
            .select('id, name, short_code, display_order')
            .order('display_order', { ascending: true })
            .order('name', { ascending: true });

        // If schema cache error, use raw SQL as fallback
        if (error && error.code === 'PGRST205') {
            console.log('Schema cache miss, using raw SQL fallback');
            const result = await supabase.rpc('get_all_sizes');
            if (result.error) {
                return successResponse([], headers);
            }
            data = result.data;
            error = null;
        }

        if (error) throw error;

        return successResponse(data, headers);

    } catch (error) {
        console.error('Sizes API error:', error);
        return errorResponse(500, error.message || 'Internal server error', headers);
    }
};

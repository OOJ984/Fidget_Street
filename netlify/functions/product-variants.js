/**
 * Public Product Variants API
 * GET /api/product-variants?product_id=X - Get variants for a product
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
        const params = event.queryStringParameters || {};
        const productId = params.product_id;

        if (!productId) {
            return errorResponse(400, 'product_id is required', headers);
        }

        // Get variants with color and size details
        const { data, error } = await supabase
            .from('product_variants')
            .select(`
                id,
                sku,
                price_adjustment,
                stock,
                is_available,
                images,
                color:colors(id, name, hex_code),
                size:sizes(id, name, short_code)
            `)
            .eq('product_id', productId)
            .eq('is_available', true)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Format response - extract color/size from nested objects
        const formattedData = (data || []).map(variant => ({
            id: variant.id,
            sku: variant.sku,
            price_adjustment: parseFloat(variant.price_adjustment) || 0,
            stock: variant.stock,
            is_available: variant.is_available,
            images: variant.images || [],
            color_id: variant.color?.id || null,
            color_name: variant.color?.name || null,
            color_hex: variant.color?.hex_code || null,
            size_id: variant.size?.id || null,
            size_name: variant.size?.name || null,
            size_code: variant.size?.short_code || null
        }));

        return successResponse(formattedData, headers);

    } catch (error) {
        console.error('Product Variants API error:', error);
        return errorResponse(500, error.message || 'Internal server error', headers);
    }
};

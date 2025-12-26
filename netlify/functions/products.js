/**
 * Products API
 * GET /api/products - List all products
 * GET /api/products?slug=xxx - Get single product
 * GET /api/products?category=xxx - Filter by category
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
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

    try {
        const params = event.queryStringParameters || {};

        // Single product by slug - full details for product page
        if (params.slug) {
            const { data, error } = await supabase
                .from('products')
                .select('id, title, slug, price_gbp, currency, category, materials, dimensions, variations, stock, tags, description, images, variation_images')
                .eq('slug', params.slug)
                .eq('is_active', true)
                .single();

            if (error) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Product not found' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data)
            };
        }

        // Build query for product list
        let query = supabase
            .from('products')
            .select('id, title, slug, price_gbp, currency, category, tags, images, stock, description, dimensions, variations, variation_images')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        // Filter by category
        if (params.category) {
            query = query.eq('category', params.category);
        }

        // Filter by tag
        if (params.tag) {
            query = query.contains('tags', [params.tag]);
        }

        // Filter featured only
        if (params.featured === 'true') {
            query = query.contains('tags', ['featured']);
        }

        // Limit results
        if (params.limit) {
            query = query.limit(parseInt(params.limit, 10));
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Products API error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

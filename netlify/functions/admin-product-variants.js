/**
 * Admin Product Variants API
 * GET /api/admin-product-variants?product_id=X - List variants for a product
 * POST /api/admin-product-variants - Create variant
 * PUT /api/admin-product-variants - Update variant
 * DELETE /api/admin-product-variants - Delete variant
 */

const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    verifyToken,
    isSecretConfigured,
    errorResponse,
    successResponse,
    requirePermission,
    PERMISSIONS,
    auditLog
} = require('./utils/security');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Check server configuration
    if (!isSecretConfigured()) {
        console.error('JWT_SECRET not configured');
        return errorResponse(500, 'Server configuration error', headers);
    }

    // Verify authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    if (!user) {
        return errorResponse(401, 'Unauthorized', headers);
    }

    // All variant management requires EDIT_PRODUCTS permission
    const permError = requirePermission(user, PERMISSIONS.EDIT_PRODUCTS, headers);
    if (permError) return permError;

    try {
        // GET - List variants for a product
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};
            const productId = params.product_id;

            if (!productId) {
                return errorResponse(400, 'product_id is required', headers);
            }

            const { data, error } = await supabase
                .from('product_variants')
                .select(`
                    *,
                    color:colors(id, name, hex_code),
                    size:sizes(id, name, short_code)
                `)
                .eq('product_id', productId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            return successResponse(data, headers);
        }

        // POST - Create variant
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { product_id, color_id, size_id, sku, price_adjustment, stock, is_available, images } = body;

            if (!product_id) {
                return errorResponse(400, 'product_id is required', headers);
            }

            // Check for duplicate variant
            const { data: existing } = await supabase
                .from('product_variants')
                .select('id')
                .eq('product_id', product_id)
                .eq('color_id', color_id || null)
                .eq('size_id', size_id || null)
                .single();

            if (existing) {
                return errorResponse(400, 'A variant with this color/size combination already exists', headers);
            }

            // Create variant
            const { data, error } = await supabase
                .from('product_variants')
                .insert({
                    product_id,
                    color_id: color_id || null,
                    size_id: size_id || null,
                    sku: sku?.trim() || null,
                    price_adjustment: parseFloat(price_adjustment) || 0,
                    stock: parseInt(stock) || 0,
                    is_available: is_available !== false,
                    images: images || []
                })
                .select(`
                    *,
                    color:colors(id, name, hex_code),
                    size:sizes(id, name, short_code)
                `)
                .single();

            if (error) throw error;

            // Update product has_variants flag
            await supabase
                .from('products')
                .update({ has_variants: true })
                .eq('id', product_id);

            // Audit log
            await auditLog(supabase, {
                action: 'variant_created',
                user_id: user.id,
                user_email: user.email,
                details: { product_id, variant_id: data.id }
            });

            return successResponse(data, headers);
        }

        // PUT - Update variant
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body);
            const { id, color_id, size_id, sku, price_adjustment, stock, is_available, images } = body;

            if (!id) {
                return errorResponse(400, 'Variant ID is required', headers);
            }

            // Get current variant to check product_id
            const { data: current } = await supabase
                .from('product_variants')
                .select('product_id')
                .eq('id', id)
                .single();

            if (!current) {
                return errorResponse(404, 'Variant not found', headers);
            }

            // Check for duplicate if color/size changed
            const { data: existing } = await supabase
                .from('product_variants')
                .select('id')
                .eq('product_id', current.product_id)
                .eq('color_id', color_id || null)
                .eq('size_id', size_id || null)
                .neq('id', id)
                .single();

            if (existing) {
                return errorResponse(400, 'A variant with this color/size combination already exists', headers);
            }

            // Update variant
            const { data, error } = await supabase
                .from('product_variants')
                .update({
                    color_id: color_id || null,
                    size_id: size_id || null,
                    sku: sku?.trim() || null,
                    price_adjustment: parseFloat(price_adjustment) || 0,
                    stock: parseInt(stock) || 0,
                    is_available: is_available !== false,
                    images: images || []
                })
                .eq('id', id)
                .select(`
                    *,
                    color:colors(id, name, hex_code),
                    size:sizes(id, name, short_code)
                `)
                .single();

            if (error) throw error;

            // Audit log
            await auditLog(supabase, {
                action: 'variant_updated',
                user_id: user.id,
                user_email: user.email,
                details: { variant_id: id }
            });

            return successResponse(data, headers);
        }

        // DELETE - Delete variant
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body);
            const { id } = body;

            if (!id) {
                return errorResponse(400, 'Variant ID is required', headers);
            }

            // Get product_id before deleting
            const { data: variant } = await supabase
                .from('product_variants')
                .select('product_id')
                .eq('id', id)
                .single();

            // Delete variant
            const { error } = await supabase
                .from('product_variants')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Check if product still has variants
            if (variant) {
                const { count } = await supabase
                    .from('product_variants')
                    .select('id', { count: 'exact', head: true })
                    .eq('product_id', variant.product_id);

                if (count === 0) {
                    await supabase
                        .from('products')
                        .update({ has_variants: false })
                        .eq('id', variant.product_id);
                }
            }

            // Audit log
            await auditLog(supabase, {
                action: 'variant_deleted',
                user_id: user.id,
                user_email: user.email,
                details: { variant_id: id, product_id: variant?.product_id }
            });

            return successResponse({ success: true }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Product Variants API error:', error);
        return errorResponse(500, error.message || 'Internal server error', headers);
    }
};

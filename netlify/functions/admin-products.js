/**
 * Admin Products API
 * GET /api/admin-products - List all products (including inactive)
 * POST /api/admin-products - Create product
 * PUT /api/admin-products - Update product
 * DELETE /api/admin-products - Delete product
 *
 * Required permissions:
 * - GET: VIEW_PRODUCTS (business_processing, website_admin)
 * - POST: CREATE_PRODUCTS (business_processing, website_admin)
 * - PUT: EDIT_PRODUCTS (business_processing, website_admin)
 * - DELETE: DELETE_PRODUCTS (business_processing, website_admin)
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
    auditLog,
    AUDIT_ACTIONS
} = require('./utils/security');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Generate slug from title
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

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

    try {
        // GET - List all products
        if (event.httpMethod === 'GET') {
            // Check permission
            const permError = requirePermission(user, PERMISSIONS.VIEW_PRODUCTS, headers);
            if (permError) return permError;

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return successResponse(data, headers);
        }

        // POST - Create product
        if (event.httpMethod === 'POST') {
            // Check permission
            const permError = requirePermission(user, PERMISSIONS.CREATE_PRODUCTS, headers);
            if (permError) return permError;

            const body = JSON.parse(event.body);

            // Validate required fields
            if (!body.title || !body.price_gbp) {
                return errorResponse(400, 'Title and price required', headers);
            }

            const productData = {
                slug: body.slug || generateSlug(body.title),
                title: body.title,
                description: body.description || '',
                price_gbp: parseFloat(body.price_gbp),
                category: body.category || 'uncategorized',
                tags: body.tags || [],
                images: body.images || [],
                variation_images: body.variation_images || {},
                variations: body.variations || [],
                stock: body.stock || 0,
                is_active: body.is_active !== false
            };

            const { data, error } = await supabase
                .from('products')
                .insert([productData])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return errorResponse(400, 'Product with this slug already exists', headers);
                }
                throw error;
            }

            // Audit log - product created
            await auditLog({
                action: AUDIT_ACTIONS.PRODUCT_CREATED,
                user,
                resourceType: 'product',
                resourceId: data.id,
                details: { title: data.title, slug: data.slug, price: data.price_gbp },
                event
            });

            return successResponse(data, headers, 201);
        }

        // PUT - Update product
        if (event.httpMethod === 'PUT') {
            // Check permission
            const permError = requirePermission(user, PERMISSIONS.EDIT_PRODUCTS, headers);
            if (permError) return permError;

            const body = JSON.parse(event.body);
            const { id, ...updates } = body;

            if (!id) {
                return errorResponse(400, 'Product ID required', headers);
            }

            // Clean up updates
            const updateData = {};
            if (updates.title) updateData.title = updates.title;
            if (updates.slug) updateData.slug = updates.slug;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.price_gbp !== undefined) updateData.price_gbp = parseFloat(updates.price_gbp);
            if (updates.category) updateData.category = updates.category;
            if (updates.tags) updateData.tags = updates.tags;
            if (updates.images) updateData.images = updates.images;
            if (updates.variation_images !== undefined) updateData.variation_images = updates.variation_images;
            if (updates.variations) updateData.variations = updates.variations;
            if (updates.stock !== undefined) updateData.stock = parseInt(updates.stock, 10);
            if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
            updateData.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('products')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Audit log - product updated
            await auditLog({
                action: AUDIT_ACTIONS.PRODUCT_UPDATED,
                user,
                resourceType: 'product',
                resourceId: id,
                details: { updatedFields: Object.keys(updateData).filter(k => k !== 'updated_at') },
                event
            });

            return successResponse(data, headers);
        }

        // DELETE - Soft delete product
        if (event.httpMethod === 'DELETE') {
            // Check permission
            const permError = requirePermission(user, PERMISSIONS.DELETE_PRODUCTS, headers);
            if (permError) return permError;

            const params = event.queryStringParameters || {};
            const id = params.id;

            if (!id) {
                return errorResponse(400, 'Product ID required', headers);
            }

            // Soft delete by setting is_active to false
            const { error } = await supabase
                .from('products')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            // Audit log - product deleted
            await auditLog({
                action: AUDIT_ACTIONS.PRODUCT_DELETED,
                user,
                resourceType: 'product',
                resourceId: id,
                event
            });

            return successResponse({ success: true }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Admin products error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

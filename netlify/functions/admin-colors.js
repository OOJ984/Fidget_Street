/**
 * Admin Colors API
 * GET /api/admin-colors - List all colors
 * POST /api/admin-colors - Create new color
 * PUT /api/admin-colors - Update color
 * DELETE /api/admin-colors - Delete color
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

    // All colour management requires EDIT_PRODUCTS permission
    const permError = requirePermission(user, PERMISSIONS.EDIT_PRODUCTS, headers);
    if (permError) return permError;

    try {
        // GET - List all colors
        if (event.httpMethod === 'GET') {
            const { data, error } = await supabase
                .from('colors')
                .select('*')
                .order('display_order', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;

            return successResponse(data, headers);
        }

        // POST - Create new color
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { name, hex_code, in_stock, display_order } = body;

            // Validate required fields
            if (!name || !name.trim()) {
                return errorResponse(400, 'Color name is required', headers);
            }

            // Check if color already exists
            const { data: existing } = await supabase
                .from('colors')
                .select('id')
                .ilike('name', name.trim())
                .single();

            if (existing) {
                return errorResponse(400, 'A color with this name already exists', headers);
            }

            // Validate hex code format if provided
            if (hex_code && !/^#[0-9A-Fa-f]{6}$/.test(hex_code)) {
                return errorResponse(400, 'Invalid hex code format. Use #RRGGBB', headers);
            }

            // Create color
            const { data, error } = await supabase
                .from('colors')
                .insert({
                    name: name.trim(),
                    hex_code: hex_code || null,
                    in_stock: in_stock !== false,
                    display_order: display_order || 0
                })
                .select()
                .single();

            if (error) throw error;

            // Audit log
            await auditLog(supabase, {
                action: 'color_created',
                user_id: user.id,
                user_email: user.email,
                details: { color_name: name }
            });

            return successResponse(data, headers);
        }

        // PUT - Update color
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body);
            const { id, name, hex_code, in_stock, display_order } = body;

            if (!id) {
                return errorResponse(400, 'Color ID is required', headers);
            }

            if (!name || !name.trim()) {
                return errorResponse(400, 'Color name is required', headers);
            }

            // Check if name is taken by another color
            const { data: existing } = await supabase
                .from('colors')
                .select('id')
                .ilike('name', name.trim())
                .neq('id', id)
                .single();

            if (existing) {
                return errorResponse(400, 'A color with this name already exists', headers);
            }

            // Validate hex code format if provided
            if (hex_code && !/^#[0-9A-Fa-f]{6}$/.test(hex_code)) {
                return errorResponse(400, 'Invalid hex code format. Use #RRGGBB', headers);
            }

            // Get old color name for updating products
            const { data: oldColor } = await supabase
                .from('colors')
                .select('name')
                .eq('id', id)
                .single();

            const oldName = oldColor?.name;

            // Update color
            const { data, error } = await supabase
                .from('colors')
                .update({
                    name: name.trim(),
                    hex_code: hex_code || null,
                    in_stock: in_stock !== false,
                    display_order: display_order || 0
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // If name changed, update all products using this color
            if (oldName && oldName !== name.trim()) {
                // Get all products that have this color in their colors array
                const { data: products } = await supabase
                    .from('products')
                    .select('id, colors');

                // Update products that contain the old color name
                for (const product of products || []) {
                    if (product.colors && Array.isArray(product.colors)) {
                        const colorIndex = product.colors.indexOf(oldName);
                        if (colorIndex !== -1) {
                            const newColors = [...product.colors];
                            newColors[colorIndex] = name.trim();
                            await supabase
                                .from('products')
                                .update({ colors: newColors })
                                .eq('id', product.id);
                        }
                    }
                }
            }

            // Audit log
            await auditLog(supabase, {
                action: 'color_updated',
                user_id: user.id,
                user_email: user.email,
                details: {
                    color_id: id,
                    old_name: oldName,
                    new_name: name.trim(),
                    in_stock
                }
            });

            return successResponse(data, headers);
        }

        // DELETE - Delete color
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body);
            const { id } = body;

            if (!id) {
                return errorResponse(400, 'Color ID is required', headers);
            }

            // Get color name for audit
            const { data: color } = await supabase
                .from('colors')
                .select('name')
                .eq('id', id)
                .single();

            // Delete color
            const { error } = await supabase
                .from('colors')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Audit log
            await auditLog(supabase, {
                action: 'color_deleted',
                user_id: user.id,
                user_email: user.email,
                details: { color_name: color?.name }
            });

            return successResponse({ success: true }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Colors API error:', error);
        return errorResponse(500, error.message || 'Internal server error', headers);
    }
};

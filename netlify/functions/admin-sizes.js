/**
 * Admin Sizes API
 * GET /api/admin-sizes - List all sizes
 * POST /api/admin-sizes - Create new size
 * PUT /api/admin-sizes - Update size
 * DELETE /api/admin-sizes - Delete size
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

    // All size management requires EDIT_PRODUCTS permission
    const permError = requirePermission(user, PERMISSIONS.EDIT_PRODUCTS, headers);
    if (permError) return permError;

    try {
        // GET - List all sizes
        if (event.httpMethod === 'GET') {
            const { data, error } = await supabase
                .from('sizes')
                .select('*')
                .order('display_order', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;

            return successResponse(data, headers);
        }

        // POST - Create new size
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { name, short_code, display_order } = body;

            // Validate required fields
            if (!name || !name.trim()) {
                return errorResponse(400, 'Size name is required', headers);
            }

            // Check if size already exists
            const { data: existing } = await supabase
                .from('sizes')
                .select('id')
                .ilike('name', name.trim())
                .single();

            if (existing) {
                return errorResponse(400, 'A size with this name already exists', headers);
            }

            // Create size
            const { data, error } = await supabase
                .from('sizes')
                .insert({
                    name: name.trim(),
                    short_code: short_code?.trim() || null,
                    display_order: display_order || 0
                })
                .select()
                .single();

            if (error) throw error;

            // Audit log
            await auditLog(supabase, {
                action: 'size_created',
                user_id: user.id,
                user_email: user.email,
                details: { size_name: name }
            });

            return successResponse(data, headers);
        }

        // PUT - Update size
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body);
            const { id, name, short_code, display_order } = body;

            if (!id) {
                return errorResponse(400, 'Size ID is required', headers);
            }

            if (!name || !name.trim()) {
                return errorResponse(400, 'Size name is required', headers);
            }

            // Check if name is taken by another size
            const { data: existing } = await supabase
                .from('sizes')
                .select('id')
                .ilike('name', name.trim())
                .neq('id', id)
                .single();

            if (existing) {
                return errorResponse(400, 'A size with this name already exists', headers);
            }

            // Get old size name for audit
            const { data: oldSize } = await supabase
                .from('sizes')
                .select('name')
                .eq('id', id)
                .single();

            // Update size
            const { data, error } = await supabase
                .from('sizes')
                .update({
                    name: name.trim(),
                    short_code: short_code?.trim() || null,
                    display_order: display_order || 0
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Audit log
            await auditLog(supabase, {
                action: 'size_updated',
                user_id: user.id,
                user_email: user.email,
                details: {
                    size_id: id,
                    old_name: oldSize?.name,
                    new_name: name.trim()
                }
            });

            return successResponse(data, headers);
        }

        // DELETE - Delete size
        if (event.httpMethod === 'DELETE') {
            const body = JSON.parse(event.body);
            const { id } = body;

            if (!id) {
                return errorResponse(400, 'Size ID is required', headers);
            }

            // Get size name for audit
            const { data: size } = await supabase
                .from('sizes')
                .select('name')
                .eq('id', id)
                .single();

            // Delete size
            const { error } = await supabase
                .from('sizes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Audit log
            await auditLog(supabase, {
                action: 'size_deleted',
                user_id: user.id,
                user_email: user.email,
                details: { size_name: size?.name }
            });

            return successResponse({ success: true }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Sizes API error:', error);
        return errorResponse(500, error.message || 'Internal server error', headers);
    }
};

/**
 * Admin Discounts API
 * GET /api/admin-discounts - List all discount codes
 * POST /api/admin-discounts - Create new discount code
 * PUT /api/admin-discounts - Update discount code
 * DELETE /api/admin-discounts - Deactivate discount code
 *
 * Required permissions:
 * - All operations: MANAGE_DISCOUNTS (website_admin only)
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

    // All discount management requires MANAGE_DISCOUNTS permission
    const permError = requirePermission(user, PERMISSIONS.MANAGE_DISCOUNTS, headers);
    if (permError) return permError;

    try {
        // GET - List all discount codes
        if (event.httpMethod === 'GET') {
            const { data, error } = await supabase
                .from('discount_codes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return successResponse(data, headers);
        }

        // POST - Create new discount code
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { code, name, discount_type, discount_value, starts_at, expires_at, max_uses, max_uses_per_customer, min_order_amount } = body;

            // Validate required fields
            if (!code || !name || !discount_type || discount_value === undefined) {
                return errorResponse(400, 'Code, name, discount type, and value are required', headers);
            }

            // Validate discount type
            if (!['percentage', 'fixed'].includes(discount_type)) {
                return errorResponse(400, 'Discount type must be "percentage" or "fixed"', headers);
            }

            // Validate discount value
            const value = parseFloat(discount_value);
            if (isNaN(value) || value <= 0) {
                return errorResponse(400, 'Discount value must be a positive number', headers);
            }

            if (discount_type === 'percentage' && value > 100) {
                return errorResponse(400, 'Percentage discount cannot exceed 100%', headers);
            }

            // Check if code already exists
            const { data: existing } = await supabase
                .from('discount_codes')
                .select('id')
                .eq('code', code.toUpperCase())
                .single();

            if (existing) {
                return errorResponse(400, 'Discount code already exists', headers);
            }

            // Create discount code
            const { data, error } = await supabase
                .from('discount_codes')
                .insert([{
                    code: code.toUpperCase().trim(),
                    name: name.trim(),
                    discount_type,
                    discount_value: value,
                    starts_at: starts_at || null,
                    expires_at: expires_at || null,
                    max_uses: max_uses || null,
                    max_uses_per_customer: max_uses_per_customer || null,
                    min_order_amount: min_order_amount || null,
                    use_count: 0,
                    is_active: true,
                    created_by: user.userId
                }])
                .select()
                .single();

            if (error) throw error;

            // Audit log
            await auditLog({
                action: 'DISCOUNT_CREATED',
                user,
                resourceType: 'discount',
                resourceId: data.id,
                details: { code: data.code, type: discount_type, value },
                event
            });

            return successResponse(data, headers, 201);
        }

        // PUT - Update discount code
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body);
            const { id, code, name, discount_type, discount_value, starts_at, expires_at, max_uses, max_uses_per_customer, min_order_amount, is_active } = body;

            if (!id) {
                return errorResponse(400, 'Discount code ID required', headers);
            }

            const updateData = {};

            if (code !== undefined) {
                updateData.code = code.toUpperCase().trim();
            }

            if (name !== undefined) {
                updateData.name = name.trim();
            }

            if (discount_type !== undefined) {
                if (!['percentage', 'fixed'].includes(discount_type)) {
                    return errorResponse(400, 'Discount type must be "percentage" or "fixed"', headers);
                }
                updateData.discount_type = discount_type;
            }

            if (discount_value !== undefined) {
                const value = parseFloat(discount_value);
                if (isNaN(value) || value <= 0) {
                    return errorResponse(400, 'Discount value must be a positive number', headers);
                }
                if ((discount_type || updateData.discount_type) === 'percentage' && value > 100) {
                    return errorResponse(400, 'Percentage discount cannot exceed 100%', headers);
                }
                updateData.discount_value = value;
            }

            if (starts_at !== undefined) {
                updateData.starts_at = starts_at || null;
            }

            if (expires_at !== undefined) {
                updateData.expires_at = expires_at || null;
            }

            if (max_uses !== undefined) {
                updateData.max_uses = max_uses || null;
            }

            if (max_uses_per_customer !== undefined) {
                updateData.max_uses_per_customer = max_uses_per_customer || null;
            }

            if (min_order_amount !== undefined) {
                updateData.min_order_amount = min_order_amount || null;
            }

            if (is_active !== undefined) {
                updateData.is_active = is_active;
            }

            updateData.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('discount_codes')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Audit log
            await auditLog({
                action: 'DISCOUNT_UPDATED',
                user,
                resourceType: 'discount',
                resourceId: id,
                details: { updatedFields: Object.keys(updateData).filter(k => k !== 'updated_at') },
                event
            });

            return successResponse(data, headers);
        }

        // DELETE - Deactivate discount code (soft delete)
        if (event.httpMethod === 'DELETE') {
            const params = event.queryStringParameters || {};
            const id = params.id;

            if (!id) {
                return errorResponse(400, 'Discount code ID required', headers);
            }

            // Get code for audit log
            const { data: discountCode } = await supabase
                .from('discount_codes')
                .select('code')
                .eq('id', id)
                .single();

            // Soft delete by setting is_active to false
            const { error } = await supabase
                .from('discount_codes')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            // Audit log
            await auditLog({
                action: 'DISCOUNT_DEACTIVATED',
                user,
                resourceType: 'discount',
                resourceId: id,
                details: { code: discountCode?.code },
                event
            });

            return successResponse({ success: true }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Admin discounts error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

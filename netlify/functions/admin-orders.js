/**
 * Admin Orders API
 * GET /api/admin-orders - List all orders
 * PUT /api/admin-orders - Update order status
 *
 * Required permissions:
 * - GET: VIEW_ALL_ORDERS (business_processing, website_admin)
 * - PUT: UPDATE_ORDER_STATUS (business_processing, website_admin)
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
const { decryptOrders } = require('./utils/crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'PUT', 'OPTIONS']);

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
        // GET - List all orders
        if (event.httpMethod === 'GET') {
            // Check permission
            const permError = requirePermission(user, PERMISSIONS.VIEW_ALL_ORDERS, headers);
            if (permError) return permError;

            const params = event.queryStringParameters || {};

            let query = supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            // Filter by status
            if (params.status) {
                query = query.eq('status', params.status);
            }

            // Limit
            if (params.limit) {
                query = query.limit(parseInt(params.limit, 10));
            }

            const { data, error } = await query;

            if (error) throw error;

            // Decrypt PII fields before returning
            const decryptedData = decryptOrders(data);

            return successResponse(decryptedData, headers);
        }

        // PUT - Update order
        if (event.httpMethod === 'PUT') {
            // Check permission
            const permError = requirePermission(user, PERMISSIONS.UPDATE_ORDER_STATUS, headers);
            if (permError) return permError;

            const body = JSON.parse(event.body);
            const { id, status, notes } = body;

            if (!id) {
                return errorResponse(400, 'Order ID required', headers);
            }

            const updateData = {};
            if (status) updateData.status = status;
            if (notes !== undefined) updateData.notes = notes;
            updateData.updated_at = new Date().toISOString();

            // Get the old status first for audit logging
            const { data: oldOrder } = await supabase
                .from('orders')
                .select('status')
                .eq('id', id)
                .single();

            const { data, error } = await supabase
                .from('orders')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Audit log - order status updated
            await auditLog({
                action: AUDIT_ACTIONS.ORDER_STATUS_UPDATED,
                user,
                resourceType: 'order',
                resourceId: id,
                details: {
                    oldStatus: oldOrder?.status,
                    newStatus: status,
                    notes: notes ? 'Notes updated' : undefined
                },
                event
            });

            return successResponse(data, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Admin orders error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

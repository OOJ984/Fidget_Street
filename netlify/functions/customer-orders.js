/**
 * Customer Orders API
 * GET /api/customer-orders - List customer's own orders
 * GET /api/customer-orders?id=xxx - Get single order detail
 *
 * Requires valid customer session token from magic link auth.
 * Customers can only view their own orders.
 */

const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    errorResponse,
    successResponse
} = require('./utils/security');
const { decryptOrderPII } = require('./utils/crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

function verifyCustomerToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);

        // Ensure this is a customer token, not an admin token
        if (decoded.type !== 'customer') {
            return null;
        }

        return decoded;
    } catch (error) {
        return null;
    }
}

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!JWT_SECRET) {
        console.error('JWT_SECRET not configured');
        return errorResponse(500, 'Server configuration error', headers);
    }

    // Verify customer authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const customer = verifyCustomerToken(authHeader);

    if (!customer) {
        return errorResponse(401, 'Please sign in to view your orders', headers);
    }

    try {
        // GET - List or view orders
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};

            // Single order detail - only fields needed for customer view
            if (params.id) {
                const { data: order, error } = await supabase
                    .from('orders')
                    .select('id, order_number, status, items, subtotal, shipping, total, shipping_address, created_at, updated_at')
                    .eq('id', params.id)
                    .eq('customer_email', customer.email)
                    .single();

                if (error || !order) {
                    return errorResponse(404, 'Order not found', headers);
                }

                // Decrypt PII fields (shipping_address may contain encrypted data)
                const decryptedOrder = decryptOrderPII(order);

                return successResponse(decryptedOrder, headers);
            }

            // List all customer orders
            const { data: orders, error } = await supabase
                .from('orders')
                .select('id, order_number, status, total, items, created_at, updated_at')
                .eq('customer_email', customer.email)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Add item count for list view
            const ordersWithCount = (orders || []).map(order => ({
                ...order,
                item_count: Array.isArray(order.items) ? order.items.length : 0
            }));

            return successResponse({
                orders: ordersWithCount,
                total: ordersWithCount.length,
                email: customer.email
            }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Customer orders error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

/**
 * Customer Data API (GDPR Compliance)
 * GET /api/customer-data - Export all customer data (right to access)
 * DELETE /api/customer-data - Delete all customer data (right to be forgotten)
 *
 * Requires valid customer session token from magic link auth.
 */

const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    errorResponse,
    successResponse,
    auditLog,
    AUDIT_ACTIONS
} = require('./utils/security');
const { decryptOrders } = require('./utils/crypto');

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
    const headers = getCorsHeaders(requestOrigin, ['GET', 'DELETE', 'OPTIONS']);

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
        return errorResponse(401, 'Please sign in to access your data', headers);
    }

    try {
        // GET - Export all customer data (GDPR Right to Access)
        if (event.httpMethod === 'GET') {
            // Fetch all orders for this customer
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_email', customer.email)
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;

            // Decrypt PII fields
            const decryptedOrders = decryptOrders(orders || []);

            // Fetch customer record if exists
            const { data: customerRecord } = await supabase
                .from('customers')
                .select('*')
                .eq('email', customer.email)
                .single();

            // Build export data
            const exportData = {
                export_date: new Date().toISOString(),
                customer: {
                    email: customer.email,
                    ...(customerRecord ? {
                        name: customerRecord.name,
                        created_at: customerRecord.created_at,
                        last_login: customerRecord.last_login
                    } : {})
                },
                orders: decryptedOrders.map(order => ({
                    order_number: order.order_number,
                    status: order.status,
                    items: order.items,
                    subtotal: order.subtotal,
                    shipping: order.shipping,
                    total: order.total,
                    shipping_address: order.shipping_address,
                    customer_name: order.customer_name,
                    customer_phone: order.customer_phone,
                    payment_method: order.payment_method,
                    created_at: order.created_at
                })),
                total_orders: decryptedOrders.length,
                total_spent: decryptedOrders.reduce((sum, o) => sum + (o.total || 0), 0)
            };

            // Log the export
            await auditLog({
                action: 'customer_data_export',
                user: { email: customer.email },
                resourceType: 'customer',
                details: { orders_exported: decryptedOrders.length },
                event
            });

            return successResponse(exportData, headers);
        }

        // DELETE - Delete all customer data (GDPR Right to be Forgotten)
        if (event.httpMethod === 'DELETE') {
            const params = event.queryStringParameters || {};
            const confirmDelete = params.confirm === 'true';

            if (!confirmDelete) {
                // Return preview of what will be deleted
                const { data: orders } = await supabase
                    .from('orders')
                    .select('id, order_number')
                    .eq('customer_email', customer.email);

                const { data: customerRecord } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('email', customer.email)
                    .single();

                return successResponse({
                    message: 'This will permanently delete all your data. Add ?confirm=true to proceed.',
                    data_to_delete: {
                        orders: (orders || []).length,
                        customer_record: customerRecord ? 1 : 0
                    },
                    warning: 'This action cannot be undone. Order history will be permanently lost.'
                }, headers);
            }

            // Perform deletion
            let deletedOrders = 0;
            let deletedCustomer = false;

            // Delete orders
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .delete()
                .eq('customer_email', customer.email)
                .select('id');

            if (!ordersError && orders) {
                deletedOrders = orders.length;
            }

            // Delete customer record
            const { data: customerDelete, error: customerError } = await supabase
                .from('customers')
                .delete()
                .eq('email', customer.email)
                .select('id');

            if (!customerError && customerDelete && customerDelete.length > 0) {
                deletedCustomer = true;
            }

            // Delete from magic_link_tokens
            await supabase
                .from('magic_link_tokens')
                .delete()
                .eq('email', customer.email);

            // Log the deletion
            await auditLog({
                action: 'customer_data_deleted',
                user: { email: customer.email },
                resourceType: 'customer',
                details: {
                    orders_deleted: deletedOrders,
                    customer_record_deleted: deletedCustomer,
                    reason: 'GDPR right to be forgotten'
                },
                event
            });

            return successResponse({
                success: true,
                message: 'All your data has been permanently deleted.',
                deleted: {
                    orders: deletedOrders,
                    customer_record: deletedCustomer
                }
            }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Customer data error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

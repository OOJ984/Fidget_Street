/**
 * Orders API
 * POST /api/orders - Create new order
 * GET /api/orders?order_number=xxx - Get order status
 *
 * Security: CORS restricted to allowed origins only
 * Input validation on all user-provided data
 */

const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders } = require('./utils/security');
const {
    validateEmail,
    validatePhone,
    validateName,
    validateOrderItems,
    validateShippingAddress,
    validateOrderNumber,
    sanitizeString
} = require('./utils/validation');
const { generateOrderNumber } = require('./utils/orders');

// Use service key for orders (bypasses RLS)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'POST', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // GET - Retrieve order by order_number
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};

            // Validate order number format
            const orderNumValidation = validateOrderNumber(params.order_number);
            if (!orderNumValidation.valid) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: orderNumValidation.error })
                };
            }

            const { data, error } = await supabase
                .from('orders')
                .select('order_number, status, items, total, shipping, created_at')
                .eq('order_number', params.order_number)
                .single();

            if (error || !data) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Order not found' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data)
            };
        }

        // POST - Create new order
        if (event.httpMethod === 'POST') {
            let body;
            try {
                body = JSON.parse(event.body);
            } catch {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid JSON body' })
                };
            }

            // Validate email
            const emailValidation = validateEmail(body.customer_email);
            if (!emailValidation.valid) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: emailValidation.error })
                };
            }

            // Validate name
            const nameValidation = validateName(body.customer_name);
            if (!nameValidation.valid) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: nameValidation.error })
                };
            }

            // Validate phone (optional but must be valid if provided)
            const phoneValidation = validatePhone(body.customer_phone);
            if (!phoneValidation.valid) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: phoneValidation.error })
                };
            }

            // Validate shipping address
            const addressValidation = validateShippingAddress(body.shipping_address);
            if (!addressValidation.valid) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: addressValidation.error })
                };
            }

            // Validate items (quantity bounds, price, etc.)
            const itemsValidation = validateOrderItems(body.items);
            if (!itemsValidation.valid) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: itemsValidation.error })
                };
            }

            // Calculate totals
            const subtotal = body.items.reduce((sum, item) => {
                return sum + (item.price * item.quantity);
            }, 0);
            const shipping = subtotal >= 20 ? 0 : 2.99;
            const total = subtotal + shipping;

            // Create order with sanitized inputs
            const orderData = {
                order_number: generateOrderNumber(),
                customer_email: body.customer_email.trim().toLowerCase(),
                customer_name: sanitizeString(body.customer_name, 100),
                customer_phone: body.customer_phone ? sanitizeString(body.customer_phone, 20) : null,
                shipping_address: body.shipping_address,
                items: body.items,
                subtotal: subtotal,
                shipping: shipping,
                total: total,
                status: 'pending',
                payment_method: ['stripe', 'paypal'].includes(body.payment_method) ? body.payment_method : null,
                notes: body.notes ? sanitizeString(body.notes, 500) : null
            };

            const { data, error } = await supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single();

            if (error) {
                console.error('Order creation error:', error);
                throw error;
            }

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify({
                    success: true,
                    order_number: data.order_number,
                    total: data.total
                })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Orders API error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

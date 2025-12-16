/**
 * PayPal Capture API
 * POST /api/paypal-capture - Capture PayPal payment after approval
 *
 * Security: CORS restricted to allowed origins only
 */

const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders } = require('./utils/security');
const { generateOrderNumber } = require('./utils/orders');

const PAYPAL_API = process.env.PAYPAL_SANDBOX === 'true'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

async function getAccessToken() {
    const auth = Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    const data = await response.json();
    return data.access_token;
}

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['POST', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { orderID, items, customer } = body;

        if (!orderID) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Order ID required' })
            };
        }

        const accessToken = await getAccessToken();

        // Capture the PayPal order
        const captureResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        const captureData = await captureResponse.json();

        if (!captureResponse.ok || captureData.status !== 'COMPLETED') {
            console.error('PayPal capture failed:', captureData);
            throw new Error('Payment capture failed');
        }

        // Extract payment and shipping details
        const purchase = captureData.purchase_units[0];
        const payment = purchase.payments.captures[0];
        const shipping = purchase.shipping;

        // Calculate totals from items
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingCost = subtotal >= 20 ? 0 : 2.99;
        const total = subtotal + shippingCost;

        // Create order in database
        const orderData = {
            order_number: generateOrderNumber(),
            customer_email: customer?.email || captureData.payer?.email_address,
            customer_name: customer?.name || `${captureData.payer?.name?.given_name || ''} ${captureData.payer?.name?.surname || ''}`.trim(),
            shipping_address: shipping?.address ? {
                line1: shipping.address.address_line_1,
                line2: shipping.address.address_line_2 || '',
                city: shipping.address.admin_area_2,
                postal_code: shipping.address.postal_code,
                country: shipping.address.country_code
            } : null,
            items: items,
            subtotal: subtotal,
            shipping: shippingCost,
            total: total,
            status: 'paid',
            payment_method: 'paypal',
            payment_id: payment.id,
            notes: `PayPal Order: ${orderID}`
        };

        const { data: order, error } = await supabase
            .from('orders')
            .insert([orderData])
            .select()
            .single();

        if (error) {
            console.error('Order creation error:', error);
            // Payment was successful, so don't fail - just log
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                order_number: order?.order_number || orderData.order_number,
                paypal_order_id: orderID,
                payment_id: payment.id
            })
        };

    } catch (error) {
        console.error('PayPal capture error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Payment capture failed' })
        };
    }
};

/**
 * Stripe Webhooks Handler
 * POST /api/webhooks - Handle Stripe webhook events
 *
 * Error handling:
 * - 200: Success (Stripe stops retrying)
 * - 400: Permanent failure - bad data, duplicate, etc (Stripe stops retrying)
 * - 500: Transient failure - DB unavailable, etc (Stripe retries with backoff)
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { encryptOrderPII, isEncryptionEnabled } = require('./utils/crypto');
const { generateOrderNumber } = require('./utils/orders');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

/**
 * Determine if an error is permanent (shouldn't retry) or transient (should retry)
 */
function isPermanentError(error) {
    // Duplicate key errors are permanent
    if (error?.code === '23505') return true;
    // Validation/constraint errors are permanent
    if (error?.code === '23514' || error?.code === '23502') return true;
    // Invalid data format
    if (error?.code === '22P02') return true;
    // Default to transient (retry)
    return false;
}

exports.handler = async (event, context) => {
    // Webhooks are server-to-server, no CORS needed
    const headers = {
        'Content-Type': 'application/json'
    };

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(
            event.body,
            sig,
            webhookSecret
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid signature' })
        };
    }

    try {
        switch (stripeEvent.type) {
            case 'checkout.session.completed': {
                const session = stripeEvent.data.object;

                // Parse items from metadata
                let items = [];
                try {
                    items = JSON.parse(session.metadata?.items || '[]');
                } catch (e) {
                    console.error('Failed to parse items:', e);
                }

                // Get customer details
                const customerDetails = session.customer_details;
                const shippingDetails = session.shipping_details;

                // Calculate totals
                const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const total = session.amount_total / 100; // Convert from pence
                const shipping = total - subtotal;

                // Create order in database
                let orderData = {
                    order_number: generateOrderNumber(),
                    customer_email: customerDetails?.email,
                    customer_name: customerDetails?.name,
                    customer_phone: customerDetails?.phone || null,
                    shipping_address: shippingDetails?.address ? {
                        line1: shippingDetails.address.line1,
                        line2: shippingDetails.address.line2 || '',
                        city: shippingDetails.address.city,
                        postal_code: shippingDetails.address.postal_code,
                        country: shippingDetails.address.country
                    } : null,
                    items: items,
                    subtotal: subtotal,
                    shipping: shipping > 0 ? shipping : 0,
                    total: total,
                    status: 'paid',
                    payment_method: 'stripe',
                    payment_id: session.payment_intent,
                    notes: `Stripe Session: ${session.id}`
                };

                // Encrypt PII fields if encryption is enabled
                orderData = encryptOrderPII(orderData);

                // Check for existing order with same payment_id (idempotency)
                const { data: existingOrder } = await supabase
                    .from('orders')
                    .select('order_number')
                    .eq('payment_id', session.payment_intent)
                    .single();

                if (existingOrder) {
                    console.log('Order already exists:', existingOrder.order_number);
                    break; // Already processed, return 200
                }

                const { error } = await supabase
                    .from('orders')
                    .insert([orderData]);

                if (error) {
                    console.error('Order creation error:', error);
                    if (isPermanentError(error)) {
                        // Permanent error - don't retry
                        return {
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({ error: 'Order creation failed permanently', code: error.code })
                        };
                    }
                    // Transient error - Stripe should retry
                    return {
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({ error: 'Order creation failed temporarily' })
                    };
                }
                console.log('Order created:', orderData.order_number);
                break;
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = stripeEvent.data.object;
                console.log('Payment failed:', paymentIntent.id);
                // Log the failure for monitoring
                break;
            }

            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };

    } catch (error) {
        console.error('Webhook handler error:', error);

        // Check if this is a permanent error (bad data) vs transient (should retry)
        if (error instanceof SyntaxError || error instanceof TypeError) {
            // Parsing/type errors are permanent
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid webhook data' })
            };
        }

        // Default to transient - Stripe will retry
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Webhook handler failed temporarily' })
        };
    }
};

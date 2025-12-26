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

    // SECURITY: Validate Content-Type header
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    if (!contentType.includes('application/json')) {
        console.warn('Webhook received with invalid Content-Type:', contentType);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid Content-Type. Expected application/json' })
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
                const sessionFromEvent = stripeEvent.data.object;

                // Retrieve full session to get shipping_details (not always in webhook payload)
                const session = await stripe.checkout.sessions.retrieve(sessionFromEvent.id);

                // Check if this is a gift card purchase
                if (session.metadata?.type === 'gift_card_purchase') {
                    const giftCardId = parseInt(session.metadata.gift_card_id);
                    const giftCardCode = session.metadata.gift_card_code;

                    // Activate the gift card
                    const { error: activateError } = await supabase
                        .from('gift_cards')
                        .update({
                            status: 'active',
                            activated_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', giftCardId)
                        .eq('status', 'pending'); // Only activate if still pending

                    if (activateError) {
                        console.error('Gift card activation error:', activateError);
                    } else {
                        console.log('Gift card activated:', giftCardCode);

                        // Record activation transaction
                        const giftCardAmount = parseFloat(session.metadata.gift_card_amount);
                        await supabase
                            .from('gift_card_transactions')
                            .insert([{
                                gift_card_id: giftCardId,
                                transaction_type: 'activation',
                                amount: giftCardAmount,
                                balance_after: giftCardAmount,
                                notes: `Payment confirmed - Stripe Session: ${session.id}`,
                                performed_by_email: session.customer_details?.email || null
                            }]);
                    }

                    break; // Gift card purchase handled, exit case
                }

                // Parse items from metadata (regular order)
                let items = [];
                try {
                    items = JSON.parse(session.metadata?.items || '[]');
                } catch (e) {
                    console.error('Failed to parse items:', e);
                }

                // Get customer details
                const customerDetails = session.customer_details;
                const shippingDetails = session.shipping_details;

                // Extract discount info from metadata
                const discountCode = session.metadata?.discount_code || null;
                const discountAmount = session.metadata?.discount_amount
                    ? parseFloat(session.metadata.discount_amount)
                    : null;

                // Extract gift card info from metadata
                const giftCardId = session.metadata?.gift_card_id
                    ? parseInt(session.metadata.gift_card_id)
                    : null;
                const giftCardCode = session.metadata?.gift_card_code || null;
                const giftCardAmount = session.metadata?.gift_card_amount
                    ? parseFloat(session.metadata.gift_card_amount)
                    : null;

                // Calculate totals
                const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const total = session.amount_total / 100; // Convert from pence
                const shipping = total - (subtotal - (discountAmount || 0));

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
                    discount_code: discountCode,
                    discount_amount: discountAmount,
                    gift_card_code: giftCardCode,
                    gift_card_amount: giftCardAmount,
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

                const { data: createdOrder, error } = await supabase
                    .from('orders')
                    .insert([orderData])
                    .select('id, order_number')
                    .single();

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
                console.log('Order created:', createdOrder.order_number);

                // Decrement stock for each item in the order
                // Use optimistic locking to prevent overselling in concurrent scenarios
                for (const item of items) {
                    if (!item.id) {
                        console.warn('Item missing ID, cannot decrement stock:', item);
                        continue;
                    }

                    // Get current stock level
                    const { data: product, error: fetchError } = await supabase
                        .from('products')
                        .select('id, title, stock')
                        .eq('id', item.id)
                        .single();

                    if (fetchError || !product) {
                        console.error(`Failed to fetch product ${item.id} for stock decrement:`, fetchError);
                        continue;
                    }

                    const currentStock = product.stock || 0;
                    const newStock = Math.max(0, currentStock - item.quantity);

                    // Use optimistic locking - only update if stock hasn't changed
                    const { data: updated, error: updateError } = await supabase
                        .from('products')
                        .update({
                            stock: newStock,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', item.id)
                        .eq('stock', currentStock) // Optimistic lock
                        .select('id, stock')
                        .single();

                    if (updateError || !updated) {
                        // Optimistic lock failed - another order may have modified stock
                        console.error(`CRITICAL: Stock decrement failed for ${product.title} (ID: ${item.id})`);
                        console.error(`Order ${createdOrder.order_number} - expected stock ${currentStock}, may have been modified`);
                        console.error('Error:', updateError);
                        // Don't fail the webhook - order is already paid
                        // This should be investigated manually or retry with fresh stock value

                        // Retry with fresh stock value (best effort)
                        const { data: freshProduct } = await supabase
                            .from('products')
                            .select('stock')
                            .eq('id', item.id)
                            .single();

                        if (freshProduct) {
                            const freshNewStock = Math.max(0, freshProduct.stock - item.quantity);
                            await supabase
                                .from('products')
                                .update({
                                    stock: freshNewStock,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', item.id);
                            console.log(`Retry: ${product.title} stock updated to ${freshNewStock}`);
                        }
                    } else {
                        console.log(`Stock updated: ${product.title} - ${currentStock} -> ${newStock} (ordered: ${item.quantity})`);
                    }
                }

                // Increment discount code use count and record usage if discount was applied
                if (discountCode) {
                    const { data: discountData } = await supabase
                        .from('discount_codes')
                        .select('id, use_count')
                        .eq('code', discountCode)
                        .single();

                    if (discountData) {
                        // Increment total use count
                        const { error: discountError } = await supabase
                            .from('discount_codes')
                            .update({ use_count: (discountData.use_count || 0) + 1 })
                            .eq('code', discountCode);

                        if (discountError) {
                            console.error('Failed to increment discount use count:', discountError);
                        }

                        // Record per-customer usage for tracking
                        if (customerDetails?.email) {
                            await supabase
                                .from('discount_usage')
                                .insert({
                                    discount_code_id: discountData.id,
                                    customer_email: customerDetails.email.toLowerCase()
                                });
                        }
                    }
                }

                // Deduct gift card balance if gift card was used
                if (giftCardId && giftCardAmount > 0) {
                    // Get current gift card
                    const { data: giftCard } = await supabase
                        .from('gift_cards')
                        .select('id, code, current_balance')
                        .eq('id', giftCardId)
                        .single();

                    if (giftCard) {
                        const currentBalance = parseFloat(giftCard.current_balance);
                        const newBalance = Math.round((currentBalance - giftCardAmount) * 100) / 100;
                        const newStatus = newBalance <= 0 ? 'depleted' : 'active';

                        // SECURITY: Use optimistic locking to prevent race conditions
                        // Only update if balance hasn't changed since we read it
                        const { data: updatedCard, error: gcError } = await supabase
                            .from('gift_cards')
                            .update({
                                current_balance: Math.max(0, newBalance),
                                status: newStatus,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', giftCardId)
                            .eq('current_balance', giftCard.current_balance) // Optimistic lock
                            .select('id')
                            .single();

                        if (gcError || !updatedCard) {
                            console.error('Gift card balance update failed (possible race condition):', gcError);
                            console.error(`CRITICAL: Order ${createdOrder.order_number} - gift card ${giftCard.code} deduction may have failed!`);
                            // Don't retry here - the order is already created and paid
                            // This should be investigated manually
                        } else {
                            console.log(`Gift card ${giftCard.code} deducted: £${giftCardAmount.toFixed(2)}, new balance: £${Math.max(0, newBalance).toFixed(2)}`);
                        }

                        // Record gift card transaction
                        await supabase
                            .from('gift_card_transactions')
                            .insert([{
                                gift_card_id: giftCardId,
                                transaction_type: 'redemption',
                                amount: -giftCardAmount,
                                balance_after: Math.max(0, newBalance),
                                order_id: createdOrder.id,
                                order_number: createdOrder.order_number,
                                notes: `Order ${createdOrder.order_number}`,
                                performed_by_email: customerDetails?.email || null
                            }]);
                    }
                }
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

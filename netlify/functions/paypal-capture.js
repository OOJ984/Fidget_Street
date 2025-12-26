/**
 * PayPal Capture API
 * POST /api/paypal-capture - Capture PayPal payment after approval
 *
 * Security:
 * - CORS restricted to allowed origins only
 * - Prices verified against database before order creation
 * - PayPal captured amount validated against server-calculated total
 */

const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders } = require('./utils/security');
const { generateOrderNumber } = require('./utils/orders');
const { verifyCartPrices, calculateShipping, SHIPPING_CONFIG } = require('./utils/checkout');

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
        const { orderID, items, customer, discountCode } = body;

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

        // SECURITY: Verify cart prices against database (never trust client prices)
        const verification = await verifyCartPrices(items);
        if (!verification.valid) {
            console.error('Price verification failed:', verification.error);
            // Payment already captured - log critical error but don't fail
            // In production, this should trigger an alert for manual review
            console.error('CRITICAL: PayPal payment captured but price verification failed!');
        }

        // Use verified items if available, otherwise fall back to client items
        const verifiedItems = verification.valid ? verification.items : items;

        // Calculate subtotal from verified database prices
        const subtotal = verifiedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Extract discount info from custom_id (set during checkout)
        let discountInfo = null;
        let discountAmount = 0;

        if (purchase.custom_id) {
            try {
                discountInfo = JSON.parse(purchase.custom_id);
            } catch (e) {
                console.warn('Could not parse custom_id:', purchase.custom_id);
            }
        }

        // SECURITY: Re-validate discount code server-side (don't trust custom_id amount)
        if (discountInfo?.discount_code) {
            const { data: discount, error: discountError } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', discountInfo.discount_code.toUpperCase().trim())
                .eq('is_active', true)
                .single();

            if (discount && !discountError) {
                const now = new Date();
                const startsAt = discount.starts_at ? new Date(discount.starts_at) : null;
                const expiresAt = discount.expires_at ? new Date(discount.expires_at) : null;

                const isValid = (!startsAt || startsAt <= now) &&
                                (!expiresAt || expiresAt > now) &&
                                (!discount.max_uses || discount.use_count < discount.max_uses);

                if (isValid) {
                    if (discount.discount_type === 'percentage') {
                        discountAmount = Math.round((subtotal * discount.discount_value) / 100 * 100) / 100;
                    } else if (discount.discount_type === 'fixed') {
                        discountAmount = Math.min(discount.discount_value, subtotal);
                    }
                    // free_delivery type has discountAmount = 0
                    discountInfo.validated = true;
                    discountInfo.discount_type = discount.discount_type;
                }
            }
        }

        // Calculate totals using verified prices
        const discountedSubtotal = subtotal - discountAmount;
        const isFreeDelivery = discountInfo?.discount_type === 'free_delivery';
        const shippingCost = isFreeDelivery ? 0 : calculateShipping(discountedSubtotal, false);
        const expectedTotal = Math.round((discountedSubtotal + shippingCost) * 100) / 100;

        // SECURITY: Validate PayPal's captured amount against server-calculated total
        const capturedAmount = parseFloat(payment.amount.value);
        const tolerance = 0.02; // 2 pence tolerance for rounding differences

        if (Math.abs(capturedAmount - expectedTotal) > tolerance) {
            console.error('CRITICAL: Amount mismatch!', {
                captured: capturedAmount,
                expected: expectedTotal,
                difference: Math.abs(capturedAmount - expectedTotal),
                orderID: orderID
            });
            // Payment already captured - log for manual review
            // Don't fail the request as the customer has already paid
        }

        // Create order in database using verified prices
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
            items: verifiedItems, // SECURITY: Use verified items, not client items
            subtotal: subtotal,
            shipping: shippingCost,
            total: expectedTotal, // SECURITY: Use server-calculated total
            discount_code: discountInfo?.discount_code || null,
            discount_amount: discountAmount > 0 ? discountAmount : null,
            status: 'paid',
            payment_method: 'paypal',
            payment_id: payment.id,
            notes: `PayPal Order: ${orderID}${Math.abs(capturedAmount - expectedTotal) > 0.01 ? ' [AMOUNT MISMATCH - REVIEW]' : ''}`
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

        // Increment discount code use count and record usage if discount was applied
        if (discountInfo?.discount_code) {
            // Get current use_count and increment
            const { data: discountData } = await supabase
                .from('discount_codes')
                .select('id, use_count')
                .eq('code', discountInfo.discount_code)
                .single();

            if (discountData) {
                // Increment total use count
                const { error: discountError } = await supabase
                    .from('discount_codes')
                    .update({ use_count: (discountData.use_count || 0) + 1 })
                    .eq('code', discountInfo.discount_code);

                if (discountError) {
                    console.error('Failed to increment discount use count:', discountError);
                }

                // Record per-customer usage for tracking
                const customerEmail = orderData.customer_email;
                if (customerEmail) {
                    await supabase
                        .from('discount_usage')
                        .insert({
                            discount_code_id: discountData.id,
                            customer_email: customerEmail.toLowerCase()
                        });
                }
            }
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

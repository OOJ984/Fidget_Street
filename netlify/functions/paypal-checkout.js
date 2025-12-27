/**
 * PayPal Checkout API
 * POST /api/paypal-checkout - Create PayPal order
 *
 * Security: CORS restricted to allowed origins only
 * Prices verified against database before checkout
 */

const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders } = require('./utils/security');
const { validateEmail, sanitizeErrorMessage } = require('./utils/validation');
const { verifyCartPrices, calculateTotals } = require('./utils/checkout');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const PAYPAL_API = process.env.PAYPAL_SANDBOX === 'true'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

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
        // Parse request body with error handling
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        const { items, customer_email, discountCode } = body;

        // Validate email if provided
        if (customer_email) {
            const emailValidation = validateEmail(customer_email);
            if (!emailValidation.valid) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: emailValidation.error })
                };
            }
        }

        // Verify cart items against database prices
        const verification = await verifyCartPrices(items);
        if (!verification.valid) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: verification.error })
            };
        }

        const verifiedItems = verification.items;

        // Calculate base totals using verified prices
        const baseTotals = calculateTotals(verifiedItems);

        // Validate and apply discount code
        let discountAmount = 0;
        let discountInfo = null;

        if (discountCode) {
            const { data: discount, error } = await supabase
                .from('discount_codes')
                .select('*')
                .eq('code', discountCode.toUpperCase().trim())
                .eq('is_active', true)
                .single();

            if (discount && !error) {
                const now = new Date();
                const startsAt = discount.starts_at ? new Date(discount.starts_at) : null;
                const expiresAt = discount.expires_at ? new Date(discount.expires_at) : null;

                // Validate discount is active
                let isValid = (!startsAt || startsAt <= now) &&
                               (!expiresAt || expiresAt > now) &&
                               (!discount.max_uses || discount.use_count < discount.max_uses);

                // Check per-person limit if applicable and email provided
                if (isValid && discount.max_uses_per_customer && customer_email) {
                    const { count } = await supabase
                        .from('discount_usage')
                        .select('*', { count: 'exact', head: true })
                        .eq('discount_code_id', discount.id)
                        .eq('customer_email', customer_email.toLowerCase());

                    if (count >= discount.max_uses_per_customer) {
                        return {
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({ error: `You have already used this code the maximum number of times (${discount.max_uses_per_customer})` })
                        };
                    }
                }

                // Check minimum order amount if applicable
                if (isValid && discount.min_order_amount) {
                    if (baseTotals.subtotal < parseFloat(discount.min_order_amount)) {
                        return {
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({ error: `This discount code requires a minimum order of £${parseFloat(discount.min_order_amount).toFixed(2)}` })
                        };
                    }
                }

                if (isValid) {
                    if (discount.discount_type === 'percentage') {
                        discountAmount = (baseTotals.subtotal * discount.discount_value) / 100;
                    } else if (discount.discount_type === 'fixed') {
                        discountAmount = parseFloat(discount.discount_value);
                    }
                    // free_delivery type has discountAmount = 0 (shipping handled separately)

                    // Ensure discount doesn't exceed subtotal (not applicable for free_delivery)
                    if (discount.discount_type !== 'free_delivery') {
                        discountAmount = Math.min(discountAmount, baseTotals.subtotal);
                    }
                    // Round to 2 decimal places
                    discountAmount = Math.round(discountAmount * 100) / 100;
                    discountInfo = {
                        code: discount.code,
                        type: discount.discount_type,
                        value: discount.discount_value
                    };
                }
            }
        }

        // Calculate final totals with discount
        // For free_delivery discount, shipping is always 0
        const subtotal = baseTotals.subtotal - discountAmount;
        const shipping = (discountInfo?.type === 'free_delivery') ? 0 : (subtotal >= 20 ? 0 : baseTotals.shipping);
        const total = subtotal + shipping;

        const accessToken = await getAccessToken();
        const baseUrl = process.env.URL || 'https://fidgetstreet.co.uk';

        // Create PayPal order using verified prices (adjusted for discount)
        // Apply discount proportionally to each item
        let adjustedItems = verifiedItems;
        if (discountAmount > 0) {
            const discountRatio = discountAmount / baseTotals.subtotal;
            adjustedItems = verifiedItems.map(item => ({
                ...item,
                adjustedPrice: Math.round(item.price * (1 - discountRatio) * 100) / 100
            }));
        }

        const orderItems = adjustedItems.map(item => ({
            name: (item.title + (discountInfo ? ` (${discountInfo.code})` : '')).substring(0, 127), // PayPal limit
            quantity: item.quantity.toString(),
            unit_amount: {
                currency_code: 'GBP',
                value: (item.adjustedPrice || item.price).toFixed(2)
            },
            category: 'PHYSICAL_GOODS'
        }));

        // Calculate adjusted item total
        const itemTotal = adjustedItems.reduce((sum, item) =>
            sum + (item.adjustedPrice || item.price) * item.quantity, 0);

        const orderPayload = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'GBP',
                    value: total.toFixed(2),
                    breakdown: {
                        item_total: {
                            currency_code: 'GBP',
                            value: itemTotal.toFixed(2)
                        },
                        shipping: {
                            currency_code: 'GBP',
                            value: shipping.toFixed(2)
                        }
                    }
                },
                items: orderItems,
                custom_id: discountInfo ? JSON.stringify({
                    discount_code: discountInfo.code,
                    discount_type: discountInfo.type,
                    discount_value: discountInfo.value,
                    discount_amount: discountAmount
                }) : undefined,
                shipping: {
                    options: [{
                        id: shipping > 0 ? 'standard' : 'free',
                        label: shipping > 0 ? 'Standard Shipping' : 'Free Shipping',
                        selected: true,
                        amount: {
                            currency_code: 'GBP',
                            value: shipping.toFixed(2)
                        }
                    }]
                }
            }],
            application_context: {
                brand_name: 'Fidget Street',
                landing_page: 'BILLING',
                shipping_preference: 'GET_FROM_FILE',
                user_action: 'PAY_NOW',
                return_url: `${baseUrl}/success.html`,
                cancel_url: `${baseUrl}/cart.html`
            }
        };

        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderPayload),
        });

        const order = await response.json();

        if (!response.ok) {
            console.error('PayPal error:', order);
            throw new Error(order.message || 'PayPal order creation failed');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                orderID: order.id,
                status: order.status
            })
        };

    } catch (error) {
        console.error('PayPal checkout error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: sanitizeErrorMessage(error) || 'Checkout failed' })
        };
    }
};

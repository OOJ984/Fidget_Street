/**
 * PayPal Checkout API
 * POST /api/paypal-checkout - Create PayPal order
 *
 * Security: CORS restricted to allowed origins only
 * Prices verified against database before checkout
 */

const { getCorsHeaders } = require('./utils/security');
const { validateEmail } = require('./utils/validation');
const { verifyCartPrices, calculateTotals } = require('./utils/checkout');

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

        const { items, customer_email } = body;

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

        // Calculate totals using verified prices
        const { subtotal, shipping, total } = calculateTotals(verifiedItems);

        const accessToken = await getAccessToken();
        const baseUrl = process.env.URL || 'https://wicka.co.uk';

        // Create PayPal order using verified prices
        const orderItems = verifiedItems.map(item => ({
            name: item.title.substring(0, 127), // PayPal limit
            quantity: item.quantity.toString(),
            unit_amount: {
                currency_code: 'GBP',
                value: item.price.toFixed(2)
            },
            category: 'PHYSICAL_GOODS'
        }));

        const orderPayload = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'GBP',
                    value: total.toFixed(2),
                    breakdown: {
                        item_total: {
                            currency_code: 'GBP',
                            value: subtotal.toFixed(2)
                        },
                        shipping: {
                            currency_code: 'GBP',
                            value: shipping.toFixed(2)
                        }
                    }
                },
                items: orderItems,
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
                brand_name: 'Wicka',
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
            body: JSON.stringify({ error: error.message || 'Checkout failed' })
        };
    }
};

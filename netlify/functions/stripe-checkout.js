/**
 * Stripe Checkout API
 * POST /api/stripe-checkout - Create Stripe checkout session
 *
 * Security: CORS restricted to allowed origins only
 * Prices verified against database before checkout
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getCorsHeaders } = require('./utils/security');
const { validateEmail } = require('./utils/validation');
const { verifyCartPrices, calculateShipping, SHIPPING_CONFIG } = require('./utils/checkout');

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

        // Calculate totals using verified prices (in pence for Stripe)
        const subtotal = verifiedItems.reduce((sum, item) => sum + (item.price * item.quantity * 100), 0);
        const shipping = calculateShipping(subtotal, true);

        // Create line items for Stripe using verified prices
        const lineItems = verifiedItems.map(item => ({
            price_data: {
                currency: 'gbp',
                product_data: {
                    name: item.title,
                    description: item.variation || undefined,
                },
                unit_amount: Math.round(item.price * 100), // Convert to pence
            },
            quantity: item.quantity,
        }));

        // Add shipping if applicable
        if (shipping > 0) {
            lineItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'Shipping',
                    },
                    unit_amount: shipping,
                },
                quantity: 1,
            });
        }

        // Get base URL for redirects
        const baseUrl = process.env.URL || 'https://wicka.co.uk';

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/cart.html`,
            customer_email: customer_email || undefined,
            metadata: {
                items: JSON.stringify(verifiedItems.map(i => ({
                    id: i.id,
                    title: i.title,
                    quantity: i.quantity,
                    price: i.price
                })))
            },
            shipping_address_collection: {
                allowed_countries: ['GB'],
            },
            billing_address_collection: 'required',
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                sessionId: session.id,
                url: session.url
            })
        };

    } catch (error) {
        console.error('Stripe checkout error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Checkout failed' })
        };
    }
};

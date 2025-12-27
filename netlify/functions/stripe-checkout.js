/**
 * Stripe Checkout API
 * POST /api/stripe-checkout - Create Stripe checkout session
 *
 * Security: CORS restricted to allowed origins only
 * Prices verified against database before checkout
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders } = require('./utils/security');
const { validateEmail, sanitizeErrorMessage } = require('./utils/validation');
const { verifyCartPrices, calculateShipping, SHIPPING_CONFIG } = require('./utils/checkout');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

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

        const { items, customer_email, discountCode, giftCardCode, giftCardAmount } = body;

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

        // Calculate subtotal in pence
        const subtotalPence = verifiedItems.reduce((sum, item) => sum + (item.price * item.quantity * 100), 0);

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
                    const subtotalPounds = subtotalPence / 100;
                    if (subtotalPounds < parseFloat(discount.min_order_amount)) {
                        return {
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({ error: `This discount code requires a minimum order of £${parseFloat(discount.min_order_amount).toFixed(2)}` })
                        };
                    }
                }

                if (isValid) {
                    if (discount.discount_type === 'percentage') {
                        discountAmount = Math.round((subtotalPence * discount.discount_value) / 100);
                    } else if (discount.discount_type === 'fixed') {
                        discountAmount = Math.round(discount.discount_value * 100);
                    }
                    // free_delivery type has discountAmount = 0 (shipping handled separately)

                    // Ensure discount doesn't exceed subtotal (not applicable for free_delivery)
                    if (discount.discount_type !== 'free_delivery') {
                        discountAmount = Math.min(discountAmount, subtotalPence);
                    }
                    discountInfo = {
                        code: discount.code,
                        type: discount.discount_type,
                        value: discount.discount_value
                    };
                }
            }
        }

        // Calculate shipping based on discounted subtotal
        // For free_delivery discount, shipping is always 0
        const discountedSubtotalPence = subtotalPence - discountAmount;
        const shipping = (discountInfo?.type === 'free_delivery') ? 0 : calculateShipping(discountedSubtotalPence, true);

        // Validate and apply gift card if provided
        let giftCardInfo = null;
        let giftCardDeduction = 0;

        if (giftCardCode && giftCardAmount) {
            const requestedAmount = Math.round(parseFloat(giftCardAmount) * 100); // Convert to pence

            // Validate the gift card
            const { data: giftCard, error: gcError } = await supabase
                .from('gift_cards')
                .select('*')
                .eq('code', giftCardCode.toUpperCase().trim())
                .single();

            if (giftCard && !gcError && giftCard.status === 'active') {
                // Check expiry
                let isValid = true;
                if (giftCard.expires_at) {
                    const expiresAt = new Date(giftCard.expires_at);
                    if (expiresAt < new Date()) {
                        isValid = false;
                    }
                }

                if (isValid) {
                    const balancePence = Math.round(parseFloat(giftCard.current_balance) * 100);
                    // Use the lesser of requested amount, balance, or order total
                    const orderTotalAfterDiscount = discountedSubtotalPence + shipping;
                    giftCardDeduction = Math.min(requestedAmount, balancePence, orderTotalAfterDiscount);

                    if (giftCardDeduction > 0) {
                        giftCardInfo = {
                            id: giftCard.id,
                            code: giftCard.code,
                            amount: giftCardDeduction / 100 // Store in GBP for metadata
                        };
                    }
                }
            }
            // If gift card is invalid, we proceed without it (no error thrown)
        }

        // Apply discount and gift card proportionally to each item if needed
        let adjustedItems = verifiedItems;
        const totalDeduction = discountAmount + giftCardDeduction;
        if (totalDeduction > 0) {
            // Calculate the combined deduction ratio
            const deductionRatio = totalDeduction / (subtotalPence + shipping);
            adjustedItems = verifiedItems.map(item => ({
                ...item,
                adjustedPrice: Math.round(item.price * 100 * (1 - deductionRatio)) / 100
            }));
        }

        // Build description suffix for applied codes
        let appliedSuffix = '';
        if (discountInfo && giftCardInfo) {
            appliedSuffix = ` (${discountInfo.code} + Gift Card applied)`;
        } else if (discountInfo) {
            appliedSuffix = ` (${discountInfo.code} applied)`;
        } else if (giftCardInfo) {
            appliedSuffix = ' (Gift Card applied)';
        }

        // Create line items for Stripe using adjusted prices
        const lineItems = adjustedItems.map(item => ({
            price_data: {
                currency: 'gbp',
                product_data: {
                    name: item.title + appliedSuffix,
                    description: item.variation || undefined,
                },
                unit_amount: Math.round((item.adjustedPrice || item.price) * 100), // Convert to pence
            },
            quantity: item.quantity,
        }));

        // Add shipping if applicable (reduced proportionally if gift card applied)
        const adjustedShipping = giftCardDeduction > 0
            ? Math.round(shipping * (1 - giftCardDeduction / (discountedSubtotalPence + shipping)))
            : shipping;

        if (adjustedShipping > 0) {
            lineItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'Shipping',
                    },
                    unit_amount: adjustedShipping,
                },
                quantity: 1,
            });
        }

        // Get base URL for redirects
        const baseUrl = process.env.URL || 'https://fidgetstreet.co.uk';

        // Build metadata
        const metadata = {
            items: JSON.stringify(verifiedItems.map(i => ({
                id: i.id,
                title: i.title,
                quantity: i.quantity,
                price: i.price
            })))
        };

        if (discountInfo) {
            metadata.discount_code = discountInfo.code;
            metadata.discount_type = discountInfo.type;
            metadata.discount_value = discountInfo.value.toString();
            metadata.discount_amount = (discountAmount / 100).toFixed(2);
        }

        if (giftCardInfo) {
            metadata.gift_card_id = giftCardInfo.id.toString();
            metadata.gift_card_code = giftCardInfo.code;
            metadata.gift_card_amount = giftCardInfo.amount.toFixed(2);
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/cart.html`,
            customer_email: customer_email || undefined,
            metadata,
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
            body: JSON.stringify({ error: sanitizeErrorMessage(error) || 'Checkout failed' })
        };
    }
};

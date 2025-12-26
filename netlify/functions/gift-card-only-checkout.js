/**
 * Gift Card Only Checkout API
 * POST /api/gift-card-only-checkout - Complete order paid entirely with gift card
 *
 * When a gift card covers the full order amount, no payment gateway is needed.
 * This endpoint validates the gift card, creates the order, and deducts the balance.
 */

const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders, errorResponse, successResponse } = require('./utils/security');
const { validateEmail } = require('./utils/validation');
const { verifyCartPrices, calculateShipping, SHIPPING_CONFIG } = require('./utils/checkout');
const { encryptOrderPII } = require('./utils/crypto');
const { generateOrderNumber } = require('./utils/orders');

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
        return errorResponse(405, 'Method not allowed', headers);
    }

    try {
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (parseError) {
            return errorResponse(400, 'Invalid JSON in request body', headers);
        }

        const { items, customer_email, customer_name, shipping_address, discountCode, giftCardCode } = body;

        // Validate required fields
        if (!giftCardCode) {
            return errorResponse(400, 'Gift card code is required', headers);
        }

        if (!customer_email) {
            return errorResponse(400, 'Email address is required', headers);
        }

        if (!customer_name) {
            return errorResponse(400, 'Customer name is required', headers);
        }

        if (!shipping_address || !shipping_address.line1 || !shipping_address.city || !shipping_address.postal_code) {
            return errorResponse(400, 'Complete shipping address is required', headers);
        }

        // Validate email
        const emailValidation = validateEmail(customer_email);
        if (!emailValidation.valid) {
            return errorResponse(400, emailValidation.error, headers);
        }

        // Verify cart items against database prices
        const verification = await verifyCartPrices(items);
        if (!verification.valid) {
            return errorResponse(400, verification.error, headers);
        }

        const verifiedItems = verification.items;

        // Calculate subtotal
        const subtotal = verifiedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Apply discount code if provided
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

                let isValid = (!startsAt || startsAt <= now) &&
                              (!expiresAt || expiresAt > now) &&
                              (!discount.max_uses || discount.use_count < discount.max_uses);

                // Check per-person limit
                if (isValid && discount.max_uses_per_customer && customer_email) {
                    const { count } = await supabase
                        .from('discount_usage')
                        .select('*', { count: 'exact', head: true })
                        .eq('discount_code_id', discount.id)
                        .eq('customer_email', customer_email.toLowerCase());

                    if (count >= discount.max_uses_per_customer) {
                        return errorResponse(400, `You have already used this code the maximum number of times`, headers);
                    }
                }

                // Check minimum order amount
                if (isValid && discount.min_order_amount && subtotal < parseFloat(discount.min_order_amount)) {
                    return errorResponse(400, `This discount code requires a minimum order of £${parseFloat(discount.min_order_amount).toFixed(2)}`, headers);
                }

                if (isValid) {
                    if (discount.discount_type === 'percentage') {
                        discountAmount = Math.round(subtotal * discount.discount_value) / 100;
                    } else if (discount.discount_type === 'fixed') {
                        discountAmount = parseFloat(discount.discount_value);
                    }
                    discountAmount = Math.min(discountAmount, subtotal);
                    discountInfo = {
                        id: discount.id,
                        code: discount.code,
                        type: discount.discount_type,
                        value: discount.discount_value
                    };
                }
            }
        }

        // Calculate shipping
        const discountedSubtotal = subtotal - discountAmount;
        const shipping = (discountInfo?.type === 'free_delivery') ? 0 : calculateShipping(discountedSubtotal * 100, false);

        // Calculate total
        const orderTotal = Math.round((discountedSubtotal + shipping) * 100) / 100;

        // Validate gift card
        const { data: giftCard, error: gcError } = await supabase
            .from('gift_cards')
            .select('*')
            .eq('code', giftCardCode.toUpperCase().trim())
            .single();

        if (gcError || !giftCard) {
            return errorResponse(400, 'Invalid gift card code', headers);
        }

        if (giftCard.status !== 'active') {
            const statusMessages = {
                'pending': 'This gift card has not been activated yet',
                'depleted': 'This gift card has no remaining balance',
                'expired': 'This gift card has expired',
                'cancelled': 'This gift card has been cancelled'
            };
            return errorResponse(400, statusMessages[giftCard.status] || 'This gift card is not valid', headers);
        }

        // Check expiry
        if (giftCard.expires_at) {
            const expiresAt = new Date(giftCard.expires_at);
            if (expiresAt < new Date()) {
                await supabase
                    .from('gift_cards')
                    .update({ status: 'expired' })
                    .eq('id', giftCard.id);
                return errorResponse(400, 'This gift card has expired', headers);
            }
        }

        // Verify gift card covers full order
        const giftCardBalance = parseFloat(giftCard.current_balance);
        if (giftCardBalance < orderTotal) {
            return errorResponse(400, `Gift card balance (£${giftCardBalance.toFixed(2)}) is insufficient for this order (£${orderTotal.toFixed(2)}). Please use a different payment method.`, headers);
        }

        // Calculate new gift card balance
        const newBalance = Math.round((giftCardBalance - orderTotal) * 100) / 100;
        const newStatus = newBalance <= 0 ? 'depleted' : 'active';

        // Generate order number
        const orderNumber = generateOrderNumber();

        // SECURITY: Atomically deduct gift card balance FIRST using optimistic locking
        // This prevents race conditions where two orders could use the same balance
        const { data: updatedCard, error: updateError } = await supabase
            .from('gift_cards')
            .update({
                current_balance: newBalance,
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', giftCard.id)
            .eq('current_balance', giftCard.current_balance) // Optimistic lock - only update if balance unchanged
            .select('id')
            .single();

        if (updateError || !updatedCard) {
            // Balance was modified by another transaction - race condition detected
            console.error('Gift card race condition detected:', updateError);
            return errorResponse(409, 'Gift card balance was modified. Please try again.', headers);
        }

        // Create order data
        let orderData = {
            order_number: orderNumber,
            customer_email: customer_email,
            customer_name: customer_name,
            customer_phone: body.customer_phone || null,
            shipping_address: {
                line1: shipping_address.line1,
                line2: shipping_address.line2 || '',
                city: shipping_address.city,
                postal_code: shipping_address.postal_code,
                country: shipping_address.country || 'GB'
            },
            items: verifiedItems,
            subtotal: subtotal,
            shipping: shipping,
            total: orderTotal,
            discount_code: discountInfo?.code || null,
            discount_amount: discountAmount > 0 ? discountAmount : null,
            gift_card_code: giftCard.code,
            gift_card_amount: orderTotal,
            status: 'paid',
            payment_method: 'gift_card',
            payment_id: `GC-${giftCard.id}-${Date.now()}`,
            notes: `Paid with gift card ${giftCard.code}`
        };

        // Encrypt PII
        orderData = encryptOrderPII(orderData);

        // Create order in database
        const { data: createdOrder, error: orderError } = await supabase
            .from('orders')
            .insert([orderData])
            .select('id, order_number')
            .single();

        if (orderError) {
            console.error('Order creation error:', orderError);
            // ROLLBACK: Refund the gift card since order creation failed
            await supabase
                .from('gift_cards')
                .update({
                    current_balance: giftCardBalance,
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('id', giftCard.id);
            return errorResponse(500, 'Failed to create order', headers);
        }

        // Record gift card transaction
        await supabase
            .from('gift_card_transactions')
            .insert([{
                gift_card_id: giftCard.id,
                transaction_type: 'redemption',
                amount: -orderTotal,
                balance_after: newBalance,
                order_id: createdOrder.id,
                order_number: orderNumber,
                notes: `Order ${orderNumber}`,
                performed_by_email: customer_email
            }]);

        // Increment discount code usage if applicable
        if (discountInfo) {
            const { data: discountData } = await supabase
                .from('discount_codes')
                .select('use_count')
                .eq('id', discountInfo.id)
                .single();

            if (discountData) {
                await supabase
                    .from('discount_codes')
                    .update({ use_count: (discountData.use_count || 0) + 1 })
                    .eq('id', discountInfo.id);

                await supabase
                    .from('discount_usage')
                    .insert({
                        discount_code_id: discountInfo.id,
                        customer_email: customer_email.toLowerCase()
                    });
            }
        }

        return successResponse({
            success: true,
            order_number: orderNumber,
            total: orderTotal,
            gift_card_used: orderTotal,
            gift_card_remaining: newBalance,
            message: `Order confirmed! Your gift card has been charged £${orderTotal.toFixed(2)}.`
        }, headers);

    } catch (error) {
        console.error('Gift card only checkout error:', error);
        return errorResponse(500, 'Checkout failed', headers);
    }
};

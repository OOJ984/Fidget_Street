/**
 * Validate Discount Code API
 * POST /api/validate-discount - Validate a discount code for checkout
 *
 * This is a public endpoint (no auth required) for customers to validate codes at checkout
 */

const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders, errorResponse, successResponse } = require('./utils/security');

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
        const body = JSON.parse(event.body);
        const { code, subtotal } = body;

        if (!code) {
            return errorResponse(400, 'Discount code is required', headers);
        }

        // Look up the discount code
        const { data: discount, error } = await supabase
            .from('discount_codes')
            .select('*')
            .eq('code', code.toUpperCase().trim())
            .single();

        if (error || !discount) {
            return errorResponse(400, 'Invalid discount code', headers);
        }

        // Check if code is active
        if (!discount.is_active) {
            return errorResponse(400, 'This discount code is no longer active', headers);
        }

        const now = new Date();

        // Check if code has started
        if (discount.starts_at) {
            const startsAt = new Date(discount.starts_at);
            if (startsAt > now) {
                return errorResponse(400, 'This discount code is not yet active', headers);
            }
        }

        // Check if code has expired
        if (discount.expires_at) {
            const expiresAt = new Date(discount.expires_at);
            if (expiresAt < now) {
                return errorResponse(400, 'This discount code has expired', headers);
            }
        }

        // Check usage limit
        if (discount.max_uses && discount.use_count >= discount.max_uses) {
            return errorResponse(400, 'This discount code has reached its usage limit', headers);
        }

        // Check minimum order amount
        const cartSubtotal = parseFloat(subtotal) || 0;
        if (discount.min_order_amount && cartSubtotal < parseFloat(discount.min_order_amount)) {
            return errorResponse(400, `This discount code requires a minimum order of £${parseFloat(discount.min_order_amount).toFixed(2)}`, headers);
        }

        // Calculate discount amount
        let discountAmount = 0;

        if (discount.discount_type === 'percentage') {
            discountAmount = (cartSubtotal * discount.discount_value) / 100;
        } else if (discount.discount_type === 'fixed') {
            discountAmount = parseFloat(discount.discount_value);
        }
        // free_delivery type has discountAmount = 0 (shipping handled separately)

        // Ensure discount doesn't exceed subtotal (not applicable for free_delivery)
        if (discount.discount_type !== 'free_delivery') {
            discountAmount = Math.min(discountAmount, cartSubtotal);
        }

        // Round to 2 decimal places
        discountAmount = Math.round(discountAmount * 100) / 100;

        // Generate appropriate message
        let message;
        if (discount.discount_type === 'percentage') {
            message = `${discount.discount_value}% off applied!`;
        } else if (discount.discount_type === 'free_delivery') {
            message = 'Free delivery applied!';
        } else {
            message = `£${parseFloat(discount.discount_value).toFixed(2)} off applied!`;
        }

        return successResponse({
            valid: true,
            code: discount.code,
            name: discount.name,
            discount_type: discount.discount_type,
            discount_value: parseFloat(discount.discount_value),
            discount_amount: discountAmount,
            min_order_amount: discount.min_order_amount ? parseFloat(discount.min_order_amount) : null,
            message
        }, headers);

    } catch (error) {
        console.error('Validate discount error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

/**
 * Validate Gift Card API
 * POST /api/validate-gift-card - Validate a gift card code for checkout
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
            return errorResponse(400, 'Gift card code is required', headers);
        }

        // Look up the gift card
        const { data: giftCard, error } = await supabase
            .from('gift_cards')
            .select('*')
            .eq('code', code.toUpperCase().trim())
            .single();

        if (error || !giftCard) {
            return errorResponse(400, 'Invalid gift card code', headers);
        }

        // Check if gift card is active
        if (giftCard.status !== 'active') {
            const statusMessages = {
                'pending': 'This gift card has not been activated yet',
                'depleted': 'This gift card has no remaining balance',
                'expired': 'This gift card has expired',
                'cancelled': 'This gift card has been cancelled'
            };
            return errorResponse(400, statusMessages[giftCard.status] || 'This gift card is not valid', headers);
        }

        // Check if gift card has expired
        if (giftCard.expires_at) {
            const expiresAt = new Date(giftCard.expires_at);
            if (expiresAt < new Date()) {
                // Update status to expired
                await supabase
                    .from('gift_cards')
                    .update({ status: 'expired' })
                    .eq('id', giftCard.id);

                return errorResponse(400, 'This gift card has expired', headers);
            }
        }

        // Check balance
        const currentBalance = parseFloat(giftCard.current_balance);
        if (currentBalance <= 0) {
            return errorResponse(400, 'This gift card has no remaining balance', headers);
        }

        // Calculate applicable amount
        const orderTotal = parseFloat(subtotal) || 0;
        const applicableAmount = Math.min(currentBalance, orderTotal);
        const coversFullOrder = currentBalance >= orderTotal;

        // Round to 2 decimal places
        const roundedApplicable = Math.round(applicableAmount * 100) / 100;
        const remainingBalance = Math.round((currentBalance - roundedApplicable) * 100) / 100;

        return successResponse({
            valid: true,
            code: giftCard.code,
            balance: currentBalance,
            applicable_amount: roundedApplicable,
            remaining_after_use: remainingBalance,
            covers_full_order: coversFullOrder,
            message: `Gift card balance: £${currentBalance.toFixed(2)}`
        }, headers);

    } catch (error) {
        console.error('Validate gift card error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

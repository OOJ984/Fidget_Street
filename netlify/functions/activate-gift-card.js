/**
 * Activate Gift Card API
 * POST /api/activate-gift-card - Verify Stripe session and activate gift card
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
        const { session_id, code } = JSON.parse(event.body);

        if (!session_id || !code) {
            return errorResponse(400, 'Session ID and code are required', headers);
        }

        // Verify the Stripe session
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (!session) {
            return errorResponse(400, 'Invalid session', headers);
        }

        if (session.payment_status !== 'paid') {
            return errorResponse(400, 'Payment not completed', headers);
        }

        // Verify the session metadata matches
        if (session.metadata?.gift_card_code !== code) {
            return errorResponse(400, 'Session does not match gift card', headers);
        }

        // Activate the gift card
        const { data: giftCard, error: updateError } = await supabase
            .from('gift_cards')
            .update({
                status: 'active',
                activated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('code', code)
            .eq('status', 'pending')
            .select('id, code, initial_balance, status')
            .single();

        if (updateError) {
            // Card might already be active (idempotent)
            const { data: existingCard } = await supabase
                .from('gift_cards')
                .select('id, code, initial_balance, status')
                .eq('code', code)
                .single();

            if (existingCard && existingCard.status === 'active') {
                return successResponse({
                    success: true,
                    code: existingCard.code,
                    amount: existingCard.initial_balance,
                    message: 'Gift card already active'
                }, headers);
            }

            console.error('Gift card activation error:', updateError);
            return errorResponse(500, 'Failed to activate gift card', headers);
        }

        return successResponse({
            success: true,
            code: giftCard.code,
            amount: giftCard.initial_balance
        }, headers);

    } catch (error) {
        console.error('Activate gift card error:', error);
        return errorResponse(500, error.message || 'Activation failed', headers);
    }
};

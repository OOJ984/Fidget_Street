/**
 * Check Gift Card Balance API
 * POST /api/check-gift-card - Get gift card balance and transaction history
 *
 * Public endpoint - no authentication required.
 * Returns balance, status, and transaction history for a gift card code.
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
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (parseError) {
            return errorResponse(400, 'Invalid JSON in request body', headers);
        }

        const { code } = body;

        // Validate code format
        if (!code || typeof code !== 'string') {
            return errorResponse(400, 'Gift card code is required', headers);
        }

        const cleanCode = code.trim().toUpperCase();

        // Validate format: GC-XXXX-XXXX-XXXX
        if (!/^GC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanCode)) {
            return errorResponse(400, 'Invalid gift card code format', headers);
        }

        // Fetch gift card
        const { data: giftCard, error: gcError } = await supabase
            .from('gift_cards')
            .select('id, code, initial_balance, current_balance, currency, status, expires_at, activated_at, created_at')
            .eq('code', cleanCode)
            .single();

        if (gcError || !giftCard) {
            return errorResponse(404, 'Gift card not found. Please check the code and try again.', headers);
        }

        // Check if card is pending (not yet paid for)
        if (giftCard.status === 'pending') {
            return errorResponse(400, 'This gift card has not been activated yet. Payment may still be processing.', headers);
        }

        // Check if card has expired
        if (giftCard.expires_at) {
            const expiryDate = new Date(giftCard.expires_at);
            const now = new Date();

            if (expiryDate <= now && giftCard.status !== 'expired') {
                // Card has expired - update status in database
                await supabase
                    .from('gift_cards')
                    .update({
                        status: 'expired',
                        current_balance: 0,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', giftCard.id);

                // Log the expiration
                await supabase
                    .from('gift_card_transactions')
                    .insert([{
                        gift_card_id: giftCard.id,
                        transaction_type: 'expiration',
                        amount: -giftCard.current_balance,
                        balance_after: 0,
                        notes: 'Gift card expired - balance forfeited',
                        created_at: new Date().toISOString()
                    }]);

                // Update local object for response
                giftCard.status = 'expired';
                giftCard.current_balance = 0;
            }
        }

        // Fetch transaction history
        const { data: transactions, error: txError } = await supabase
            .from('gift_card_transactions')
            .select('id, transaction_type, amount, balance_after, order_number, notes, created_at')
            .eq('gift_card_id', giftCard.id)
            .order('created_at', { ascending: false });

        if (txError) {
            console.error('Error fetching transactions:', txError);
            // Continue without transactions - not critical
        }

        // Return gift card details and transactions
        return successResponse({
            giftCard: {
                code: giftCard.code,
                initial_balance: giftCard.initial_balance,
                current_balance: giftCard.current_balance,
                currency: giftCard.currency,
                status: giftCard.status,
                expires_at: giftCard.expires_at,
                activated_at: giftCard.activated_at,
                created_at: giftCard.created_at
            },
            transactions: transactions || []
        }, headers);

    } catch (error) {
        console.error('Check gift card error:', error);
        return errorResponse(500, 'Failed to check gift card balance', headers);
    }
};

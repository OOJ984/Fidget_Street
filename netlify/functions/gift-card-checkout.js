/**
 * Gift Card Checkout API
 * POST /api/gift-card-checkout - Create Stripe checkout session for gift card purchase
 *
 * Creates a pending gift card record and redirects to Stripe for payment.
 * On successful payment, webhook will activate the gift card.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { getCorsHeaders, errorResponse, successResponse } = require('./utils/security');
const { validateEmail } = require('./utils/validation');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

/**
 * Generate a unique gift card code using cryptographically secure random
 */
async function generateGiftCardCode() {
    const crypto = require('crypto');
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        // Generate code: GC-XXXX-XXXX-XXXX using crypto.randomBytes
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0,O,1,I,L)
        const randomBytes = crypto.randomBytes(12); // 12 bytes for 12 characters
        let code = 'GC-';
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 4; j++) {
                const idx = i * 4 + j;
                code += chars.charAt(randomBytes[idx] % chars.length);
            }
            if (i < 2) code += '-';
        }

        // Check if code exists
        const { data: existing } = await supabase
            .from('gift_cards')
            .select('id')
            .eq('code', code)
            .single();

        if (!existing) {
            return code;
        }

        attempts++;
    }

    throw new Error('Could not generate unique gift card code');
}

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

        const {
            amount,
            purchaser_name,
            purchaser_email,
            recipient_name,
            recipient_email,
            personal_message
        } = body;

        // Validate required fields
        if (!amount || !purchaser_name || !purchaser_email) {
            return errorResponse(400, 'Amount, name, and email are required', headers);
        }

        // Validate amount
        const giftCardAmount = parseFloat(amount);
        if (isNaN(giftCardAmount) || giftCardAmount < 5 || giftCardAmount > 500) {
            return errorResponse(400, 'Amount must be between £5 and £500', headers);
        }

        // Validate email
        const emailValidation = validateEmail(purchaser_email);
        if (!emailValidation.valid) {
            return errorResponse(400, emailValidation.error, headers);
        }

        // Validate recipient email if provided
        if (recipient_email) {
            const recipientValidation = validateEmail(recipient_email);
            if (!recipientValidation.valid) {
                return errorResponse(400, 'Invalid recipient email address', headers);
            }
        }

        // Generate unique gift card code
        const code = await generateGiftCardCode();

        // Calculate expiry date (1 year from now)
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // Create pending gift card record
        const { data: giftCard, error: gcError } = await supabase
            .from('gift_cards')
            .insert([{
                code,
                initial_balance: giftCardAmount,
                current_balance: giftCardAmount,
                currency: 'GBP',
                purchaser_email: purchaser_email,
                purchaser_name: purchaser_name,
                recipient_email: recipient_email || null,
                recipient_name: recipient_name || null,
                personal_message: personal_message || null,
                source: 'purchase',
                status: 'pending', // Will be activated by webhook
                is_sent: false,
                expires_at: expiryDate.toISOString()
            }])
            .select('id, code')
            .single();

        if (gcError) {
            console.error('Gift card creation error:', gcError);
            console.error('Error details:', JSON.stringify(gcError, null, 2));
            return errorResponse(500, `Failed to create gift card: ${gcError.message || gcError.code || 'Unknown error'}`, headers);
        }

        // Get base URL for redirects
        const baseUrl = process.env.URL || 'https://fidgetstreet.co.uk';

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: `Fidget Street Gift Card - £${giftCardAmount.toFixed(2)}`,
                        description: recipient_name
                            ? `Gift for ${recipient_name}`
                            : 'Digital Gift Card',
                    },
                    unit_amount: Math.round(giftCardAmount * 100), // Convert to pence
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${baseUrl}/gift-card-success.html?code=${code}&amount=${giftCardAmount}`,
            cancel_url: `${baseUrl}/gift-cards.html`,
            customer_email: purchaser_email,
            metadata: {
                type: 'gift_card_purchase',
                gift_card_id: giftCard.id.toString(),
                gift_card_code: code,
                gift_card_amount: giftCardAmount.toString(),
                recipient_email: recipient_email || '',
                recipient_name: recipient_name || ''
            }
        });

        // Update gift card with Stripe session ID for reference
        await supabase
            .from('gift_cards')
            .update({ notes: `Stripe Session: ${session.id}` })
            .eq('id', giftCard.id);

        return successResponse({
            sessionId: session.id,
            url: session.url
        }, headers);

    } catch (error) {
        console.error('Gift card checkout error:', error);
        return errorResponse(500, error.message || 'Checkout failed', headers);
    }
};

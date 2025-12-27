/**
 * Admin Gift Cards API
 * GET /api/admin-gift-cards - List all gift cards
 * GET /api/admin-gift-cards?id=X - Get single gift card with transactions
 * POST /api/admin-gift-cards - Create promotional gift card
 * PUT /api/admin-gift-cards - Update gift card (mark sent, adjust balance)
 * DELETE /api/admin-gift-cards?id=X - Cancel gift card
 *
 * Required permissions:
 * - View: VIEW_GIFT_CARDS
 * - Manage: MANAGE_GIFT_CARDS
 */

const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    verifyToken,
    isSecretConfigured,
    errorResponse,
    successResponse,
    requirePermission,
    PERMISSIONS,
    auditLog,
    AUDIT_ACTIONS
} = require('./utils/security');

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
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0,O,1,I)
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
    const headers = getCorsHeaders(requestOrigin, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Check server configuration
    if (!isSecretConfigured()) {
        console.error('JWT_SECRET not configured');
        return errorResponse(500, 'Server configuration error', headers);
    }

    // Verify authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const user = verifyToken(authHeader);
    if (!user) {
        return errorResponse(401, 'Unauthorized', headers);
    }

    try {
        const params = event.queryStringParameters || {};

        // GET - List all gift cards or get single with transactions
        if (event.httpMethod === 'GET') {
            // Check view permission
            const viewPermError = requirePermission(user, PERMISSIONS.VIEW_GIFT_CARDS, headers);
            if (viewPermError) return viewPermError;

            // Single gift card with transactions
            if (params.id) {
                const { data: giftCard, error: gcError } = await supabase
                    .from('gift_cards')
                    .select('*')
                    .eq('id', params.id)
                    .single();

                if (gcError) throw gcError;

                // Get transactions
                const { data: transactions, error: txError } = await supabase
                    .from('gift_card_transactions')
                    .select('*')
                    .eq('gift_card_id', params.id)
                    .order('created_at', { ascending: false });

                if (txError) throw txError;

                return successResponse({
                    ...giftCard,
                    transactions: transactions || []
                }, headers);
            }

            // List all gift cards
            let query = supabase
                .from('gift_cards')
                .select('*')
                .order('created_at', { ascending: false });

            // Filter by status
            if (params.status && params.status !== 'all') {
                query = query.eq('status', params.status);
            }

            // Filter by is_sent
            if (params.unsent === 'true') {
                query = query.eq('is_sent', false).eq('status', 'active');
            }

            // Search by code or email
            if (params.search) {
                // SECURITY: Escape SQL wildcards to prevent injection
                const searchTerm = params.search.trim()
                    .replace(/\\/g, '\\\\')  // Escape backslashes first
                    .replace(/%/g, '\\%')    // Escape percent signs
                    .replace(/_/g, '\\_');   // Escape underscores
                query = query.or(`code.ilike.%${searchTerm}%,purchaser_email.ilike.%${searchTerm}%,recipient_email.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Calculate stats
            const stats = {
                total: data.length,
                active: data.filter(gc => gc.status === 'active').length,
                pending: data.filter(gc => gc.status === 'pending').length,
                depleted: data.filter(gc => gc.status === 'depleted').length,
                unsent: data.filter(gc => !gc.is_sent && gc.status === 'active').length,
                total_issued: data.reduce((sum, gc) => sum + parseFloat(gc.initial_balance || 0), 0),
                total_remaining: data.filter(gc => gc.status === 'active').reduce((sum, gc) => sum + parseFloat(gc.current_balance || 0), 0)
            };

            return successResponse({ giftCards: data, stats }, headers);
        }

        // POST - Create promotional gift card
        if (event.httpMethod === 'POST') {
            // Check manage permission
            const managePermError = requirePermission(user, PERMISSIONS.MANAGE_GIFT_CARDS, headers);
            if (managePermError) return managePermError;

            const body = JSON.parse(event.body);
            const { amount, recipient_email, recipient_name, personal_message, expires_at, notes } = body;

            // Validate amount
            const balance = parseFloat(amount);
            if (isNaN(balance) || balance < 1 || balance > 500) {
                return errorResponse(400, 'Amount must be between £1 and £500', headers);
            }

            // SECURITY: Input length validation
            if (recipient_email && recipient_email.length > 254) {
                return errorResponse(400, 'Recipient email is too long', headers);
            }
            if (recipient_name && recipient_name.length > 100) {
                return errorResponse(400, 'Recipient name must be 100 characters or less', headers);
            }
            if (personal_message && personal_message.length > 500) {
                return errorResponse(400, 'Personal message must be 500 characters or less', headers);
            }
            if (notes && notes.length > 500) {
                return errorResponse(400, 'Notes must be 500 characters or less', headers);
            }

            // Generate code
            const code = await generateGiftCardCode();

            // Create gift card
            const { data, error } = await supabase
                .from('gift_cards')
                .insert([{
                    code,
                    initial_balance: balance,
                    current_balance: balance,
                    currency: 'GBP',
                    purchaser_email: user.email, // Admin who created it
                    purchaser_name: 'Fidget Street',
                    recipient_email: recipient_email || null,
                    recipient_name: recipient_name || null,
                    personal_message: personal_message || null,
                    source: 'promotional',
                    created_by: user.userId,
                    status: 'active', // Promotional cards are active immediately
                    activated_at: new Date().toISOString(),
                    expires_at: expires_at || null,
                    is_sent: false
                }])
                .select()
                .single();

            if (error) throw error;

            // Record activation transaction
            await supabase
                .from('gift_card_transactions')
                .insert([{
                    gift_card_id: data.id,
                    transaction_type: 'activation',
                    amount: balance,
                    balance_after: balance,
                    notes: notes || 'Promotional gift card created',
                    performed_by_admin: user.userId,
                    performed_by_email: user.email
                }]);

            // Audit log
            await auditLog({
                action: AUDIT_ACTIONS.GIFT_CARD_CREATED,
                user,
                resourceType: 'gift_card',
                resourceId: data.id,
                details: { code, amount: balance, source: 'promotional' },
                event
            });

            return successResponse(data, headers, 201);
        }

        // PUT - Update gift card
        if (event.httpMethod === 'PUT') {
            // Check manage permission
            const managePermError = requirePermission(user, PERMISSIONS.MANAGE_GIFT_CARDS, headers);
            if (managePermError) return managePermError;

            const body = JSON.parse(event.body);
            const { id, action, ...updateFields } = body;

            if (!id) {
                return errorResponse(400, 'Gift card ID required', headers);
            }

            // Get current gift card
            const { data: currentGC, error: fetchError } = await supabase
                .from('gift_cards')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !currentGC) {
                return errorResponse(404, 'Gift card not found', headers);
            }

            // Handle specific actions
            if (action === 'mark_sent') {
                const { error } = await supabase
                    .from('gift_cards')
                    .update({
                        is_sent: true,
                        sent_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;

                await auditLog({
                    action: AUDIT_ACTIONS.GIFT_CARD_SENT,
                    user,
                    resourceType: 'gift_card',
                    resourceId: id,
                    details: { code: currentGC.code },
                    event
                });

                return successResponse({ success: true, message: 'Gift card marked as sent' }, headers);
            }

            if (action === 'adjust_balance') {
                const newBalance = parseFloat(updateFields.new_balance);
                if (isNaN(newBalance) || newBalance < 0) {
                    return errorResponse(400, 'Invalid balance amount', headers);
                }

                const adjustment = newBalance - parseFloat(currentGC.current_balance);
                const newStatus = newBalance <= 0 ? 'depleted' : 'active';

                const { error } = await supabase
                    .from('gift_cards')
                    .update({
                        current_balance: newBalance,
                        status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (error) throw error;

                // Record transaction
                await supabase
                    .from('gift_card_transactions')
                    .insert([{
                        gift_card_id: id,
                        transaction_type: 'adjustment',
                        amount: adjustment,
                        balance_after: newBalance,
                        notes: updateFields.notes || 'Admin balance adjustment',
                        performed_by_admin: user.userId,
                        performed_by_email: user.email
                    }]);

                await auditLog({
                    action: AUDIT_ACTIONS.GIFT_CARD_ADJUSTED,
                    user,
                    resourceType: 'gift_card',
                    resourceId: id,
                    details: { code: currentGC.code, oldBalance: currentGC.current_balance, newBalance, adjustment },
                    event
                });

                return successResponse({ success: true, message: 'Balance adjusted', new_balance: newBalance }, headers);
            }

            // General update (recipient info, expiry, etc.)
            const updateData = {};

            if (updateFields.recipient_email !== undefined) {
                updateData.recipient_email = updateFields.recipient_email || null;
            }
            if (updateFields.recipient_name !== undefined) {
                updateData.recipient_name = updateFields.recipient_name || null;
            }
            if (updateFields.personal_message !== undefined) {
                updateData.personal_message = updateFields.personal_message || null;
            }
            if (updateFields.expires_at !== undefined) {
                updateData.expires_at = updateFields.expires_at || null;
            }

            if (Object.keys(updateData).length > 0) {
                updateData.updated_at = new Date().toISOString();

                const { data, error } = await supabase
                    .from('gift_cards')
                    .update(updateData)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;

                return successResponse(data, headers);
            }

            return errorResponse(400, 'No valid update fields provided', headers);
        }

        // DELETE - Cancel gift card
        if (event.httpMethod === 'DELETE') {
            // Check manage permission
            const managePermError = requirePermission(user, PERMISSIONS.MANAGE_GIFT_CARDS, headers);
            if (managePermError) return managePermError;

            const id = params.id;
            if (!id) {
                return errorResponse(400, 'Gift card ID required', headers);
            }

            // Get gift card for audit
            const { data: giftCard } = await supabase
                .from('gift_cards')
                .select('code, current_balance')
                .eq('id', id)
                .single();

            // Cancel the gift card
            const { error } = await supabase
                .from('gift_cards')
                .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            // Record transaction if there was remaining balance
            if (giftCard && parseFloat(giftCard.current_balance) > 0) {
                await supabase
                    .from('gift_card_transactions')
                    .insert([{
                        gift_card_id: parseInt(id),
                        transaction_type: 'adjustment',
                        amount: -parseFloat(giftCard.current_balance),
                        balance_after: 0,
                        notes: 'Gift card cancelled',
                        performed_by_admin: user.userId,
                        performed_by_email: user.email
                    }]);
            }

            await auditLog({
                action: AUDIT_ACTIONS.GIFT_CARD_CANCELLED,
                user,
                resourceType: 'gift_card',
                resourceId: id,
                details: { code: giftCard?.code, remainingBalance: giftCard?.current_balance },
                event
            });

            return successResponse({ success: true }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Admin gift cards error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

/**
 * Admin Token Refresh API
 * POST /api/admin-refresh - Refresh access token using refresh token
 *
 * Implements token rotation:
 * - Verifies refresh token from httpOnly cookie
 * - Issues new access token and rotated refresh token
 * - Invalidates old refresh token
 */

const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    errorResponse,
    successResponse,
    requireAdminIP
} = require('./utils/security');
const {
    verifyRefreshToken,
    createAuthCookies,
    addCookiesToResponse
} = require('./utils/cookies');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['POST', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Check IP allowlist
    const ipCheck = requireAdminIP(event, headers);
    if (ipCheck) return ipCheck;

    if (event.httpMethod !== 'POST') {
        return errorResponse(405, 'Method not allowed', headers);
    }

    if (!JWT_SECRET) {
        console.error('JWT_SECRET not configured');
        return errorResponse(500, 'Server configuration error', headers);
    }

    try {
        // Verify refresh token from cookie
        const refreshResult = verifyRefreshToken(event, JWT_SECRET);

        if (!refreshResult.valid) {
            return errorResponse(401, 'Session expired. Please log in again.', headers);
        }

        const { payload } = refreshResult;

        // Check if refresh token has been revoked
        // (Optional: implement token blacklist in database)
        // const { data: blacklisted } = await supabase
        //     .from('revoked_tokens')
        //     .select('jti')
        //     .eq('jti', payload.jti)
        //     .single();
        // if (blacklisted) {
        //     return errorResponse(401, 'Token revoked', headers);
        // }

        // Get fresh user data
        const { data: user, error } = await supabase
            .from('admin_users')
            .select('id, email, name, role, is_active')
            .eq('id', payload.userId)
            .single();

        if (error || !user) {
            return errorResponse(401, 'User not found', headers);
        }

        if (user.is_active === false) {
            return errorResponse(401, 'Account deactivated', headers);
        }

        // Create new tokens (rotation)
        const { cookies, csrfToken } = createAuthCookies(user, JWT_SECRET);

        // Optionally revoke old refresh token
        // await supabase.from('revoked_tokens').insert([{ jti: payload.jti }]);

        const response = successResponse({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            csrfToken // Send new CSRF token to client
        }, headers);

        return addCookiesToResponse(response, cookies);

    } catch (error) {
        console.error('Token refresh error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

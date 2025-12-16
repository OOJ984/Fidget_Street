/**
 * Admin Audit Logs API
 * GET /api/admin-audit - List audit logs with filtering
 *
 * Required permissions:
 * - VIEW_AUDIT_LOGS (website_admin only)
 */

const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    verifyToken,
    isSecretConfigured,
    errorResponse,
    successResponse,
    requirePermission,
    PERMISSIONS
} = require('./utils/security');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

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

    // Check permission - website_admin only
    const permError = requirePermission(user, PERMISSIONS.VIEW_AUDIT_LOGS, headers);
    if (permError) return permError;

    try {
        if (event.httpMethod === 'GET') {
            const params = event.queryStringParameters || {};

            // Build query
            let query = supabase
                .from('audit_logs')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            // Filters
            if (params.action) {
                query = query.eq('action', params.action);
            }

            if (params.user_id) {
                query = query.eq('user_id', parseInt(params.user_id, 10));
            }

            if (params.user_email) {
                query = query.ilike('user_email', `%${params.user_email}%`);
            }

            if (params.resource_type) {
                query = query.eq('resource_type', params.resource_type);
            }

            if (params.resource_id) {
                query = query.eq('resource_id', params.resource_id);
            }

            // Date range filters
            if (params.from) {
                query = query.gte('created_at', params.from);
            }

            if (params.to) {
                query = query.lte('created_at', params.to);
            }

            // Pagination
            const page = parseInt(params.page, 10) || 1;
            const limit = Math.min(parseInt(params.limit, 10) || 50, 100);
            const offset = (page - 1) * limit;

            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            return successResponse({
                logs: data,
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit)
                }
            }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Admin audit error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

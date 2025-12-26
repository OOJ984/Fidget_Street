/**
 * Admin Analytics API
 * GET /api/admin-analytics - Get analytics data
 *
 * Query params:
 * - period: 'today', '7days', '30days', 'all' (default: '7days')
 */

const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    verifyToken,
    isSecretConfigured,
    errorResponse,
    successResponse
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

    if (event.httpMethod !== 'GET') {
        return errorResponse(405, 'Method not allowed', headers);
    }

    // Check server configuration
    if (!isSecretConfigured()) {
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
        const period = params.period || '7days';

        // Calculate date range
        let startDate;
        const now = new Date();
        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case '7days':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30days':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'all':
                startDate = new Date(0);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Get total views
        let query = supabase
            .from('page_views')
            .select('*', { count: 'exact', head: false });

        if (period !== 'all') {
            query = query.gte('created_at', startDate.toISOString());
        }

        const { data: views, count: totalViews, error: viewsError } = await query;
        if (viewsError) throw viewsError;

        // Get unique visitors (by session_id)
        const uniqueSessions = new Set(views?.map(v => v.session_id).filter(Boolean));
        const uniqueVisitors = uniqueSessions.size;

        // Get views by page
        const pageViewCounts = {};
        views?.forEach(view => {
            const path = view.page_path;
            pageViewCounts[path] = (pageViewCounts[path] || 0) + 1;
        });

        const topPages = Object.entries(pageViewCounts)
            .map(([page_path, views]) => ({ page_path, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);

        // Get views by device
        const deviceCounts = {};
        views?.forEach(view => {
            const device = view.device_type || 'unknown';
            deviceCounts[device] = (deviceCounts[device] || 0) + 1;
        });

        // Get views by day
        const dailyViews = {};
        views?.forEach(view => {
            const date = new Date(view.created_at).toISOString().split('T')[0];
            dailyViews[date] = (dailyViews[date] || 0) + 1;
        });

        const dailyBreakdown = Object.entries(dailyViews)
            .map(([date, views]) => ({ date, views }))
            .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first

        // Get top referrers
        const referrerCounts = {};
        views?.forEach(view => {
            if (view.referrer) {
                try {
                    const url = new URL(view.referrer);
                    const domain = url.hostname;
                    referrerCounts[domain] = (referrerCounts[domain] || 0) + 1;
                } catch (e) {
                    // Invalid URL, skip
                }
            }
        });

        const topReferrers = Object.entries(referrerCounts)
            .map(([referrer, count]) => ({ referrer, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Calculate today's views
        const today = new Date().toISOString().split('T')[0];
        const todayViews = dailyViews[today] || 0;

        // Calculate average daily views
        const numDays = Object.keys(dailyViews).length || 1;
        const avgDaily = (totalViews || 0) / numDays;

        return successResponse({
            period,
            totalViews: totalViews || 0,
            uniqueVisitors,
            todayViews,
            avgDaily,
            topPages,
            devices: deviceCounts,
            dailyBreakdown,
            topReferrers
        }, headers);

    } catch (error) {
        console.error('Analytics error:', error);
        return errorResponse(500, 'Failed to fetch analytics', headers);
    }
};

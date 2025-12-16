/**
 * Health Check API
 * GET /api/health - Check service and database health
 *
 * Returns status of:
 * - API function availability
 * - Database connectivity
 * - Environment configuration
 */

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const checks = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
            api: { status: 'ok' },
            database: { status: 'unknown' },
            config: { status: 'unknown' }
        }
    };

    // Check environment configuration
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);

    if (missingVars.length > 0) {
        checks.checks.config = {
            status: 'error',
            message: 'Missing required environment variables'
        };
        checks.status = 'degraded';
    } else {
        checks.checks.config = { status: 'ok' };
    }

    // Check database connectivity
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
        );

        const startTime = Date.now();
        const { error } = await supabase
            .from('products')
            .select('id')
            .limit(1);

        const latency = Date.now() - startTime;

        if (error) {
            checks.checks.database = {
                status: 'error',
                message: 'Database query failed',
                latency_ms: latency
            };
            checks.status = 'unhealthy';
        } else {
            checks.checks.database = {
                status: 'ok',
                latency_ms: latency
            };
        }
    } catch (err) {
        checks.checks.database = {
            status: 'error',
            message: 'Database connection failed'
        };
        checks.status = 'unhealthy';
    }

    // Determine overall status code
    const statusCode = checks.status === 'healthy' ? 200 :
                       checks.status === 'degraded' ? 200 : 503;

    return {
        statusCode,
        headers,
        body: JSON.stringify(checks)
    };
};

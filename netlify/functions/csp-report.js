/**
 * CSP Report Handler
 * POST /api/csp-report - Receive Content Security Policy violation reports
 *
 * This endpoint receives CSP violation reports from browsers and logs them
 * for monitoring potential XSS attempts or misconfigurations.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    // CSP reports can come from any origin
    const headers = {
        'Content-Type': 'application/json'
    };

    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: '' };
    }

    try {
        // Parse CSP report (browsers send as application/csp-report)
        let report;
        try {
            const body = JSON.parse(event.body || '{}');
            // CSP reports are wrapped in a 'csp-report' object
            report = body['csp-report'] || body;
        } catch (e) {
            console.warn('Invalid CSP report format:', e.message);
            return { statusCode: 400, headers, body: '' };
        }

        // Extract useful information
        const violation = {
            document_uri: report['document-uri'] || report.documentUri || null,
            violated_directive: report['violated-directive'] || report.violatedDirective || null,
            effective_directive: report['effective-directive'] || report.effectiveDirective || null,
            original_policy: report['original-policy'] || report.originalPolicy || null,
            blocked_uri: report['blocked-uri'] || report.blockedUri || null,
            source_file: report['source-file'] || report.sourceFile || null,
            line_number: report['line-number'] || report.lineNumber || null,
            column_number: report['column-number'] || report.columnNumber || null,
            status_code: report['status-code'] || report.statusCode || null,
            script_sample: report['script-sample'] || report.scriptSample || null
        };

        // Log to console for monitoring
        console.log('CSP Violation:', JSON.stringify(violation, null, 2));

        // Check for suspicious patterns that might indicate XSS attempts
        const suspiciousPatterns = [
            /javascript:/i,
            /data:/i,
            /on\w+=/i,
            /<script/i
        ];

        const blockedUri = violation.blocked_uri || '';
        const scriptSample = violation.script_sample || '';
        const isSuspicious = suspiciousPatterns.some(pattern =>
            pattern.test(blockedUri) || pattern.test(scriptSample)
        );

        if (isSuspicious) {
            console.warn('SUSPICIOUS CSP VIOLATION - Potential XSS attempt:', violation);
        }

        // Store in audit log for analysis (optional - requires audit_logs table)
        try {
            await supabase.from('audit_logs').insert([{
                action: 'csp_violation',
                resource_type: 'security',
                details: {
                    ...violation,
                    suspicious: isSuspicious,
                    user_agent: event.headers['user-agent'] || null
                },
                ip_address: event.headers['x-forwarded-for']?.split(',')[0] ||
                           event.headers['client-ip'] || null,
                user_agent: event.headers['user-agent'] || null,
                created_at: new Date().toISOString()
            }]);
        } catch (dbError) {
            // Don't fail if audit logging fails
            console.error('Failed to log CSP violation to database:', dbError.message);
        }

        // Return 204 No Content (standard for report endpoints)
        return { statusCode: 204, headers, body: '' };

    } catch (error) {
        console.error('CSP report handler error:', error);
        // Still return success to avoid browser retries
        return { statusCode: 204, headers, body: '' };
    }
};

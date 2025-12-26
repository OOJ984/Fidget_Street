/**
 * Anomaly Detection Utilities
 *
 * Monitors for suspicious patterns that might indicate attacks:
 * - Multiple failed logins from same IP
 * - Gift card enumeration attempts
 * - Order amount manipulation
 * - Unusual access patterns
 */

const { createClient } = require('@supabase/supabase-js');

// Thresholds for anomaly detection
const THRESHOLDS = {
    FAILED_LOGINS_PER_IP: 5,           // Failed logins before alerting
    FAILED_LOGINS_WINDOW_HOURS: 1,      // Time window for failed logins
    GIFT_CARD_CHECKS_PER_IP: 10,        // Invalid gift card checks before alerting
    GIFT_CARD_WINDOW_HOURS: 1,          // Time window for gift card checks
    AMOUNT_MISMATCH_COUNT: 3,           // Amount mismatch orders before alerting
    AMOUNT_MISMATCH_WINDOW_HOURS: 24    // Time window for amount mismatches
};

// Alert types
const ALERT_TYPES = {
    BRUTE_FORCE_LOGIN: 'brute_force_login',
    GIFT_CARD_ENUMERATION: 'gift_card_enumeration',
    AMOUNT_MANIPULATION: 'amount_manipulation',
    UNUSUAL_ADMIN_ACCESS: 'unusual_admin_access',
    SUSPICIOUS_CSP_VIOLATION: 'suspicious_csp_violation'
};

let supabase = null;
function getSupabase() {
    if (!supabase) {
        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
        );
    }
    return supabase;
}

/**
 * Check for failed login anomalies
 * Called after each failed login attempt
 */
async function checkLoginAnomaly(email, ip) {
    try {
        const client = getSupabase();
        const windowStart = new Date(Date.now() - THRESHOLDS.FAILED_LOGINS_WINDOW_HOURS * 60 * 60 * 1000);

        // Count failed logins from this IP in the time window
        const { count, error } = await client
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('action', 'login_failed')
            .eq('ip_address', ip)
            .gte('created_at', windowStart.toISOString());

        if (error) {
            console.error('Anomaly detection query error:', error);
            return null;
        }

        if (count >= THRESHOLDS.FAILED_LOGINS_PER_IP) {
            await createAlert({
                type: ALERT_TYPES.BRUTE_FORCE_LOGIN,
                severity: 'high',
                details: {
                    ip,
                    email,
                    failedAttempts: count,
                    windowHours: THRESHOLDS.FAILED_LOGINS_WINDOW_HOURS
                },
                message: `Possible brute force attack: ${count} failed login attempts from IP ${ip}`
            });
            return { alert: true, type: ALERT_TYPES.BRUTE_FORCE_LOGIN };
        }

        return null;
    } catch (err) {
        console.error('Login anomaly check error:', err);
        return null;
    }
}

/**
 * Check for gift card enumeration attempts
 * Called after each invalid gift card check
 */
async function checkGiftCardAnomaly(ip, code) {
    try {
        const client = getSupabase();
        const windowStart = new Date(Date.now() - THRESHOLDS.GIFT_CARD_WINDOW_HOURS * 60 * 60 * 1000);

        // Count invalid gift card checks from this IP
        const { count, error } = await client
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('action', 'gift_card_check_failed')
            .eq('ip_address', ip)
            .gte('created_at', windowStart.toISOString());

        if (error) {
            console.error('Gift card anomaly query error:', error);
            return null;
        }

        if (count >= THRESHOLDS.GIFT_CARD_CHECKS_PER_IP) {
            await createAlert({
                type: ALERT_TYPES.GIFT_CARD_ENUMERATION,
                severity: 'medium',
                details: {
                    ip,
                    lastCodeTried: code,
                    attemptCount: count,
                    windowHours: THRESHOLDS.GIFT_CARD_WINDOW_HOURS
                },
                message: `Possible gift card enumeration: ${count} invalid checks from IP ${ip}`
            });
            return { alert: true, type: ALERT_TYPES.GIFT_CARD_ENUMERATION };
        }

        return null;
    } catch (err) {
        console.error('Gift card anomaly check error:', err);
        return null;
    }
}

/**
 * Check for amount manipulation patterns
 * Called when an order has amount mismatch
 */
async function checkAmountAnomaly(orderNumber, expectedAmount, actualAmount, email) {
    try {
        const client = getSupabase();
        const windowStart = new Date(Date.now() - THRESHOLDS.AMOUNT_MISMATCH_WINDOW_HOURS * 60 * 60 * 1000);

        // Count recent amount mismatch orders
        const { count, error } = await client
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .ilike('notes', '%AMOUNT MISMATCH%')
            .gte('created_at', windowStart.toISOString());

        if (error) {
            console.error('Amount anomaly query error:', error);
            return null;
        }

        if (count >= THRESHOLDS.AMOUNT_MISMATCH_COUNT) {
            await createAlert({
                type: ALERT_TYPES.AMOUNT_MANIPULATION,
                severity: 'critical',
                details: {
                    orderNumber,
                    expectedAmount,
                    actualAmount,
                    customerEmail: email,
                    mismatchCount: count,
                    windowHours: THRESHOLDS.AMOUNT_MISMATCH_WINDOW_HOURS
                },
                message: `CRITICAL: ${count} orders with amount mismatches in ${THRESHOLDS.AMOUNT_MISMATCH_WINDOW_HOURS}h - possible price manipulation attack`
            });
            return { alert: true, type: ALERT_TYPES.AMOUNT_MANIPULATION };
        }

        return null;
    } catch (err) {
        console.error('Amount anomaly check error:', err);
        return null;
    }
}

/**
 * Create an alert in the database
 */
async function createAlert({ type, severity, details, message }) {
    try {
        const client = getSupabase();

        // Log to audit_logs with special action
        await client.from('audit_logs').insert([{
            action: `security_alert_${type}`,
            resource_type: 'security',
            details: {
                alert_type: type,
                severity,
                message,
                ...details,
                timestamp: new Date().toISOString()
            },
            created_at: new Date().toISOString()
        }]);

        // Log to console with severity prefix
        const prefix = severity === 'critical' ? 'CRITICAL SECURITY ALERT' :
                      severity === 'high' ? 'HIGH SECURITY ALERT' :
                      'SECURITY ALERT';
        console.warn(`[${prefix}] ${message}`, details);

        // Future: Could add email/Slack notification here
        // if (process.env.ALERT_WEBHOOK_URL) { ... }

    } catch (err) {
        console.error('Failed to create security alert:', err);
    }
}

/**
 * Log a security event for later analysis
 */
async function logSecurityEvent(action, details, event) {
    try {
        const client = getSupabase();
        await client.from('audit_logs').insert([{
            action,
            resource_type: 'security',
            details,
            ip_address: event?.headers?.['x-forwarded-for']?.split(',')[0] ||
                       event?.headers?.['client-ip'] || null,
            user_agent: event?.headers?.['user-agent'] || null,
            created_at: new Date().toISOString()
        }]);
    } catch (err) {
        console.error('Failed to log security event:', err);
    }
}

module.exports = {
    ALERT_TYPES,
    THRESHOLDS,
    checkLoginAnomaly,
    checkGiftCardAnomaly,
    checkAmountAnomaly,
    createAlert,
    logSecurityEvent
};

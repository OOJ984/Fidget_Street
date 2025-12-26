/**
 * Admin Authentication API
 * POST /api/admin-auth - Login
 * GET /api/admin-auth - Verify token
 *
 * Security: bcrypt hashing, persistent rate limiting, restricted CORS
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { auditLog, AUDIT_ACTIONS, getCorsHeaders } = require('./utils/security');
const { checkRateLimit, recordFailedAttempt, clearRateLimit } = require('./utils/rateLimit');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// JWT_SECRET is required - no fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable is not set');
}

const TOKEN_EXPIRY = '24h';
const BCRYPT_ROUNDS = 12; // Standardized across all auth files

/**
 * Hash password with bcrypt
 */
async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against hash (supports both bcrypt and legacy SHA256)
 * Returns { valid: boolean, needsRehash: boolean }
 */
async function verifyPassword(password, storedHash) {
    // Check if it's a bcrypt hash (starts with $2)
    if (storedHash.startsWith('$2')) {
        const valid = await bcrypt.compare(password, storedHash);
        return { valid, needsRehash: false };
    }

    // Legacy SHA256 check (for migration)
    const sha256Hash = crypto.createHash('sha256')
        .update(password + JWT_SECRET)
        .digest('hex');

    if (sha256Hash === storedHash) {
        return { valid: true, needsRehash: true };
    }

    return { valid: false, needsRehash: false };
}


/**
 * Get client IP from request
 */
function getClientIP(event) {
    return event.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || event.headers['x-real-ip']
        || event.headers['client-ip']
        || 'unknown';
}

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin);

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Check JWT_SECRET is configured
    if (!JWT_SECRET) {
        console.error('JWT_SECRET not configured');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error' })
        };
    }

    try {
        // POST - Login
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { email, password } = body;

            if (!email || !password) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Email and password required' })
                };
            }

            const clientIP = getClientIP(event);

            // Check rate limiting (persistent via Supabase)
            const rateLimit = await checkRateLimit(email, clientIP);
            if (!rateLimit.allowed) {
                return {
                    statusCode: 429,
                    headers: {
                        ...headers,
                        'Retry-After': String(rateLimit.retryAfter)
                    },
                    body: JSON.stringify({
                        error: 'Too many login attempts. Please try again later.',
                        retryAfter: rateLimit.retryAfter
                    })
                };
            }

            // Check admin_users table
            const { data: user, error } = await supabase
                .from('admin_users')
                .select('id, email, name, role, password_hash, mfa_enabled, mfa_secret, is_active')
                .eq('email', email.toLowerCase())
                .single();

            if (error || !user) {
                await recordFailedAttempt(email, clientIP);
                await auditLog({
                    action: AUDIT_ACTIONS.LOGIN_FAILED,
                    user: { email },
                    details: { reason: 'User not found' },
                    event
                });
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid credentials' })
                };
            }

            // Check if user is active
            if (user.is_active === false) {
                await auditLog({
                    action: AUDIT_ACTIONS.LOGIN_FAILED,
                    user: { userId: user.id, email: user.email },
                    details: { reason: 'Account deactivated' },
                    event
                });
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Account is deactivated' })
                };
            }

            // Verify password
            const { valid, needsRehash } = await verifyPassword(password, user.password_hash);

            if (!valid) {
                await recordFailedAttempt(email, clientIP);
                // Audit log - wrong password
                await auditLog({
                    action: AUDIT_ACTIONS.LOGIN_FAILED,
                    user: { userId: user.id, email: user.email },
                    details: { reason: 'Invalid password' },
                    event
                });
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid credentials' })
                };
            }

            // Clear rate limit on successful login
            await clearRateLimit(email);

            // If using legacy SHA256, rehash to bcrypt
            if (needsRehash) {
                const newHash = await hashPassword(password);
                await supabase
                    .from('admin_users')
                    .update({ password_hash: newHash })
                    .eq('id', user.id);
                console.log(`Migrated password for user ${user.email} from SHA256 to bcrypt`);
            }

            // Check MFA status - MFA is MANDATORY for all admin users
            if (user.mfa_enabled) {
                // User has MFA enabled, require verification
                const preMfaToken = jwt.sign(
                    {
                        userId: user.id,
                        email: user.email,
                        preMfa: true
                    },
                    JWT_SECRET,
                    { expiresIn: '5m' }
                );

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        requiresMfa: true,
                        preMfaToken,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name
                        }
                    })
                };
            }

            // MFA not enabled - user MUST set it up (mandatory)
            if (!user.mfa_secret) {
                const setupToken = jwt.sign(
                    {
                        userId: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        mfaSetupRequired: true
                    },
                    JWT_SECRET,
                    { expiresIn: '10m' } // SECURITY: Reduced from 30m
                );

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        requiresMfaSetup: true,
                        token: setupToken,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role
                        },
                        message: 'MFA setup required. Please configure two-factor authentication.'
                    })
                };
            }

            // MFA secret exists but not enabled (user started but didn't finish setup)
            const setupToken = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    mfaSetupRequired: true
                },
                JWT_SECRET,
                { expiresIn: '30m' }
            );

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    requiresMfaSetup: true,
                    mfaPartialSetup: true,
                    token: setupToken,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role
                    },
                    message: 'Please complete MFA setup by verifying your authenticator app.'
                })
            };

        }

        // GET - Verify token
        if (event.httpMethod === 'GET') {
            const authHeader = event.headers.authorization || event.headers.Authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'No token provided' })
                };
            }

            const token = authHeader.substring(7);

            try {
                const decoded = jwt.verify(token, JWT_SECRET);

                // Check if user still exists and is active
                const { data: user, error } = await supabase
                    .from('admin_users')
                    .select('id, email, name, role')
                    .eq('id', decoded.userId)
                    .single();

                if (error || !user) {
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({ error: 'User not found or inactive' })
                    };
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        valid: true,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role
                        }
                    })
                };

            } catch (err) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid or expired token' })
                };
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Admin auth error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

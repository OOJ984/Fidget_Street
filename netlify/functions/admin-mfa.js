/**
 * Admin MFA API
 * POST /api/admin-mfa/setup - Generate MFA secret and QR code
 * POST /api/admin-mfa/verify - Verify TOTP and enable MFA
 * POST /api/admin-mfa/validate - Validate TOTP during login
 * POST /api/admin-mfa/backup - Use backup code
 * GET /api/admin-mfa/status - Check MFA status
 *
 * MFA is MANDATORY for all admin users.
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    verifyToken,
    isSecretConfigured,
    errorResponse,
    successResponse,
    auditLog,
    AUDIT_ACTIONS
} = require('./utils/security');

// SECURITY: In-memory rate limiting for MFA attempts
// In production, consider using Redis or database for distributed rate limiting
const mfaAttempts = new Map();
const MFA_MAX_ATTEMPTS = 5;
const MFA_LOCKOUT_MINUTES = 15;

function checkMfaRateLimit(userId) {
    const key = `mfa:${userId}`;
    const record = mfaAttempts.get(key);

    if (!record) {
        return { allowed: true };
    }

    // Check if lockout has expired
    const lockoutExpiry = record.lockedUntil;
    if (lockoutExpiry && lockoutExpiry > Date.now()) {
        const retryAfter = Math.ceil((lockoutExpiry - Date.now()) / 1000);
        return { allowed: false, retryAfter };
    }

    // Reset if lockout expired
    if (lockoutExpiry && lockoutExpiry <= Date.now()) {
        mfaAttempts.delete(key);
        return { allowed: true };
    }

    return { allowed: true };
}

function recordMfaFailure(userId) {
    const key = `mfa:${userId}`;
    const record = mfaAttempts.get(key) || { attempts: 0 };

    record.attempts++;
    record.lastAttempt = Date.now();

    if (record.attempts >= MFA_MAX_ATTEMPTS) {
        record.lockedUntil = Date.now() + (MFA_LOCKOUT_MINUTES * 60 * 1000);
    }

    mfaAttempts.set(key, record);
}

function clearMfaRateLimit(userId) {
    mfaAttempts.delete(`mfa:${userId}`);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '24h';
const ISSUER = 'Fidget Street';
const BACKUP_CODE_COUNT = 10;

// Generate backup codes
function generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
        // Generate 8-character alphanumeric codes
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
    }
    return codes;
}

// Generate per-user salt for backup code hashing
function generateBackupCodeSalt() {
    return crypto.randomBytes(16).toString('hex');
}

// SECURITY: Hash backup codes with per-user salt
function hashBackupCodes(codes, salt) {
    return codes.map(code =>
        crypto.createHash('sha256').update(code + salt).digest('hex')
    );
}

// SECURITY: Verify a backup code against stored hashes using per-user salt
function verifyBackupCode(code, hashedCodes, salt) {
    const hashedInput = crypto.createHash('sha256').update(code.toUpperCase() + salt).digest('hex');
    const index = hashedCodes.indexOf(hashedInput);
    return index;
}

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'POST', 'OPTIONS']);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (!isSecretConfigured()) {
        console.error('JWT_SECRET not configured');
        return errorResponse(500, 'Server configuration error', headers);
    }

    // Parse the action from the path
    const path = event.path.replace(/^\/\.netlify\/functions\/admin-mfa\/?/, '')
                         .replace(/^\/api\/admin-mfa\/?/, '');

    // /validate and /backup endpoints handle their own token verification (preMfaToken)
    // because the user doesn't have a full token yet during MFA validation
    const skipAuthForPaths = ['validate', 'backup'];

    let user = null;
    if (!skipAuthForPaths.includes(path)) {
        // Verify authentication for other endpoints
        const authHeader = event.headers.authorization || event.headers.Authorization;
        user = verifyToken(authHeader);
        if (!user) {
            return errorResponse(401, 'Unauthorized', headers);
        }
    }

    try {
        // GET /status - Check MFA status
        if (event.httpMethod === 'GET' && (path === 'status' || path === '')) {
            const { data: userData, error } = await supabase
                .from('admin_users')
                .select('mfa_enabled, mfa_secret')
                .eq('id', user.userId)
                .single();

            if (error) throw error;

            return successResponse({
                mfa_enabled: userData.mfa_enabled || false,
                mfa_configured: !!userData.mfa_secret
            }, headers);
        }

        if (event.httpMethod !== 'POST') {
            return errorResponse(405, 'Method not allowed', headers);
        }

        const body = JSON.parse(event.body || '{}');

        // POST /setup - Generate new MFA secret
        if (path === 'setup') {
            // Generate new secret
            const secret = speakeasy.generateSecret({
                name: `${ISSUER}:${user.email}`,
                issuer: ISSUER,
                length: 20
            });

            // Generate QR code as data URL
            const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

            // Store secret temporarily (not enabled yet)
            const { error } = await supabase
                .from('admin_users')
                .update({
                    mfa_secret: secret.base32,
                    mfa_enabled: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.userId);

            if (error) throw error;

            return successResponse({
                secret: secret.base32,
                qrCode: qrCodeUrl,
                message: 'Scan the QR code with your authenticator app, then verify with a code.'
            }, headers);
        }

        // POST /verify - Verify TOTP and enable MFA
        if (path === 'verify') {
            const { token } = body;

            if (!token) {
                return errorResponse(400, 'Verification code required', headers);
            }

            // Get user's secret
            const { data: userData, error: fetchError } = await supabase
                .from('admin_users')
                .select('mfa_secret, mfa_enabled')
                .eq('id', user.userId)
                .single();

            if (fetchError) throw fetchError;

            if (!userData.mfa_secret) {
                return errorResponse(400, 'MFA not set up. Please start setup first.', headers);
            }

            // Verify the token
            const verified = speakeasy.totp.verify({
                secret: userData.mfa_secret,
                encoding: 'base32',
                token: token.toString(),
                window: 1 // Allow 1 step tolerance (30 seconds)
            });

            if (!verified) {
                return errorResponse(400, 'Invalid verification code. Please try again.', headers);
            }

            // Generate backup codes with per-user salt
            const backupCodes = generateBackupCodes();
            const backupCodeSalt = generateBackupCodeSalt();
            const hashedBackupCodes = hashBackupCodes(backupCodes, backupCodeSalt);

            // Enable MFA and store hashed backup codes with salt
            const { error: updateError } = await supabase
                .from('admin_users')
                .update({
                    mfa_enabled: true,
                    mfa_backup_codes: hashedBackupCodes,
                    mfa_backup_salt: backupCodeSalt, // SECURITY: Store per-user salt
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.userId);

            if (updateError) throw updateError;

            // Audit log - MFA setup complete
            await auditLog({
                action: AUDIT_ACTIONS.MFA_SETUP,
                user,
                resourceType: 'user',
                resourceId: user.userId,
                details: { email: user.email },
                event
            });

            return successResponse({
                success: true,
                message: 'MFA enabled successfully!',
                backupCodes: backupCodes,
                warning: 'Save these backup codes securely. They will NOT be shown again.'
            }, headers);
        }

        // POST /validate - Validate TOTP during login (called after password auth)
        // This endpoint issues the final JWT after successful MFA verification
        if (path === 'validate') {
            const { token: mfaCode, preMfaToken } = body;

            if (!mfaCode || !preMfaToken) {
                return errorResponse(400, 'MFA code and preMfaToken required', headers);
            }

            // Verify the pre-MFA token
            let preMfaData;
            try {
                preMfaData = jwt.verify(preMfaToken, JWT_SECRET);
                if (!preMfaData.preMfa) {
                    return errorResponse(400, 'Invalid token type', headers);
                }
            } catch (err) {
                return errorResponse(401, 'Session expired. Please log in again.', headers);
            }

            // SECURITY: Check rate limiting for MFA attempts
            const rateLimit = checkMfaRateLimit(preMfaData.userId);
            if (!rateLimit.allowed) {
                return {
                    statusCode: 429,
                    headers: {
                        ...headers,
                        'Retry-After': String(rateLimit.retryAfter)
                    },
                    body: JSON.stringify({
                        error: 'Too many MFA attempts. Please try again later.',
                        retryAfter: rateLimit.retryAfter
                    })
                };
            }

            // Get user's full data
            const { data: userData, error: fetchError } = await supabase
                .from('admin_users')
                .select('id, email, name, role, mfa_secret, mfa_enabled, is_active')
                .eq('id', preMfaData.userId)
                .single();

            if (fetchError) throw fetchError;

            if (!userData || userData.is_active === false) {
                return errorResponse(401, 'Account not found or deactivated', headers);
            }

            if (!userData.mfa_enabled || !userData.mfa_secret) {
                return errorResponse(400, 'MFA not enabled for this user', headers);
            }

            // Verify the TOTP code
            const verified = speakeasy.totp.verify({
                secret: userData.mfa_secret,
                encoding: 'base32',
                token: mfaCode.toString(),
                window: 1
            });

            if (!verified) {
                // SECURITY: Record failed attempt
                recordMfaFailure(preMfaData.userId);
                return errorResponse(400, 'Invalid verification code', headers);
            }

            // SECURITY: Clear rate limit on success
            clearMfaRateLimit(preMfaData.userId);

            // MFA verified! Issue the final JWT
            const finalToken = jwt.sign(
                {
                    userId: userData.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role,
                    mfaVerified: true
                },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRY }
            );

            // Update last login
            await supabase
                .from('admin_users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', userData.id);

            // Audit log - login success after MFA
            await auditLog({
                action: AUDIT_ACTIONS.LOGIN_SUCCESS,
                user: { userId: userData.id, email: userData.email },
                resourceType: 'user',
                resourceId: userData.id,
                details: { method: 'totp' },
                event
            });

            // Audit log - MFA verified
            await auditLog({
                action: AUDIT_ACTIONS.MFA_VERIFIED,
                user: { userId: userData.id, email: userData.email },
                resourceType: 'user',
                resourceId: userData.id,
                event
            });

            return successResponse({
                success: true,
                token: finalToken,
                user: {
                    id: userData.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role
                }
            }, headers);
        }

        // POST /backup - Use backup code during login
        // This endpoint also issues the final JWT after successful backup code verification
        if (path === 'backup') {
            const { code, preMfaToken } = body;

            if (!code || !preMfaToken) {
                return errorResponse(400, 'Backup code and preMfaToken required', headers);
            }

            // Verify the pre-MFA token
            let preMfaData;
            try {
                preMfaData = jwt.verify(preMfaToken, JWT_SECRET);
                if (!preMfaData.preMfa) {
                    return errorResponse(400, 'Invalid token type', headers);
                }
            } catch (err) {
                return errorResponse(401, 'Session expired. Please log in again.', headers);
            }

            // SECURITY: Check rate limiting for MFA attempts (shared with TOTP)
            const rateLimit = checkMfaRateLimit(preMfaData.userId);
            if (!rateLimit.allowed) {
                return {
                    statusCode: 429,
                    headers: {
                        ...headers,
                        'Retry-After': String(rateLimit.retryAfter)
                    },
                    body: JSON.stringify({
                        error: 'Too many MFA attempts. Please try again later.',
                        retryAfter: rateLimit.retryAfter
                    })
                };
            }

            // Get user's full data including backup codes and salt
            const { data: userData, error: fetchError } = await supabase
                .from('admin_users')
                .select('id, email, name, role, mfa_backup_codes, mfa_backup_salt, is_active')
                .eq('id', preMfaData.userId)
                .single();

            if (fetchError) throw fetchError;

            if (!userData || userData.is_active === false) {
                return errorResponse(401, 'Account not found or deactivated', headers);
            }

            if (!userData.mfa_backup_codes || userData.mfa_backup_codes.length === 0) {
                return errorResponse(400, 'No backup codes available', headers);
            }

            // SECURITY: Find and verify backup code with per-user salt
            // Support both old (no salt) and new (with salt) backup codes
            const salt = userData.mfa_backup_salt || '';
            const codeIndex = verifyBackupCode(code, userData.mfa_backup_codes, salt);

            if (codeIndex === -1) {
                // SECURITY: Record failed attempt
                recordMfaFailure(preMfaData.userId);
                return errorResponse(400, 'Invalid backup code', headers);
            }

            // SECURITY: Clear rate limit on success
            clearMfaRateLimit(preMfaData.userId);

            // Remove used backup code
            const remainingCodes = [...userData.mfa_backup_codes];
            remainingCodes.splice(codeIndex, 1);

            await supabase
                .from('admin_users')
                .update({
                    mfa_backup_codes: remainingCodes,
                    last_login: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', userData.id);

            // Issue the final JWT
            const finalToken = jwt.sign(
                {
                    userId: userData.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role,
                    mfaVerified: true
                },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRY }
            );

            // Audit log - login success with backup code
            await auditLog({
                action: AUDIT_ACTIONS.LOGIN_SUCCESS,
                user: { userId: userData.id, email: userData.email },
                resourceType: 'user',
                resourceId: userData.id,
                details: { method: 'backup_code', remainingCodes: remainingCodes.length },
                event
            });

            return successResponse({
                success: true,
                token: finalToken,
                user: {
                    id: userData.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role
                },
                remainingCodes: remainingCodes.length,
                warning: remainingCodes.length < 3 ? 'You have few backup codes remaining. Consider regenerating them.' : null
            }, headers);
        }

        // POST /regenerate - Generate new backup codes (requires MFA verification first)
        if (path === 'regenerate') {
            const { token } = body;

            if (!token) {
                return errorResponse(400, 'Current MFA code required to regenerate backup codes', headers);
            }

            // Get user's secret
            const { data: userData, error: fetchError } = await supabase
                .from('admin_users')
                .select('mfa_secret, mfa_enabled')
                .eq('id', user.userId)
                .single();

            if (fetchError) throw fetchError;

            if (!userData.mfa_enabled) {
                return errorResponse(400, 'MFA not enabled', headers);
            }

            // Verify current token
            const verified = speakeasy.totp.verify({
                secret: userData.mfa_secret,
                encoding: 'base32',
                token: token.toString(),
                window: 1
            });

            if (!verified) {
                return errorResponse(400, 'Invalid verification code', headers);
            }

            // Generate new backup codes with new salt
            const backupCodes = generateBackupCodes();
            const backupCodeSalt = generateBackupCodeSalt();
            const hashedBackupCodes = hashBackupCodes(backupCodes, backupCodeSalt);

            const { error: updateError } = await supabase
                .from('admin_users')
                .update({
                    mfa_backup_codes: hashedBackupCodes,
                    mfa_backup_salt: backupCodeSalt, // SECURITY: Store new salt
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.userId);

            if (updateError) throw updateError;

            return successResponse({
                success: true,
                backupCodes: backupCodes,
                warning: 'Save these new backup codes securely. Old codes are now invalid.'
            }, headers);
        }

        return errorResponse(404, 'Unknown action', headers);

    } catch (error) {
        console.error('Admin MFA error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

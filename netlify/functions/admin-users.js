/**
 * Admin Users API
 * GET /api/admin-users - List all admin users
 * POST /api/admin-users - Create new admin user
 * PUT /api/admin-users - Update admin user
 * DELETE /api/admin-users - Deactivate admin user
 *
 * Required permissions:
 * - All operations: MANAGE_USERS (website_admin only)
 */

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    verifyToken,
    isSecretConfigured,
    errorResponse,
    successResponse,
    requirePermission,
    PERMISSIONS,
    ROLES,
    auditLog,
    AUDIT_ACTIONS
} = require('./utils/security');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const BCRYPT_ROUNDS = 12;

// Valid roles for admin users
const VALID_ROLES = [ROLES.BUSINESS_PROCESSING, ROLES.WEBSITE_ADMIN];

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

    // All user management requires MANAGE_USERS permission
    const permError = requirePermission(user, PERMISSIONS.MANAGE_USERS, headers);
    if (permError) return permError;

    try {
        // GET - List all admin users
        if (event.httpMethod === 'GET') {
            const { data, error } = await supabase
                .from('admin_users')
                .select('id, email, name, role, is_active, mfa_enabled, last_login, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return successResponse(data, headers);
        }

        // POST - Create new admin user
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { email, password, name, role } = body;

            // Validate required fields
            if (!email || !password) {
                return errorResponse(400, 'Email and password required', headers);
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return errorResponse(400, 'Invalid email format', headers);
            }

            // Validate password strength
            if (password.length < 8) {
                return errorResponse(400, 'Password must be at least 8 characters', headers);
            }

            // Validate role
            const userRole = role || ROLES.BUSINESS_PROCESSING;
            if (!VALID_ROLES.includes(userRole)) {
                return errorResponse(400, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, headers);
            }

            // Check if email already exists
            const { data: existing } = await supabase
                .from('admin_users')
                .select('id')
                .eq('email', email.toLowerCase())
                .single();

            if (existing) {
                return errorResponse(400, 'Email already in use', headers);
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            // Create user
            const { data, error } = await supabase
                .from('admin_users')
                .insert([{
                    email: email.toLowerCase(),
                    password_hash: passwordHash,
                    name: name || '',
                    role: userRole,
                    is_active: true,
                    mfa_enabled: false
                }])
                .select('id, email, name, role, is_active, mfa_enabled, created_at')
                .single();

            if (error) throw error;

            // Audit log - user created
            await auditLog({
                action: AUDIT_ACTIONS.USER_CREATED,
                user,
                resourceType: 'user',
                resourceId: data.id,
                details: { email: data.email, role: data.role },
                event
            });

            return successResponse(data, headers, 201);
        }

        // PUT - Update admin user
        if (event.httpMethod === 'PUT') {
            const body = JSON.parse(event.body);
            const { id, email, password, name, role, is_active } = body;

            if (!id) {
                return errorResponse(400, 'User ID required', headers);
            }

            // Prevent self-demotion/deactivation
            if (id === user.userId) {
                if (role && role !== user.role) {
                    return errorResponse(400, 'Cannot change your own role', headers);
                }
                if (is_active === false) {
                    return errorResponse(400, 'Cannot deactivate your own account', headers);
                }
            }

            const updateData = {};

            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return errorResponse(400, 'Invalid email format', headers);
                }
                updateData.email = email.toLowerCase();
            }

            if (password) {
                if (password.length < 8) {
                    return errorResponse(400, 'Password must be at least 8 characters', headers);
                }
                updateData.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
            }

            if (name !== undefined) updateData.name = name;

            if (role) {
                if (!VALID_ROLES.includes(role)) {
                    return errorResponse(400, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, headers);
                }
                updateData.role = role;
            }

            if (is_active !== undefined) updateData.is_active = is_active;

            updateData.updated_at = new Date().toISOString();

            // Get old user data for audit log
            const { data: oldUser } = await supabase
                .from('admin_users')
                .select('role, is_active')
                .eq('id', id)
                .single();

            const { data, error } = await supabase
                .from('admin_users')
                .update(updateData)
                .eq('id', id)
                .select('id, email, name, role, is_active, mfa_enabled, last_login, created_at')
                .single();

            if (error) throw error;

            // Audit log - determine specific action
            if (role && oldUser?.role !== role) {
                // Role change
                await auditLog({
                    action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
                    user,
                    resourceType: 'user',
                    resourceId: id,
                    details: { oldRole: oldUser?.role, newRole: role },
                    event
                });
            } else if (is_active === false && oldUser?.is_active === true) {
                // Deactivation via PUT
                await auditLog({
                    action: AUDIT_ACTIONS.USER_DEACTIVATED,
                    user,
                    resourceType: 'user',
                    resourceId: id,
                    details: { email: data.email },
                    event
                });
            } else if (password) {
                // Password change
                await auditLog({
                    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
                    user,
                    resourceType: 'user',
                    resourceId: id,
                    details: { changedBy: user.email, targetEmail: data.email },
                    event
                });
            } else {
                // General update
                await auditLog({
                    action: AUDIT_ACTIONS.USER_UPDATED,
                    user,
                    resourceType: 'user',
                    resourceId: id,
                    details: { updatedFields: Object.keys(updateData).filter(k => k !== 'updated_at' && k !== 'password_hash') },
                    event
                });
            }

            return successResponse(data, headers);
        }

        // DELETE - Deactivate admin user (soft delete)
        if (event.httpMethod === 'DELETE') {
            const params = event.queryStringParameters || {};
            const id = params.id;

            if (!id) {
                return errorResponse(400, 'User ID required', headers);
            }

            // Prevent self-deletion
            if (parseInt(id, 10) === user.userId) {
                return errorResponse(400, 'Cannot deactivate your own account', headers);
            }

            // Get user email for audit log
            const { data: targetUser } = await supabase
                .from('admin_users')
                .select('email')
                .eq('id', id)
                .single();

            // Soft delete by setting is_active to false
            const { error } = await supabase
                .from('admin_users')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            // Audit log - user deactivated
            await auditLog({
                action: AUDIT_ACTIONS.USER_DEACTIVATED,
                user,
                resourceType: 'user',
                resourceId: id,
                details: { email: targetUser?.email },
                event
            });

            return successResponse({ success: true }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Admin users error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

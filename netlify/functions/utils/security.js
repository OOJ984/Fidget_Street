/**
 * Shared Security Utilities
 *
 * Centralizes security functions across all admin API endpoints:
 * - CORS configuration with origin validation
 * - JWT token verification
 * - Role-based access control (RBAC)
 * - Environment variable validation
 * - Audit logging
 */

const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Timeout for DB operations (don't let audit logging block auth)
const AUDIT_TIMEOUT_MS = 5000;

/**
 * Wrap a promise with a timeout
 */
function withTimeout(promise, ms, operation = 'Operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
        )
    ]);
}

// Lazy-loaded Supabase client for audit logging
let auditSupabase = null;
function getAuditClient() {
    if (!auditSupabase) {
        auditSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
        );
    }
    return auditSupabase;
}

// JWT_SECRET is required - no fallback allowed
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV !== 'test') {
    console.error('CRITICAL: JWT_SECRET environment variable is not set');
}

// Allowed origins for CORS
// Set SITE_URL env var to your production domain (e.g., https://your-site.netlify.app)
const ALLOWED_ORIGINS = [
    process.env.SITE_URL,                    // Primary production URL (from env)
    process.env.URL,                         // Netlify's auto-set URL
    process.env.DEPLOY_PRIME_URL,            // Netlify deploy preview URL
    'http://localhost:8888',                 // Local development
    'http://localhost:3000'                  // Alternative local port
].filter(Boolean);

// ============================================
// Role Definitions
// ============================================

const ROLES = {
    SUPER_ADMIN: 'super_admin',
    BUSINESS_PROCESSING: 'business_processing',
    WEBSITE_ADMIN: 'website_admin',
    CUSTOMER: 'customer'
};

// Permission definitions
const PERMISSIONS = {
    // Order permissions
    VIEW_OWN_ORDERS: 'view_own_orders',
    VIEW_ALL_ORDERS: 'view_all_orders',
    UPDATE_ORDER_STATUS: 'update_order_status',

    // Product permissions
    VIEW_PRODUCTS: 'view_products',
    CREATE_PRODUCTS: 'create_products',
    EDIT_PRODUCTS: 'edit_products',
    DELETE_PRODUCTS: 'delete_products',

    // Media permissions
    VIEW_MEDIA: 'view_media',
    UPLOAD_MEDIA: 'upload_media',
    DELETE_MEDIA: 'delete_media',

    // Settings permissions
    VIEW_SETTINGS: 'view_settings',
    EDIT_SETTINGS: 'edit_settings',

    // User management permissions
    VIEW_USERS: 'view_users',
    MANAGE_USERS: 'manage_users',

    // Audit permissions
    VIEW_AUDIT_LOGS: 'view_audit_logs',

    // Discount code permissions
    MANAGE_DISCOUNTS: 'manage_discounts',

    // Gift card permissions
    VIEW_GIFT_CARDS: 'view_gift_cards',
    MANAGE_GIFT_CARDS: 'manage_gift_cards'
};

// Role to permissions mapping
const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: [
        // Super admin has ALL permissions
        PERMISSIONS.VIEW_ALL_ORDERS,
        PERMISSIONS.UPDATE_ORDER_STATUS,
        PERMISSIONS.VIEW_PRODUCTS,
        PERMISSIONS.CREATE_PRODUCTS,
        PERMISSIONS.EDIT_PRODUCTS,
        PERMISSIONS.DELETE_PRODUCTS,
        PERMISSIONS.VIEW_MEDIA,
        PERMISSIONS.UPLOAD_MEDIA,
        PERMISSIONS.DELETE_MEDIA,
        PERMISSIONS.VIEW_SETTINGS,
        PERMISSIONS.EDIT_SETTINGS,
        PERMISSIONS.VIEW_USERS,
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.VIEW_AUDIT_LOGS,
        PERMISSIONS.MANAGE_DISCOUNTS,
        PERMISSIONS.VIEW_GIFT_CARDS,
        PERMISSIONS.MANAGE_GIFT_CARDS
    ],
    [ROLES.BUSINESS_PROCESSING]: [
        PERMISSIONS.VIEW_ALL_ORDERS,
        PERMISSIONS.UPDATE_ORDER_STATUS,
        PERMISSIONS.VIEW_PRODUCTS,
        PERMISSIONS.CREATE_PRODUCTS,
        PERMISSIONS.EDIT_PRODUCTS,
        PERMISSIONS.DELETE_PRODUCTS,
        PERMISSIONS.VIEW_MEDIA,
        PERMISSIONS.UPLOAD_MEDIA,
        PERMISSIONS.DELETE_MEDIA,
        PERMISSIONS.VIEW_GIFT_CARDS
    ],
    [ROLES.WEBSITE_ADMIN]: [
        // All business_processing permissions
        PERMISSIONS.VIEW_ALL_ORDERS,
        PERMISSIONS.UPDATE_ORDER_STATUS,
        PERMISSIONS.VIEW_PRODUCTS,
        PERMISSIONS.CREATE_PRODUCTS,
        PERMISSIONS.EDIT_PRODUCTS,
        PERMISSIONS.DELETE_PRODUCTS,
        PERMISSIONS.VIEW_MEDIA,
        PERMISSIONS.UPLOAD_MEDIA,
        PERMISSIONS.DELETE_MEDIA,
        // Plus admin-only permissions
        PERMISSIONS.VIEW_SETTINGS,
        PERMISSIONS.EDIT_SETTINGS,
        PERMISSIONS.VIEW_USERS,
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.VIEW_AUDIT_LOGS,
        PERMISSIONS.MANAGE_DISCOUNTS,
        PERMISSIONS.VIEW_GIFT_CARDS,
        PERMISSIONS.MANAGE_GIFT_CARDS
    ],
    [ROLES.CUSTOMER]: [
        PERMISSIONS.VIEW_OWN_ORDERS
    ]
};

/**
 * Check if a user has a specific permission
 * @param {object} user - The decoded JWT user object
 * @param {string} permission - The permission to check
 * @returns {boolean}
 */
function hasPermission(user, permission) {
    if (!user || !user.role) return false;
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    return rolePermissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 * @param {object} user - The decoded JWT user object
 * @param {string[]} permissions - Array of permissions (any match = allowed)
 * @returns {boolean}
 */
function hasAnyPermission(user, permissions) {
    return permissions.some(p => hasPermission(user, p));
}

/**
 * Check if a user has all of the specified permissions
 * @param {object} user - The decoded JWT user object
 * @param {string[]} permissions - Array of permissions (all must match)
 * @returns {boolean}
 */
function hasAllPermissions(user, permissions) {
    return permissions.every(p => hasPermission(user, p));
}

/**
 * Check if user has one of the allowed roles
 * @param {object} user - The decoded JWT user object
 * @param {string[]} allowedRoles - Array of allowed role names
 * @returns {boolean}
 */
function hasRole(user, allowedRoles) {
    if (!user || !user.role) return false;
    return allowedRoles.includes(user.role);
}

/**
 * Create a forbidden response for unauthorized access
 * @param {object} headers - CORS headers
 * @param {string} message - Optional custom message
 * @returns {object} Response object
 */
function forbiddenResponse(headers, message = 'You do not have permission to perform this action') {
    return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: message })
    };
}

/**
 * Require specific permission(s) - returns error response if not authorized
 * @param {object} user - The decoded JWT user object
 * @param {string|string[]} requiredPermissions - Permission(s) required
 * @param {object} headers - CORS headers
 * @returns {object|null} Error response if unauthorized, null if authorized
 */
function requirePermission(user, requiredPermissions, headers) {
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    if (!hasAnyPermission(user, permissions)) {
        return forbiddenResponse(headers);
    }
    return null;
}

/**
 * Require specific role(s) - returns error response if not authorized
 * @param {object} user - The decoded JWT user object
 * @param {string|string[]} allowedRoles - Role(s) allowed
 * @param {object} headers - CORS headers
 * @returns {object|null} Error response if unauthorized, null if authorized
 */
function requireRole(user, allowedRoles, headers) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!hasRole(user, roles)) {
        return forbiddenResponse(headers);
    }
    return null;
}

// ============================================
// CORS Functions
// ============================================

/**
 * Get CORS headers with origin validation
 * @param {string} requestOrigin - The origin from the request
 * @param {string[]} methods - Allowed HTTP methods (default: GET, POST, PUT, DELETE, OPTIONS)
 * @returns {object} Headers object
 */
function getCorsHeaders(requestOrigin, methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
    // Check if origin is allowed, default to first allowed origin
    const origin = ALLOWED_ORIGINS.includes(requestOrigin)
        ? requestOrigin
        : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': methods.join(', '),
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json'
    };
}

// ============================================
// Token Functions
// ============================================

/**
 * Verify JWT token from Authorization header
 * @param {string} authHeader - The Authorization header value
 * @returns {object|null} Decoded token payload or null if invalid
 */
function verifyToken(authHeader) {
    if (!JWT_SECRET) {
        console.error('Cannot verify token: JWT_SECRET not configured');
        return null;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    try {
        const token = authHeader.substring(7);
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * Check if JWT_SECRET is configured
 * @returns {boolean}
 */
function isSecretConfigured() {
    return !!JWT_SECRET;
}

// ============================================
// Response Helpers
// ============================================

/**
 * Create a standardized error response
 * @param {number} statusCode - HTTP status code
 * @param {string} error - Error message
 * @param {object} headers - CORS headers
 * @returns {object} Response object
 */
function errorResponse(statusCode, error, headers) {
    return {
        statusCode,
        headers,
        body: JSON.stringify({ error })
    };
}

/**
 * Create a standardized success response
 * @param {any} data - Response data
 * @param {object} headers - CORS headers
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {object} Response object
 */
function successResponse(data, headers, statusCode = 200) {
    return {
        statusCode,
        headers,
        body: JSON.stringify(data)
    };
}

// ============================================
// Audit Logging
// ============================================

// Audit action types
const AUDIT_ACTIONS = {
    // Authentication
    LOGIN_SUCCESS: 'login_success',
    LOGIN_FAILED: 'login_failed',
    LOGOUT: 'logout',
    MFA_SETUP: 'mfa_setup',
    MFA_VERIFIED: 'mfa_verified',
    PASSWORD_CHANGED: 'password_changed',

    // Products
    PRODUCT_CREATED: 'product_created',
    PRODUCT_UPDATED: 'product_updated',
    PRODUCT_DELETED: 'product_deleted',

    // Orders
    ORDER_STATUS_UPDATED: 'order_status_updated',

    // Media
    MEDIA_UPLOADED: 'media_uploaded',
    MEDIA_DELETED: 'media_deleted',
    MEDIA_RENAMED: 'media_renamed',

    // Settings
    SETTINGS_UPDATED: 'settings_updated',
    SETTINGS_RESET: 'settings_reset',

    // Users
    USER_CREATED: 'user_created',
    USER_UPDATED: 'user_updated',
    USER_DEACTIVATED: 'user_deactivated',
    USER_ROLE_CHANGED: 'user_role_changed',

    // Gift Cards
    GIFT_CARD_CREATED: 'gift_card_created',
    GIFT_CARD_ACTIVATED: 'gift_card_activated',
    GIFT_CARD_REDEEMED: 'gift_card_redeemed',
    GIFT_CARD_CANCELLED: 'gift_card_cancelled',
    GIFT_CARD_ADJUSTED: 'gift_card_adjusted',
    GIFT_CARD_SENT: 'gift_card_sent'
};

/**
 * Log an audit event
 * @param {object} options - Audit log options
 * @param {string} options.action - Action type (use AUDIT_ACTIONS constants)
 * @param {object} options.user - User object (from JWT or login)
 * @param {string} options.resourceType - Type of resource (e.g., 'product', 'order')
 * @param {string} options.resourceId - ID of the affected resource
 * @param {object} options.details - Additional context
 * @param {object} options.event - Netlify event object (for IP/user agent)
 */
async function auditLog({ action, user, resourceType, resourceId, details, event }) {
    try {
        const supabase = getAuditClient();

        const logEntry = {
            action,
            user_id: user?.userId || user?.id || null,
            user_email: user?.email || null,
            resource_type: resourceType || null,
            resource_id: resourceId?.toString() || null,
            details: details || null,
            ip_address: event?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
                || event?.headers?.['x-real-ip']
                || null,
            user_agent: event?.headers?.['user-agent'] || null
        };

        const { error } = await withTimeout(
            supabase.from('audit_logs').insert([logEntry]),
            AUDIT_TIMEOUT_MS,
            'Audit log insert'
        );

        if (error) {
            console.error('Audit log error:', error);
        }
    } catch (err) {
        // Don't fail the main operation if audit logging fails
        console.error('Audit log exception:', err.message);
    }
}

/**
 * Helper to extract client IP from event
 * @param {object} event - Netlify event object
 * @returns {string}
 */
function getClientIP(event) {
    return event?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
        || event?.headers?.['x-real-ip']
        || event?.headers?.['client-ip']
        || 'unknown';
}

module.exports = {
    // CORS
    getCorsHeaders,
    ALLOWED_ORIGINS,

    // Token
    verifyToken,
    isSecretConfigured,

    // RBAC
    ROLES,
    PERMISSIONS,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    requirePermission,
    requireRole,
    forbiddenResponse,

    // Response helpers
    errorResponse,
    successResponse,

    // Audit logging
    AUDIT_ACTIONS,
    auditLog,
    getClientIP
};

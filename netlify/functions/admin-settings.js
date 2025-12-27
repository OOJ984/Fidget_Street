/**
 * Admin Settings API
 * GET /api/admin-settings - Get current settings (admin only)
 * PUT /api/admin-settings - Update settings (admin only)
 * DELETE /api/admin-settings - Reset to defaults (admin only)
 *
 * Required permissions:
 * - GET: VIEW_SETTINGS (website_admin only)
 * - PUT: EDIT_SETTINGS (website_admin only)
 * - DELETE: EDIT_SETTINGS (website_admin only)
 */

const { createClient } = require('@supabase/supabase-js');
const {
    getCorsHeaders,
    verifyToken,
    isSecretConfigured,
    errorResponse,
    successResponse,
    requirePermission,
    PERMISSIONS,
    auditLog,
    AUDIT_ACTIONS
} = require('./utils/security');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Default settings
const defaultSettings = {
    companyName: 'Fidget Street',
    tagline: 'Playful Calm for Busy Hands',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#71c7e1',
    secondaryColor: '#A8E0A2',
    contactEmail: 'hello@fidgetstreet.co.uk',
    contactPhone: '',
    businessAddress: '',
    instagramUrl: 'https://instagram.com/fidgetstreet',
    facebookUrl: '',
    twitterUrl: '',
    defaultTitleSuffix: 'Fidget Street',
    defaultDescription: 'Fidget Street - Playful fidget toys and sensory items for everyone. Stress relief, focus aids, and calming toys. UK-based.',
    ogImageUrl: '',
    freeShippingThreshold: 20,
    shippingCost: 2.99,
    currency: 'GBP',
    maxQuantity: 10,
    footerTagline: 'Playful calm for busy hands. Fidget toys for focus, stress relief, and sensory fun.',
    copyrightText: 'Fidget Street. All rights reserved.',
    footerNote: 'UK-based sensory toy specialist'
};

// Map camelCase to snake_case for database
function toSnakeCase(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        result[snakeKey] = value;
    }
    return result;
}

// Map snake_case to camelCase for frontend
function toCamelCase(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = value;
    }
    return result;
}

exports.handler = async (event, context) => {
    const requestOrigin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(requestOrigin, ['GET', 'PUT', 'DELETE', 'OPTIONS']);

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

    try {
        // GET - Get current settings
        if (event.httpMethod === 'GET') {
            // Check permission - website_admin only
            const permError = requirePermission(user, PERMISSIONS.VIEW_SETTINGS, headers);
            if (permError) return permError;

            const { data, error } = await supabase
                .from('website_settings')
                .select('*')
                .limit(1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No settings exist, return defaults
                    return successResponse(defaultSettings, headers);
                }
                throw error;
            }

            const settings = toCamelCase(data);
            delete settings.id;
            delete settings.createdAt;
            delete settings.updatedAt;

            return successResponse({ ...defaultSettings, ...settings }, headers);
        }

        // PUT - Update settings
        if (event.httpMethod === 'PUT') {
            // Check permission - website_admin only
            const permError = requirePermission(user, PERMISSIONS.EDIT_SETTINGS, headers);
            if (permError) return permError;

            const body = JSON.parse(event.body);

            // Convert to snake_case for database
            const dbData = toSnakeCase(body);
            dbData.updated_at = new Date().toISOString();

            // Check if settings row exists
            const { data: existing } = await supabase
                .from('website_settings')
                .select('id')
                .limit(1)
                .single();

            let result;
            if (existing) {
                // Update existing row
                result = await supabase
                    .from('website_settings')
                    .update(dbData)
                    .eq('id', existing.id)
                    .select()
                    .single();
            } else {
                // Insert new row
                result = await supabase
                    .from('website_settings')
                    .insert([dbData])
                    .select()
                    .single();
            }

            if (result.error) throw result.error;

            // Audit log - settings updated
            await auditLog({
                action: AUDIT_ACTIONS.SETTINGS_UPDATED,
                user,
                resourceType: 'settings',
                details: { updatedFields: Object.keys(body) },
                event
            });

            return successResponse({ success: true, settings: toCamelCase(result.data) }, headers);
        }

        // DELETE - Reset to defaults
        if (event.httpMethod === 'DELETE') {
            // Check permission - website_admin only
            const permError = requirePermission(user, PERMISSIONS.EDIT_SETTINGS, headers);
            if (permError) return permError;

            // Delete all rows (should only be one)
            const { error } = await supabase
                .from('website_settings')
                .delete()
                .neq('id', 0); // Delete all rows

            if (error) throw error;

            // Audit log - settings reset
            await auditLog({
                action: AUDIT_ACTIONS.SETTINGS_RESET,
                user,
                resourceType: 'settings',
                event
            });

            return successResponse({ success: true, settings: defaultSettings }, headers);
        }

        return errorResponse(405, 'Method not allowed', headers);

    } catch (error) {
        console.error('Admin settings error:', error);
        return errorResponse(500, 'Internal server error', headers);
    }
};

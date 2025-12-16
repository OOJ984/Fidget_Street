/**
 * Public Settings API
 * GET /api/settings - Returns website settings (public, no auth required)
 *
 * This is a public endpoint used by the frontend to load site branding/colors.
 * Settings are cached client-side and refreshed in background.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Default settings (fallback if database is empty or unavailable)
const defaultSettings = {
    companyName: 'Wicka',
    tagline: 'Style Meets Purpose',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#C4707A',
    secondaryColor: '#F5D0D5',
    contactEmail: 'wicka@protonmail.com',
    contactPhone: '',
    businessAddress: '',
    instagramUrl: 'https://instagram.com/wicka',
    facebookUrl: '',
    twitterUrl: '',
    defaultTitleSuffix: 'Wicka',
    defaultDescription: 'Style Meets Purpose by Wicka. Modern, aesthetic organisers and 3D-printed holders made by young designers.',
    ogImageUrl: '',
    freeShippingThreshold: 20,
    shippingCost: 2.99,
    currency: 'GBP',
    maxQuantity: 10,
    footerTagline: 'Style Meets Purpose made by young designers. Premium quality, affordable prices.',
    copyrightText: 'Wicka. All rights reserved.',
    footerNote: 'A Young Enterprise company'
};

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
        // No caching - settings include logo/favicon that can change anytime
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get settings from database (single row)
        const { data, error } = await supabase
            .from('website_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            // If no settings exist yet, return defaults
            if (error.code === 'PGRST116') {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(defaultSettings)
                };
            }
            throw error;
        }

        // Convert snake_case database columns to camelCase for frontend
        const dbSettings = {
            companyName: data.company_name,
            tagline: data.tagline,
            logoUrl: data.logo_url,
            faviconUrl: data.favicon_url,
            primaryColor: data.primary_color,
            secondaryColor: data.secondary_color,
            contactEmail: data.contact_email,
            contactPhone: data.contact_phone,
            businessAddress: data.business_address,
            instagramUrl: data.instagram_url,
            facebookUrl: data.facebook_url,
            twitterUrl: data.twitter_url,
            defaultTitleSuffix: data.default_title_suffix,
            defaultDescription: data.default_description,
            ogImageUrl: data.og_image_url,
            freeShippingThreshold: data.free_shipping_threshold,
            shippingCost: data.shipping_cost,
            currency: data.currency,
            maxQuantity: data.max_quantity,
            footerTagline: data.footer_tagline,
            copyrightText: data.copyright_text,
            footerNote: data.footer_note
        };

        // Merge with defaults to ensure all fields exist
        const settings = { ...defaultSettings };
        for (const key in dbSettings) {
            if (dbSettings[key] !== null && dbSettings[key] !== undefined) {
                settings[key] = dbSettings[key];
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(settings)
        };

    } catch (error) {
        console.error('Settings fetch error:', error);
        // On error, return defaults so site still works
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(defaultSettings)
        };
    }
};

/**
 * Dynamic Sitemap API
 * GET /api/sitemap - Returns XML sitemap with all pages and products
 *
 * Features:
 * - Includes all static pages with appropriate priorities
 * - Dynamically fetches all active products from database
 * - Uses current date for lastmod (products use updated_at)
 * - Proper XML sitemap format for search engine indexing
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Base URL - use environment variable or default
const BASE_URL = process.env.SITE_URL || process.env.URL || 'https://wicka.co.uk';

// Static pages with their priorities and change frequencies
const STATIC_PAGES = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/products.html', priority: '0.9', changefreq: 'weekly' },
    { path: '/about.html', priority: '0.7', changefreq: 'monthly' },
    { path: '/events.html', priority: '0.7', changefreq: 'weekly' },
    { path: '/contact.html', priority: '0.6', changefreq: 'monthly' },
    { path: '/faq.html', priority: '0.6', changefreq: 'monthly' },
    { path: '/instagram.html', priority: '0.5', changefreq: 'weekly' },
    { path: '/cart.html', priority: '0.5', changefreq: 'monthly' },
    { path: '/privacy.html', priority: '0.3', changefreq: 'yearly' },
    { path: '/terms.html', priority: '0.3', changefreq: 'yearly' },
    { path: '/returns.html', priority: '0.3', changefreq: 'yearly' }
];

function formatDate(date) {
    return new Date(date).toISOString().split('T')[0];
}

function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function generateUrlEntry(loc, lastmod, changefreq, priority) {
    return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

exports.handler = async (event, context) => {
    const headers = {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    };

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const today = formatDate(new Date());
        const urls = [];

        // Add static pages
        for (const page of STATIC_PAGES) {
            urls.push(generateUrlEntry(
                `${BASE_URL}${page.path}`,
                today,
                page.changefreq,
                page.priority
            ));
        }

        // Fetch all active products
        const { data: products, error } = await supabase
            .from('products')
            .select('slug, updated_at')
            .eq('is_active', true)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Sitemap: Error fetching products:', error);
            // Continue with static pages only
        } else if (products && products.length > 0) {
            // Add product pages
            for (const product of products) {
                const lastmod = product.updated_at
                    ? formatDate(product.updated_at)
                    : today;

                urls.push(generateUrlEntry(
                    `${BASE_URL}/product.html?slug=${escapeXml(product.slug)}`,
                    lastmod,
                    'weekly',
                    '0.8'
                ));
            }
        }

        // Generate XML
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

        return {
            statusCode: 200,
            headers,
            body: xml
        };

    } catch (error) {
        console.error('Sitemap API error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

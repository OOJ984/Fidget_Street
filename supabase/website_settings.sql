-- Website Settings Table for Fidget Street
-- Run this SQL in your Supabase SQL Editor to create the settings table

CREATE TABLE IF NOT EXISTS website_settings (
    id SERIAL PRIMARY KEY,

    -- Branding
    company_name TEXT DEFAULT 'Fidget Street',
    tagline TEXT DEFAULT 'Everyday Satisfaction',
    logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT '',

    -- Colors
    primary_color TEXT DEFAULT '#71c7e1',
    secondary_color TEXT DEFAULT '#A8E0A2',

    -- Contact
    contact_email TEXT DEFAULT 'hello@fidgetstreet.co.uk',
    contact_phone TEXT DEFAULT '',
    business_address TEXT DEFAULT '',

    -- Social Media
    instagram_url TEXT DEFAULT 'https://instagram.com/fidgetstreet',
    tiktok_url TEXT DEFAULT '',
    facebook_url TEXT DEFAULT '',
    twitter_url TEXT DEFAULT '',

    -- SEO
    default_title_suffix TEXT DEFAULT 'Fidget Street',
    default_description TEXT DEFAULT 'Eco-friendly fidget toys for focus, fun, and stress relief. Safe for ages 6+. Made from plant-based PLA plastic.',
    og_image_url TEXT DEFAULT '',

    -- Shipping
    free_shipping_threshold DECIMAL(10,2) DEFAULT 30.00,
    shipping_cost DECIMAL(10,2) DEFAULT 2.99,
    currency TEXT DEFAULT 'GBP',
    max_quantity INTEGER DEFAULT 10,

    -- Footer
    footer_tagline TEXT DEFAULT 'Everyday Satisfaction - Eco-friendly fidget toys for all ages.',
    copyright_text TEXT DEFAULT 'Fidget Street. All rights reserved.',
    footer_note TEXT DEFAULT '',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read settings (for frontend)
CREATE POLICY "Public can read settings" ON website_settings
    FOR SELECT
    USING (true);

-- Policy: Only service role can update (for admin API)
CREATE POLICY "Service role can update settings" ON website_settings
    FOR ALL
    USING (auth.role() = 'service_role');

-- Insert default row if table is empty
INSERT INTO website_settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM website_settings);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_website_settings_id ON website_settings(id);

-- Comment
COMMENT ON TABLE website_settings IS 'Single-row table storing website customization settings';

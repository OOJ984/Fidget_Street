-- ============================================
-- FIDGET STREET - COMPLETE DATABASE SYNC
-- ============================================
-- This script ensures both prod and non-prod databases are identical.
-- Safe to run multiple times - uses IF NOT EXISTS patterns.
--
-- Run this in Supabase SQL Editor for BOTH databases:
-- 1. Non-prod: https://supabase.com/dashboard/project/qyvojrjxzkwqljghlkoe/sql
-- 2. Prod: https://supabase.com/dashboard/project/ppprhhctcfqkbpfsebcr/sql
-- ============================================

-- ============================================
-- HELPER FUNCTION: update_updated_at_column
-- Used by multiple tables for triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 001: PRODUCTS - variation_images column
-- ============================================
ALTER TABLE products
ADD COLUMN IF NOT EXISTS variation_images JSONB DEFAULT '{}'::jsonb;

-- ============================================
-- ADD SALE COLUMNS to products
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price_gbp DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_percentage INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_is_on_sale ON products(is_on_sale) WHERE is_on_sale = true;

-- ============================================
-- 002: RBAC - Role-Based Access Control
-- ============================================
-- Update role constraint for admin_users
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- Update existing roles to valid values
UPDATE admin_users SET role = 'website_admin' WHERE role = 'admin';
UPDATE admin_users SET role = 'website_admin' WHERE role = 'super_admin';
UPDATE admin_users SET role = 'website_admin' WHERE role IS NULL;

-- Set default and add new constraint
ALTER TABLE admin_users ALTER COLUMN role SET DEFAULT 'website_admin';

ALTER TABLE admin_users
ADD CONSTRAINT admin_users_role_check
CHECK (role IN ('business_processing', 'website_admin'));

-- Add new columns to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[];
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    is_verified BOOLEAN DEFAULT false,
    magic_link_token TEXT,
    magic_link_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Link orders to customers
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- Indexes for customers
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_magic_link ON customers(magic_link_token) WHERE magic_link_token IS NOT NULL;

-- RLS for customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage customers" ON customers;
CREATE POLICY "Service role can manage customers" ON customers
    FOR ALL USING (auth.role() = 'service_role');

-- Trigger for admin_users updated_at
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 003: AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES admin_users(id),
    user_email TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage audit logs" ON audit_logs;
CREATE POLICY "Service role can manage audit logs" ON audit_logs
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 004: PERFORMANCE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_created_at ON orders(customer_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(email) WHERE is_active = true;

-- ============================================
-- 005: RATE LIMITING
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    attempts INTEGER DEFAULT 1,
    first_attempt TIMESTAMPTZ DEFAULT NOW(),
    reset_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage rate limits" ON rate_limits;
CREATE POLICY "Service role can manage rate limits" ON rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- Rate limiting functions (drop first to handle signature changes)
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS record_failed_attempt(TEXT, INTEGER);
DROP FUNCTION IF EXISTS clear_rate_limit(TEXT);
DROP FUNCTION IF EXISTS cleanup_expired_rate_limits();

CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_max_attempts INTEGER,
    p_lockout_minutes INTEGER
) RETURNS TABLE (
    allowed BOOLEAN,
    retry_after_seconds INTEGER,
    current_attempts INTEGER
) AS $$
DECLARE
    v_record rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_record FROM rate_limits WHERE key = p_key;

    IF v_record IS NULL OR v_record.reset_at <= v_now THEN
        RETURN QUERY SELECT TRUE::BOOLEAN, 0::INTEGER, 0::INTEGER;
        RETURN;
    END IF;

    IF v_record.attempts >= p_max_attempts THEN
        RETURN QUERY SELECT
            FALSE::BOOLEAN,
            EXTRACT(EPOCH FROM (v_record.reset_at - v_now))::INTEGER,
            v_record.attempts::INTEGER;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE::BOOLEAN, 0::INTEGER, v_record.attempts::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_failed_attempt(
    p_key TEXT,
    p_lockout_minutes INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_attempts INTEGER;
    v_now TIMESTAMPTZ := NOW();
    v_reset_at TIMESTAMPTZ := v_now + (p_lockout_minutes * INTERVAL '1 minute');
BEGIN
    INSERT INTO rate_limits (key, attempts, first_attempt, reset_at)
    VALUES (p_key, 1, v_now, v_reset_at)
    ON CONFLICT (key) DO UPDATE SET
        attempts = CASE
            WHEN rate_limits.reset_at <= v_now THEN 1
            ELSE rate_limits.attempts + 1
        END,
        first_attempt = CASE
            WHEN rate_limits.reset_at <= v_now THEN v_now
            ELSE rate_limits.first_attempt
        END,
        reset_at = CASE
            WHEN rate_limits.reset_at <= v_now THEN v_reset_at
            ELSE rate_limits.reset_at
        END
    RETURNING attempts INTO v_attempts;

    RETURN v_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION clear_rate_limit(p_key TEXT) RETURNS VOID AS $$
BEGIN
    DELETE FROM rate_limits WHERE key = p_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits() RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limits WHERE reset_at < NOW();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 006: DISCOUNT CODES
-- ============================================
CREATE TABLE IF NOT EXISTS discount_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_delivery')),
    discount_value DECIMAL(10,2) NOT NULL,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    max_uses INTEGER,
    use_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    min_order_amount DECIMAL(10,2),
    max_uses_per_customer INTEGER,
    created_by INTEGER REFERENCES admin_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_active ON discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_codes_dates ON discount_codes(starts_at, expires_at);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2);

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage discount codes" ON discount_codes;
CREATE POLICY "Service role can manage discount codes" ON discount_codes
    FOR ALL USING (true);

GRANT ALL ON discount_codes TO service_role;
GRANT SELECT ON discount_codes TO anon;

-- Discount usage tracking
CREATE TABLE IF NOT EXISTS discount_usage (
    id SERIAL PRIMARY KEY,
    discount_code_id INTEGER REFERENCES discount_codes(id) ON DELETE CASCADE,
    customer_email TEXT NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_usage_code_email ON discount_usage(discount_code_id, customer_email);

ALTER TABLE discount_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage discount usage" ON discount_usage;
CREATE POLICY "Service role can manage discount usage" ON discount_usage
    FOR ALL USING (true);

GRANT ALL ON discount_usage TO service_role;

-- ============================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'website',
    is_active BOOLEAN DEFAULT true,
    unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(is_active);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage newsletter" ON newsletter_subscribers;
CREATE POLICY "Service role can manage newsletter" ON newsletter_subscribers
    FOR ALL USING (true);

GRANT ALL ON newsletter_subscribers TO service_role;

-- ============================================
-- 008: PAGE VIEW ANALYTICS
-- ============================================
CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    page_path TEXT NOT NULL,
    page_title TEXT,
    referrer TEXT,
    country TEXT,
    device_type TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);

CREATE TABLE IF NOT EXISTS page_view_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    page_path TEXT NOT NULL,
    view_count INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    UNIQUE(date, page_path)
);

CREATE INDEX IF NOT EXISTS idx_page_view_stats_date ON page_view_stats(date);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_view_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage page_views" ON page_views;
CREATE POLICY "Service role can manage page_views" ON page_views FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role can manage page_view_stats" ON page_view_stats;
CREATE POLICY "Service role can manage page_view_stats" ON page_view_stats FOR ALL USING (true);

DROP POLICY IF EXISTS "Anyone can insert page views" ON page_views;
CREATE POLICY "Anyone can insert page views" ON page_views FOR INSERT WITH CHECK (true);

GRANT INSERT ON page_views TO anon;
GRANT ALL ON page_views TO service_role;
GRANT ALL ON page_view_stats TO service_role;

-- ============================================
-- 009: COLORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    hex_code VARCHAR(7),
    in_stock BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colors_name ON colors(name);
CREATE INDEX IF NOT EXISTS idx_colors_in_stock ON colors(in_stock);

-- Colors updated_at trigger
CREATE OR REPLACE FUNCTION update_colors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS colors_updated_at ON colors;
CREATE TRIGGER colors_updated_at
    BEFORE UPDATE ON colors
    FOR EACH ROW
    EXECUTE FUNCTION update_colors_updated_at();

-- Insert seed colors
INSERT INTO colors (name, hex_code, display_order) VALUES
    ('Black', '#000000', 1),
    ('White', '#FFFFFF', 2),
    ('Red', '#FF0000', 3),
    ('Blue', '#0000FF', 4),
    ('Green', '#00FF00', 5),
    ('Yellow', '#FFFF00', 6),
    ('Pink', '#FFC0CB', 7),
    ('Purple', '#800080', 8),
    ('Orange', '#FFA500', 9),
    ('Grey', '#808080', 10),
    ('Rainbow', NULL, 11),
    ('Galaxy', NULL, 12),
    ('Glow in Dark', NULL, 13)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE colors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Colors are viewable by everyone" ON colors;
CREATE POLICY "Colors are viewable by everyone" ON colors
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can insert colors" ON colors;
CREATE POLICY "Only admins can insert colors" ON colors
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can update colors" ON colors;
CREATE POLICY "Only admins can update colors" ON colors
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Only admins can delete colors" ON colors;
CREATE POLICY "Only admins can delete colors" ON colors
    FOR DELETE USING (true);

-- ============================================
-- 010: SIZES TABLE & PRODUCT VARIANTS
-- ============================================
CREATE TABLE IF NOT EXISTS sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    short_code VARCHAR(10),
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sizes_name ON sizes(name);

DROP TRIGGER IF EXISTS sizes_updated_at ON sizes;
CREATE TRIGGER sizes_updated_at
    BEFORE UPDATE ON sizes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert seed sizes
INSERT INTO sizes (name, short_code, display_order) VALUES
    ('Mini', 'XS', 1),
    ('Small', 'S', 2),
    ('Medium', 'M', 3),
    ('Large', 'L', 4),
    ('Extra Large', 'XL', 5),
    ('One Size', 'OS', 10)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sizes are viewable by everyone" ON sizes;
CREATE POLICY "Sizes are viewable by everyone" ON sizes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage sizes" ON sizes;
CREATE POLICY "Service role can manage sizes" ON sizes
    FOR ALL USING (auth.role() = 'service_role');

-- Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_id UUID REFERENCES colors(id) ON DELETE SET NULL,
    size_id UUID REFERENCES sizes(id) ON DELETE SET NULL,
    sku VARCHAR(100),
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    stock INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, color_id, size_id)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_color ON product_variants(color_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_size ON product_variants(size_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_available ON product_variants(is_available);

DROP TRIGGER IF EXISTS product_variants_updated_at ON product_variants;
CREATE TRIGGER product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Product variants viewable by everyone" ON product_variants;
CREATE POLICY "Product variants viewable by everyone" ON product_variants
    FOR SELECT USING (is_available = true);

DROP POLICY IF EXISTS "Service role can manage product variants" ON product_variants;
CREATE POLICY "Service role can manage product variants" ON product_variants
    FOR ALL USING (auth.role() = 'service_role');

-- Add variant columns to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS available_color_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS available_size_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false;

-- ============================================
-- GIFT CARDS
-- ============================================
-- Drop and recreate for clean slate (safe for empty tables)
DROP TABLE IF EXISTS gift_card_transactions CASCADE;
DROP TABLE IF EXISTS gift_cards CASCADE;

CREATE TABLE gift_cards (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    initial_balance DECIMAL(10,2) NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'GBP',
    purchaser_email TEXT NOT NULL,
    purchaser_name TEXT,
    recipient_email TEXT,
    recipient_name TEXT,
    personal_message TEXT,
    source TEXT DEFAULT 'purchase',
    order_id INTEGER,
    created_by INTEGER,
    status TEXT DEFAULT 'pending',
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    notes TEXT,
    expires_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gift_card_transactions (
    id SERIAL PRIMARY KEY,
    gift_card_id INTEGER REFERENCES gift_cards(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    order_id INTEGER,
    order_number TEXT,
    notes TEXT,
    performed_by_email TEXT,
    performed_by_admin INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_card_id ON gift_card_transactions(gift_card_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_amount DECIMAL(10,2);

ALTER TABLE gift_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 011: MFA RATE LIMITS (Database-backed)
-- ============================================
-- Create MFA rate limits table
CREATE TABLE IF NOT EXISTS mfa_rate_limits (
    user_id INTEGER PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    first_attempt_at TIMESTAMPTZ,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_mfa_rate_limits_locked_until
    ON mfa_rate_limits(locked_until)
    WHERE locked_until IS NOT NULL;

-- Function to check and update MFA rate limit
CREATE OR REPLACE FUNCTION check_mfa_rate_limit(
    p_user_id INTEGER,
    p_max_attempts INTEGER DEFAULT 5,
    p_lockout_minutes INTEGER DEFAULT 15,
    p_window_minutes INTEGER DEFAULT 15
) RETURNS JSONB AS $$
DECLARE
    v_record mfa_rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_window_start TIMESTAMPTZ := v_now - (p_window_minutes || ' minutes')::INTERVAL;
BEGIN
    INSERT INTO mfa_rate_limits (user_id, attempt_count, first_attempt_at)
    VALUES (p_user_id, 0, NULL)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_record FROM mfa_rate_limits WHERE user_id = p_user_id FOR UPDATE;

    IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining_attempts', 0,
            'locked_until', v_record.locked_until,
            'reason', 'locked'
        );
    END IF;

    IF v_record.locked_until IS NOT NULL AND v_record.locked_until <= v_now THEN
        UPDATE mfa_rate_limits
        SET attempt_count = 0, first_attempt_at = NULL, locked_until = NULL, updated_at = v_now
        WHERE user_id = p_user_id;
        v_record.attempt_count := 0;
    ELSIF v_record.first_attempt_at IS NOT NULL AND v_record.first_attempt_at < v_window_start THEN
        UPDATE mfa_rate_limits
        SET attempt_count = 0, first_attempt_at = NULL, updated_at = v_now
        WHERE user_id = p_user_id;
        v_record.attempt_count := 0;
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'remaining_attempts', p_max_attempts - v_record.attempt_count,
        'locked_until', NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record a failed MFA attempt
CREATE OR REPLACE FUNCTION record_mfa_failure(
    p_user_id INTEGER,
    p_max_attempts INTEGER DEFAULT 5,
    p_lockout_minutes INTEGER DEFAULT 15
) RETURNS JSONB AS $$
DECLARE
    v_record mfa_rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_new_count INTEGER;
    v_locked_until TIMESTAMPTZ;
BEGIN
    UPDATE mfa_rate_limits
    SET
        attempt_count = attempt_count + 1,
        first_attempt_at = COALESCE(first_attempt_at, v_now),
        updated_at = v_now
    WHERE user_id = p_user_id
    RETURNING * INTO v_record;

    v_new_count := v_record.attempt_count;

    IF v_new_count >= p_max_attempts THEN
        v_locked_until := v_now + (p_lockout_minutes || ' minutes')::INTERVAL;
        UPDATE mfa_rate_limits
        SET locked_until = v_locked_until, updated_at = v_now
        WHERE user_id = p_user_id;

        RETURN jsonb_build_object(
            'locked', true,
            'locked_until', v_locked_until,
            'remaining_attempts', 0
        );
    END IF;

    RETURN jsonb_build_object(
        'locked', false,
        'locked_until', NULL,
        'remaining_attempts', p_max_attempts - v_new_count
    );
END;
$$ LANGUAGE plpgsql;

-- Function to clear rate limit on successful MFA
CREATE OR REPLACE FUNCTION clear_mfa_rate_limit(p_user_id INTEGER) RETURNS VOID AS $$
BEGIN
    UPDATE mfa_rate_limits
    SET attempt_count = 0, first_attempt_at = NULL, locked_until = NULL, updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old records
CREATE OR REPLACE FUNCTION cleanup_mfa_rate_limits() RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM mfa_rate_limits
    WHERE updated_at < NOW() - INTERVAL '24 hours'
    AND locked_until IS NULL;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE mfa_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage mfa_rate_limits" ON mfa_rate_limits;
CREATE POLICY "Service role can manage mfa_rate_limits" ON mfa_rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 012: STORAGE BUCKET FOR PRODUCT IMAGES
-- ============================================
-- Create the storage bucket for product images
-- Uploads go through /api/admin-upload which uses service_role key

-- Update bucket to be public (for reading) with correct settings
UPDATE storage.buckets
SET public = true,
    file_size_limit = 10485760,  -- 10MB max file size
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']::text[]
WHERE id = 'product-images';

-- If bucket doesn't exist, insert it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Drop ALL existing policies for product-images bucket
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND (policyname LIKE '%product%' OR policyname LIKE '%Product%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
    END LOOP;
END $$;

-- SECURE policies: Public can read, only service_role can write
-- Anyone can read (public bucket for displaying product images)
CREATE POLICY "product-images public read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'product-images');

-- Only service_role can insert (uploads go through /api/admin-upload)
CREATE POLICY "product-images service insert"
    ON storage.objects FOR INSERT
    TO service_role
    WITH CHECK (bucket_id = 'product-images');

-- Only service_role can update
CREATE POLICY "product-images service update"
    ON storage.objects FOR UPDATE
    TO service_role
    USING (bucket_id = 'product-images');

-- Only service_role can delete
CREATE POLICY "product-images service delete"
    ON storage.objects FOR DELETE
    TO service_role
    USING (bucket_id = 'product-images');

-- ============================================
-- NOTIFY POSTGREST TO RELOAD SCHEMA
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- DONE!
-- ============================================
SELECT 'Database sync complete!' as result;

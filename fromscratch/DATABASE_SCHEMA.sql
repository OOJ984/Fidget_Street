-- Dangle & Display Complete Database Schema
-- Run in Supabase SQL Editor
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    price_gbp DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'GBP',
    category TEXT NOT NULL CHECK (category IN ('crystal-earrings', 'charm-earrings', 'holders')),
    materials TEXT[] DEFAULT '{}',
    dimensions TEXT,
    variations TEXT[] DEFAULT '{}',
    stock INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    description TEXT,
    images TEXT[] DEFAULT '{}',
    variation_images JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address JSONB NOT NULL,
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    shipping DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    payment_method TEXT CHECK (payment_method IN ('stripe', 'paypal')),
    payment_id TEXT,
    payment_status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_created_at ON orders(customer_email, created_at DESC);

-- ============================================
-- ADMIN USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'business_processing' CHECK (role IN ('website_admin', 'business_processing')),
    mfa_secret TEXT,
    mfa_enabled BOOLEAN DEFAULT false,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    magic_link_token TEXT,
    magic_link_expires TIMESTAMPTZ,
    session_token TEXT,
    session_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_magic_link_token ON customers(magic_link_token) WHERE magic_link_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_session_token ON customers(session_token) WHERE session_token IS NOT NULL;

-- ============================================
-- WEBSITE SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS website_settings (
    id SERIAL PRIMARY KEY,
    company_name TEXT DEFAULT 'Dangle & Display',
    tagline TEXT DEFAULT 'Handcrafted Luxury Jewelry',
    primary_color TEXT DEFAULT '#C4707A',
    secondary_color TEXT DEFAULT '#1a1a1a',
    logo_base64 TEXT,
    favicon_base64 TEXT,
    free_shipping_threshold DECIMAL(10,2) DEFAULT 20.00,
    shipping_cost DECIMAL(10,2) DEFAULT 2.99,
    contact_email TEXT DEFAULT 'hello@dangleanddisplay.co.uk',
    social_instagram TEXT DEFAULT '@dangleanddisplay',
    social_tiktok TEXT,
    footer_tagline TEXT DEFAULT 'Handcrafted luxury jewelry made by young artisans.',
    copyright_text TEXT DEFAULT 'Dangle & Display. All rights reserved.',
    footer_note TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================
-- RATE LIMITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'ip')),
    attempts INTEGER DEFAULT 1,
    first_attempt TIMESTAMPTZ DEFAULT NOW(),
    last_attempt TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    UNIQUE(key, type)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_type ON rate_limits(key, type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked_until ON rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- ============================================
-- EVENTS TABLE (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    event_date DATE NOT NULL,
    start_time TEXT,
    end_time TEXT,
    location TEXT NOT NULL,
    address TEXT,
    description TEXT,
    event_type TEXT DEFAULT 'market',
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_website_settings_updated_at ON website_settings;
CREATE TRIGGER update_website_settings_updated_at
    BEFORE UPDATE ON website_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RATE LIMITING FUNCTIONS
-- ============================================

-- Check if rate limited
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_type TEXT,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER
)
RETURNS TABLE(allowed BOOLEAN, attempts INTEGER, blocked_until TIMESTAMPTZ) AS $$
DECLARE
    v_record rate_limits%ROWTYPE;
    v_window_start TIMESTAMPTZ;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    SELECT * INTO v_record
    FROM rate_limits r
    WHERE r.key = p_key AND r.type = p_type;

    IF NOT FOUND THEN
        RETURN QUERY SELECT true, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > NOW() THEN
        RETURN QUERY SELECT false, v_record.attempts, v_record.blocked_until;
        RETURN;
    END IF;

    IF v_record.first_attempt < v_window_start THEN
        DELETE FROM rate_limits WHERE key = p_key AND type = p_type;
        RETURN QUERY SELECT true, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    IF v_record.attempts >= p_max_attempts THEN
        RETURN QUERY SELECT false, v_record.attempts, v_record.blocked_until;
        RETURN;
    END IF;

    RETURN QUERY SELECT true, v_record.attempts, NULL::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql;

-- Record failed attempt
CREATE OR REPLACE FUNCTION record_failed_attempt(
    p_key TEXT,
    p_type TEXT,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER,
    p_block_minutes INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_record rate_limits%ROWTYPE;
    v_window_start TIMESTAMPTZ;
    v_new_attempts INTEGER;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    SELECT * INTO v_record
    FROM rate_limits r
    WHERE r.key = p_key AND r.type = p_type
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO rate_limits (key, type, attempts, first_attempt, last_attempt)
        VALUES (p_key, p_type, 1, NOW(), NOW());
        RETURN;
    END IF;

    IF v_record.first_attempt < v_window_start THEN
        UPDATE rate_limits
        SET attempts = 1, first_attempt = NOW(), last_attempt = NOW(), blocked_until = NULL
        WHERE key = p_key AND type = p_type;
        RETURN;
    END IF;

    v_new_attempts := v_record.attempts + 1;

    IF v_new_attempts >= p_max_attempts THEN
        UPDATE rate_limits
        SET attempts = v_new_attempts,
            last_attempt = NOW(),
            blocked_until = NOW() + (p_block_minutes || ' minutes')::INTERVAL
        WHERE key = p_key AND type = p_type;
    ELSE
        UPDATE rate_limits
        SET attempts = v_new_attempts, last_attempt = NOW()
        WHERE key = p_key AND type = p_type;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Clear rate limit
CREATE OR REPLACE FUNCTION clear_rate_limit(
    p_key TEXT,
    p_type TEXT
)
RETURNS VOID AS $$
BEGIN
    DELETE FROM rate_limits WHERE key = p_key AND type = p_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Products: Public read for active, service role for all
CREATE POLICY "Public can view active products" ON products
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage products" ON products
    FOR ALL USING (auth.role() = 'service_role');

-- Orders: Service role only
CREATE POLICY "Service role can manage orders" ON orders
    FOR ALL USING (auth.role() = 'service_role');

-- Admin users: Service role only
CREATE POLICY "Service role can manage admins" ON admin_users
    FOR ALL USING (auth.role() = 'service_role');

-- Customers: Service role only
CREATE POLICY "Service role can manage customers" ON customers
    FOR ALL USING (auth.role() = 'service_role');

-- Website settings: Service role only
CREATE POLICY "Service role can manage settings" ON website_settings
    FOR ALL USING (auth.role() = 'service_role');

-- Audit logs: Service role only
CREATE POLICY "Service role can manage audit_logs" ON audit_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Rate limits: Service role only
CREATE POLICY "Service role can manage rate_limits" ON rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- Events: Public read, service role write
CREATE POLICY "Public can view events" ON events
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage events" ON events
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default admin (password: change this!)
-- Generate hash: require('bcryptjs').hashSync('your_password', 12)
INSERT INTO admin_users (email, password_hash, name, role, mfa_enabled)
VALUES (
    'admin@dangleanddisplay.co.uk',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYMyzJ/IWe', -- 'admin123'
    'Admin',
    'website_admin',
    false
) ON CONFLICT (email) DO NOTHING;

-- Insert default settings
INSERT INTO website_settings (id, company_name)
VALUES (1, 'Dangle & Display')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE BUCKET
-- ============================================
-- Create in Supabase Dashboard: Storage > New Bucket
-- Name: product-images
-- Public: Yes
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

-- Fidget Street Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- Products Table
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    price_gbp DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'GBP',
    category TEXT NOT NULL CHECK (category IN ('articulated-toys', 'fidget-cubes', 'spinners', 'push-bubbles', 'bundles')),
    materials TEXT[] DEFAULT '{}',
    dimensions TEXT,
    variations TEXT[] DEFAULT '{}',
    stock INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    description TEXT,
    images TEXT[] DEFAULT '{}',
    variation_images JSONB DEFAULT '{}'::jsonb,  -- Images per variation: { "Gold": ["url1", "url2"], "Silver": ["url3"] }
    trading_station_url TEXT,  -- YE Trading Station product listing URL
    -- Sale pricing fields
    is_on_sale BOOLEAN DEFAULT false,
    sale_price_gbp DECIMAL(10,2),  -- Fixed sale price (if not using percentage)
    sale_percentage INTEGER,  -- Percentage off (e.g. 20 for 20% off)
    sale_starts_at TIMESTAMPTZ,  -- When sale begins (null = immediate)
    sale_ends_at TIMESTAMPTZ,  -- When sale ends (null = no end)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster slug lookups
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- ============================================
-- Orders Table
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

-- Index for order lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_created_at ON orders(customer_email, created_at DESC);

-- ============================================
-- Admin Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'business_processing' CHECK (role IN ('business_processing', 'website_admin')),
    is_active BOOLEAN DEFAULT true,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret TEXT,
    mfa_backup_codes TEXT[], -- Hashed backup codes
    mfa_backup_salt TEXT, -- Per-user salt for backup code hashing
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Events Table (optional - migrate from JSON)
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
-- Auto-update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Products: Anyone can read active products
CREATE POLICY "Public can view active products" ON products
    FOR SELECT USING (is_active = true);

-- Products: Only authenticated service role can modify
CREATE POLICY "Service role can manage products" ON products
    FOR ALL USING (auth.role() = 'service_role');

-- Orders: Service role only (no public access)
CREATE POLICY "Service role can manage orders" ON orders
    FOR ALL USING (auth.role() = 'service_role');

-- Admin users: Service role only
CREATE POLICY "Service role can manage admins" ON admin_users
    FOR ALL USING (auth.role() = 'service_role');

-- Events: Anyone can read
CREATE POLICY "Public can view events" ON events
    FOR SELECT USING (true);

-- Events: Service role can modify
CREATE POLICY "Service role can manage events" ON events
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Newsletter Subscribers Table
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

-- Newsletter: Service role can manage
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage newsletter" ON newsletter_subscribers
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Generate order number function
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
BEGIN
    new_number := 'WK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

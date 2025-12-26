-- ============================================
-- FIDGET STREET - RUN ALL MIGRATIONS
-- Copy and paste this entire file into Supabase SQL Editor
-- ============================================

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

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and recreate
DROP POLICY IF EXISTS "Service role can manage newsletter" ON newsletter_subscribers;
CREATE POLICY "Service role can manage newsletter" ON newsletter_subscribers
    FOR ALL USING (true);

GRANT ALL ON newsletter_subscribers TO service_role;
GRANT USAGE, SELECT ON SEQUENCE newsletter_subscribers_id_seq TO service_role;

-- ============================================
-- Discount Codes Table
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

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage discount codes" ON discount_codes;
CREATE POLICY "Service role can manage discount codes" ON discount_codes
    FOR ALL USING (true);

GRANT ALL ON discount_codes TO service_role;
GRANT SELECT ON discount_codes TO anon;
GRANT USAGE, SELECT ON SEQUENCE discount_codes_id_seq TO service_role;

-- ============================================
-- Discount Usage Tracking Table
-- ============================================
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
GRANT USAGE, SELECT ON SEQUENCE discount_usage_id_seq TO service_role;

-- ============================================
-- Add discount columns to orders table
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2);

-- ============================================
-- Done! All migrations complete.
-- ============================================

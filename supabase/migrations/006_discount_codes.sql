-- Migration: Add discount codes functionality
-- Run this in Supabase SQL Editor

-- Create discount_codes table
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
    created_by INTEGER REFERENCES admin_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_is_active ON discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_codes_dates ON discount_codes(starts_at, expires_at);

-- Add discount columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2);

-- Enable RLS
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated service role to manage discount codes
CREATE POLICY "Service role can manage discount codes" ON discount_codes
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON discount_codes TO service_role;
GRANT SELECT ON discount_codes TO anon;
GRANT USAGE, SELECT ON SEQUENCE discount_codes_id_seq TO service_role;

-- ============================================
-- UPDATE CONSTRAINT FOR FREE DELIVERY TYPE
-- Run this if table already exists:
-- ============================================
-- ALTER TABLE discount_codes DROP CONSTRAINT IF EXISTS discount_codes_discount_type_check;
-- ALTER TABLE discount_codes ADD CONSTRAINT discount_codes_discount_type_check
--     CHECK (discount_type IN ('percentage', 'fixed', 'free_delivery'));

-- ============================================
-- PER-PERSON LIMIT FEATURE
-- Run this to add per-person usage tracking:
-- ============================================
-- Add max_uses_per_customer column
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS max_uses_per_customer INTEGER;

-- Create table to track discount usage by customer
CREATE TABLE IF NOT EXISTS discount_usage (
    id SERIAL PRIMARY KEY,
    discount_code_id INTEGER REFERENCES discount_codes(id) ON DELETE CASCADE,
    customer_email TEXT NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_discount_usage_code_email ON discount_usage(discount_code_id, customer_email);

-- Enable RLS
ALTER TABLE discount_usage ENABLE ROW LEVEL SECURITY;

-- Policy for service role
CREATE POLICY "Service role can manage discount usage" ON discount_usage
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON discount_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE discount_usage_id_seq TO service_role;

-- ============================================
-- MINIMUM ORDER AMOUNT FEATURE
-- Run this to add minimum order requirement:
-- ============================================
-- Add min_order_amount column
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10,2);

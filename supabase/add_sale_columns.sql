-- Migration: Add sale pricing columns to products table
-- Run this in Supabase SQL Editor if you already have the products table

-- Add sale pricing columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price_gbp DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_percentage INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMPTZ;

-- Optional: Add index for finding active sales
CREATE INDEX IF NOT EXISTS idx_products_is_on_sale ON products(is_on_sale) WHERE is_on_sale = true;

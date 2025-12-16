-- Migration: Add variation_images column to products table
-- This allows storing images specific to each product variation
-- Format: { "Gold": ["url1", "url2"], "Silver": ["url3"] }

ALTER TABLE products
ADD COLUMN IF NOT EXISTS variation_images JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN products.variation_images IS 'Images for each variation. Format: { "variation_name": ["image_url1", "image_url2"] }';

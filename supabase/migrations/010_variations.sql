-- Product Variations System
-- Adds sizes table and links products to colors/sizes

-- ============================================
-- Sizes Table (central management like colors)
-- ============================================
CREATE TABLE IF NOT EXISTS sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    short_code VARCHAR(10), -- e.g., 'S', 'M', 'L', 'XL'
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sizes_name ON sizes(name);

-- Trigger for updated_at
CREATE TRIGGER sizes_updated_at
    BEFORE UPDATE ON sizes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert common sizes
INSERT INTO sizes (name, short_code, display_order) VALUES
    ('Mini', 'XS', 1),
    ('Small', 'S', 2),
    ('Medium', 'M', 3),
    ('Large', 'L', 4),
    ('Extra Large', 'XL', 5),
    ('One Size', 'OS', 10)
ON CONFLICT (name) DO NOTHING;

-- RLS for sizes
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sizes are viewable by everyone" ON sizes
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage sizes" ON sizes
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Product Variations Table
-- Links products to their available color/size combos
-- Each row = one purchasable variant
-- ============================================
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_id UUID REFERENCES colors(id) ON DELETE SET NULL,
    size_id UUID REFERENCES sizes(id) ON DELETE SET NULL,
    sku VARCHAR(100), -- Optional unique SKU per variant
    price_adjustment DECIMAL(10,2) DEFAULT 0, -- +/- from base price
    stock INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    images TEXT[] DEFAULT '{}', -- Variant-specific images
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, color_id, size_id) -- No duplicate combos
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_color ON product_variants(color_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_size ON product_variants(size_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_available ON product_variants(is_available);

-- Trigger for updated_at
CREATE TRIGGER product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product variants viewable by everyone" ON product_variants
    FOR SELECT USING (is_available = true);

CREATE POLICY "Service role can manage product variants" ON product_variants
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Add available colors/sizes columns to products
-- These are arrays of IDs for quick filtering
-- ============================================
ALTER TABLE products
ADD COLUMN IF NOT EXISTS available_color_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS available_size_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

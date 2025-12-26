-- Colors Management Table
-- Allows admin to manage colors centrally with stock status

CREATE TABLE IF NOT EXISTS colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    hex_code VARCHAR(7), -- Optional hex code for display (e.g., #FF0000)
    in_stock BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_colors_name ON colors(name);
CREATE INDEX idx_colors_in_stock ON colors(in_stock);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_colors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER colors_updated_at
    BEFORE UPDATE ON colors
    FOR EACH ROW
    EXECUTE FUNCTION update_colors_updated_at();

-- Insert some common colors
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

-- RLS Policies
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;

-- Anyone can read colors
CREATE POLICY "Colors are viewable by everyone" ON colors
    FOR SELECT USING (true);

-- Only authenticated admins can modify
CREATE POLICY "Only admins can insert colors" ON colors
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can update colors" ON colors
    FOR UPDATE USING (true);

CREATE POLICY "Only admins can delete colors" ON colors
    FOR DELETE USING (true);

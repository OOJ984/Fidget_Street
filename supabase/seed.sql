-- Dangle & Display Seed Data
-- Run this AFTER schema.sql in Supabase SQL Editor

-- ============================================
-- Insert Products (migrated from products.json)
-- ============================================
INSERT INTO products (id, title, slug, price_gbp, currency, category, materials, dimensions, variations, stock, tags, description, images, is_active)
VALUES
(1, 'Crystal Drop Earrings', 'crystal-drop-earrings', 8.99, 'GBP', 'crystal-earrings',
 ARRAY['Swarovski crystals', 'Sterling silver hooks'], '3cm drop length',
 ARRAY['Clear', 'Rose', 'Aurora Borealis'], 15, ARRAY['featured', 'bestseller'],
 'Elegant teardrop crystals that catch the light beautifully. These stunning earrings feature genuine Swarovski crystals suspended from sterling silver hooks, creating a sophisticated look perfect for any occasion.',
 ARRAY[]::TEXT[], true),

(2, 'Pearl Cluster Studs', 'pearl-cluster-studs', 6.99, 'GBP', 'crystal-earrings',
 ARRAY['Freshwater pearls', 'Gold-plated studs'], '1.5cm diameter',
 ARRAY['White', 'Cream', 'Pink'], 20, ARRAY['featured', 'new'],
 'Delicate clusters of freshwater pearls arranged in a timeless design. These versatile studs add an elegant touch to both casual and formal outfits.',
 ARRAY[]::TEXT[], true),

(3, 'Butterfly Charm Hoops', 'butterfly-charm-hoops', 7.50, 'GBP', 'charm-earrings',
 ARRAY['Gold-plated brass', 'Enamel charms'], '2.5cm hoop diameter',
 ARRAY['Blue', 'Pink', 'Multicolor'], 12, ARRAY['featured', 'gift'],
 'Playful butterfly charms dangle from delicate gold hoops. These whimsical earrings are perfect for adding a touch of fun to your everyday look.',
 ARRAY[]::TEXT[], true),

(4, 'Moon & Star Dangles', 'moon-star-dangles', 9.50, 'GBP', 'charm-earrings',
 ARRAY['Sterling silver', 'Cubic zirconia'], '4cm total length',
 ARRAY['Silver', 'Gold'], 8, ARRAY['new', 'featured'],
 'Celestial-inspired earrings featuring a crescent moon and star design. Adorned with sparkling cubic zirconia stones that twinkle like the night sky.',
 ARRAY[]::TEXT[], true),

(5, 'Heart Charm Studs', 'heart-charm-studs', 5.99, 'GBP', 'charm-earrings',
 ARRAY['Rose gold-plated brass'], '1cm width',
 ARRAY['Rose Gold', 'Silver', 'Gold'], 25, ARRAY['bestseller', 'gift'],
 'Sweet and simple heart-shaped studs in a beautiful rose gold finish. The perfect gift for someone special or a lovely treat for yourself.',
 ARRAY[]::TEXT[], true),

(6, 'Crystal Cascade Earrings', 'crystal-cascade-earrings', 12.99, 'GBP', 'crystal-earrings',
 ARRAY['Czech crystals', 'Sterling silver'], '5cm total length',
 ARRAY['Clear', 'Champagne', 'Midnight Blue'], 6, ARRAY['new'],
 'Statement earrings featuring cascading crystals that create a waterfall effect. Perfect for special occasions when you want to make an impression.',
 ARRAY[]::TEXT[], true),

(7, 'Minimal Geometric Holder', 'minimal-geometric-holder', 14.99, 'GBP', 'holders',
 ARRAY['PLA biodegradable plastic'], '10cm x 8cm x 12cm',
 ARRAY['Matte Black', 'Matte White', 'Rose Gold'], 10, ARRAY['featured', 'bestseller'],
 'Modern geometric jewelry holder designed to beautifully display your earring collection. 3D printed using eco-friendly PLA filament sourced from UK suppliers.',
 ARRAY[]::TEXT[], true),

(8, 'Wave Pattern Holder', 'wave-pattern-holder', 16.99, 'GBP', 'holders',
 ARRAY['PLA biodegradable plastic'], '12cm x 8cm x 15cm',
 ARRAY['Pearl White', 'Soft Pink', 'Ocean Blue'], 7, ARRAY['new'],
 'Elegant wave-inspired design that holds up to 20 pairs of earrings. The organic curves create a stunning display piece for your dresser or vanity.',
 ARRAY[]::TEXT[], true),

(9, 'Daisy Chain Drops', 'daisy-chain-drops', 8.50, 'GBP', 'charm-earrings',
 ARRAY['Enamel', 'Gold-plated brass'], '3.5cm drop length',
 ARRAY['White/Yellow', 'Pink/White', 'Blue/White'], 0, ARRAY['gift'],
 'Charming daisy flower drops that bring a touch of spring to any outfit. Hand-painted enamel details create a unique, artisan look.',
 ARRAY[]::TEXT[], true),

(10, 'Mini Hoop Collection', 'mini-hoop-collection', 11.99, 'GBP', 'crystal-earrings',
 ARRAY['Sterling silver', 'Micro crystals'], '1.5cm diameter',
 ARRAY['Silver', 'Gold', 'Rose Gold'], 18, ARRAY['bestseller'],
 'Classic mini hoops encrusted with delicate micro crystals. Perfect for everyday wear, these versatile hoops complement any style.',
 ARRAY[]::TEXT[], true);

-- Reset the sequence to continue from 11
SELECT setval('products_id_seq', 10, true);

-- ============================================
-- Insert Default Admin User
-- IMPORTANT: Update password_hash after setting JWT_SECRET!
--
-- To generate password hash:
-- 1. Set JWT_SECRET in your .env
-- 2. Run in Node.js:
--    require('crypto').createHash('sha256').update('YOUR_PASSWORD' + 'YOUR_JWT_SECRET').digest('hex')
-- 3. Replace the hash below
--
-- Default placeholder (password: changeme, secret: default)
-- ============================================
INSERT INTO admin_users (email, password_hash, name, role)
VALUES (
    'admin@dangleanddisplay.co.uk',
    'REPLACE_WITH_GENERATED_HASH',
    'Dangle & Display Admin',
    'super_admin'
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Verify data
-- ============================================
SELECT 'Products inserted: ' || COUNT(*) FROM products;
SELECT 'Admin users inserted: ' || COUNT(*) FROM admin_users;

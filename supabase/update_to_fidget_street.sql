-- ============================================
-- Fidget Street Database Update
-- Run this in Supabase SQL Editor to update from Wicka to Fidget Street
-- ============================================

-- STEP 1: Delete old products FIRST
DELETE FROM products;

-- STEP 2: Update the category constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products ADD CONSTRAINT products_category_check
    CHECK (category IN ('articulated-toys', 'fidget-cubes', 'spinners', 'push-bubbles', 'bundles'));

-- STEP 3: Insert all 19 Fidget Street products
INSERT INTO products (id, title, slug, price_gbp, currency, category, materials, dimensions, variations, stock, tags, description, images, is_active)
VALUES
-- Articulated Toys (5)
(1, 'Articulated Dragon', 'articulated-dragon', 12.99, 'GBP', 'articulated-toys',
 ARRAY['PLA biodegradable plastic'], '25cm length',
 ARRAY['Red', 'Blue', 'Green', 'Gold', 'Black'], 20, ARRAY['featured', 'bestseller'],
 'Our most popular fidget toy! This fully articulated dragon has flexible joints throughout its body, allowing you to pose it in endless positions. Made from eco-friendly plant-based PLA plastic.',
 ARRAY[]::TEXT[], true),

(2, 'Articulated Octopus', 'articulated-octopus', 9.99, 'GBP', 'articulated-toys',
 ARRAY['PLA biodegradable plastic'], '15cm diameter',
 ARRAY['Purple', 'Pink', 'Blue', 'Orange'], 25, ARRAY['featured', 'new'],
 'Adorable articulated octopus with 8 flexible tentacles! Each tentacle moves independently, making this a super satisfying fidget toy.',
 ARRAY[]::TEXT[], true),

(3, 'Articulated Snake', 'articulated-snake', 8.99, 'GBP', 'articulated-toys',
 ARRAY['PLA biodegradable plastic'], '30cm length',
 ARRAY['Green', 'Rainbow', 'Black', 'White'], 18, ARRAY['bestseller'],
 'Slithery fun! This articulated snake has smooth, satisfying movement. Wrap it around your finger, coil it up, or stretch it out.',
 ARRAY[]::TEXT[], true),

(4, 'Articulated Scorpion', 'articulated-scorpion', 11.99, 'GBP', 'articulated-toys',
 ARRAY['PLA biodegradable plastic'], '18cm length',
 ARRAY['Black', 'Gold', 'Red'], 12, ARRAY['new'],
 'Cool and creepy articulated scorpion! Features a moveable tail, claws, and legs. A unique fidget toy that looks amazing on your desk.',
 ARRAY[]::TEXT[], true),

(5, 'Articulated Caterpillar', 'articulated-caterpillar', 7.99, 'GBP', 'articulated-toys',
 ARRAY['PLA biodegradable plastic'], '20cm length',
 ARRAY['Rainbow', 'Green', 'Pink', 'Yellow'], 30, ARRAY['gift', 'bestseller'],
 'Cute and wiggly articulated caterpillar! Perfect for all fidgeters. The smooth segments make a satisfying clicking sound.',
 ARRAY[]::TEXT[], true),

-- Fidget Cubes (4)
(6, 'Classic Fidget Cube', 'classic-fidget-cube', 6.99, 'GBP', 'fidget-cubes',
 ARRAY['ABS plastic', 'Silicone buttons'], '3.3cm cube',
 ARRAY['Black', 'White', 'Blue', 'Green', 'Pink'], 40, ARRAY['featured', 'bestseller'],
 '6-sided fidget cube with different activities on each side: click, glide, flip, breathe, roll, and spin. The original desk toy for focus.',
 ARRAY[]::TEXT[], true),

(7, 'Infinity Cube', 'infinity-cube', 8.99, 'GBP', 'fidget-cubes',
 ARRAY['ABS plastic', 'Metal hinges'], '4cm cube',
 ARRAY['Silver', 'Gold', 'Black', 'Rainbow'], 25, ARRAY['featured', 'new'],
 'Endlessly folding infinity cube! This mesmerizing fidget toy folds and unfolds infinitely. Smooth, quiet, and incredibly satisfying.',
 ARRAY[]::TEXT[], true),

(8, 'Fidget Cube Pro', 'fidget-cube-pro', 9.99, 'GBP', 'fidget-cubes',
 ARRAY['Premium ABS plastic', 'Metal ball bearing'], '3.5cm cube',
 ARRAY['Matte Black', 'Navy', 'Burgundy'], 15, ARRAY['new'],
 'Premium version of the classic fidget cube with upgraded materials and smoother mechanisms. Features a metal ball bearing spinner.',
 ARRAY[]::TEXT[], true),

(9, 'Mini Fidget Cube Keychain', 'mini-fidget-cube-keychain', 4.99, 'GBP', 'fidget-cubes',
 ARRAY['ABS plastic', 'Metal keyring'], '2.2cm cube',
 ARRAY['Black', 'White', 'Mixed Colors'], 50, ARRAY['gift', 'bestseller'],
 'Take your fidget cube everywhere! This mini version attaches to your keys or bag. All 6 sides still fully functional.',
 ARRAY[]::TEXT[], true),

-- Finger Spinners (3)
(10, 'Classic Finger Spinner', 'classic-finger-spinner', 4.99, 'GBP', 'spinners',
 ARRAY['ABS plastic', 'Steel bearings'], '7cm diameter',
 ARRAY['Black', 'White', 'Blue', 'Red', 'Rainbow'], 50, ARRAY['featured', 'bestseller'],
 'The original fidget spinner! Smooth steel bearings provide satisfying long spins. Perfect for focus and stress relief.',
 ARRAY[]::TEXT[], true),

(11, 'Metal Finger Spinner', 'metal-finger-spinner', 7.99, 'GBP', 'spinners',
 ARRAY['Zinc alloy', 'Ceramic bearings'], '6cm diameter',
 ARRAY['Silver', 'Gold', 'Black', 'Rainbow'], 30, ARRAY['new'],
 'Premium metal spinner with ultra-smooth ceramic bearings. Heavier weight for longer, more satisfying spins.',
 ARRAY[]::TEXT[], true),

(12, 'LED Light-Up Spinner', 'led-light-up-spinner', 6.99, 'GBP', 'spinners',
 ARRAY['ABS plastic', 'LED lights', 'Steel bearings'], '7.5cm diameter',
 ARRAY['Blue LED', 'Rainbow LED', 'Green LED'], 25, ARRAY['gift', 'new'],
 'Light up your spins! Features colorful LED lights that create amazing patterns when spinning. Batteries included.',
 ARRAY[]::TEXT[], true),

-- Push Bubbles (4)
(13, 'Classic Push Bubble', 'classic-push-bubble', 3.99, 'GBP', 'push-bubbles',
 ARRAY['Food-grade silicone'], '12cm square',
 ARRAY['Rainbow', 'Blue', 'Pink', 'Green', 'Purple'], 60, ARRAY['featured', 'bestseller'],
 'Satisfying pop-pop-pop! Press the bubbles down and flip it over to start again. Endless sensory fun for all ages.',
 ARRAY[]::TEXT[], true),

(14, 'Jumbo Push Bubble', 'jumbo-push-bubble', 6.99, 'GBP', 'push-bubbles',
 ARRAY['Food-grade silicone'], '20cm diameter',
 ARRAY['Rainbow Circle', 'Tie-Dye', 'Glow in Dark'], 35, ARRAY['new'],
 'Extra large push bubble for even more popping satisfaction! Great for sharing or using both hands.',
 ARRAY[]::TEXT[], true),

(15, 'Push Bubble Keychain', 'push-bubble-keychain', 2.49, 'GBP', 'push-bubbles',
 ARRAY['Food-grade silicone', 'Metal keyring'], '5cm',
 ARRAY['Mixed Colors', 'Pastel', 'Neon'], 80, ARRAY['gift', 'bestseller'],
 'Take your bubbles everywhere! Mini push bubble that clips to your keys, bag, or pencil case.',
 ARRAY[]::TEXT[], true),

(16, 'Animal Shape Push Bubble', 'animal-push-bubble', 4.99, 'GBP', 'push-bubbles',
 ARRAY['Food-grade silicone'], '15cm',
 ARRAY['Dinosaur', 'Unicorn', 'Dog', 'Cat'], 40, ARRAY['gift'],
 'Fun animal-shaped push bubbles! Choose from dinosaur, unicorn, dog, or cat. Kids love these!',
 ARRAY[]::TEXT[], true),

-- Bundles (3)
(17, 'Mini Bundle', 'mini-sensory-bundle', 14.99, 'GBP', 'bundles',
 ARRAY['Various'], 'Multiple items',
 ARRAY['Mixed Colors'], 25, ARRAY['gift', 'bestseller'],
 'Perfect starter pack! Includes 1 Push Bubble, 1 Mini Fidget Cube Keychain, and 1 Classic Finger Spinner. Save over 20%!',
 ARRAY[]::TEXT[], true),

(18, 'Standard Bundle', 'standard-sensory-bundle', 24.99, 'GBP', 'bundles',
 ARRAY['Various'], 'Multiple items',
 ARRAY['Mixed Colors'], 20, ARRAY['featured', 'gift'],
 'Our most popular bundle! Includes 1 Articulated Snake, 1 Infinity Cube, 1 Classic Push Bubble, and 1 Classic Finger Spinner. Great value!',
 ARRAY[]::TEXT[], true),

(19, 'Ultimate Bundle', 'ultimate-sensory-bundle', 39.99, 'GBP', 'bundles',
 ARRAY['Various'], 'Multiple items',
 ARRAY['Mixed Colors'], 15, ARRAY['featured', 'gift'],
 'The ultimate sensory collection! Includes 1 Articulated Dragon, 1 Articulated Octopus, 1 Infinity Cube, 1 Jumbo Push Bubble, and 1 Metal Finger Spinner. Best value!',
 ARRAY[]::TEXT[], true);

-- Reset the sequence
SELECT setval('products_id_seq', 19, true);

-- STEP 4: Update order number prefix to FS- (Fidget Street)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
BEGIN
    new_number := 'FS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- STEP 5: Update website_settings
UPDATE website_settings SET
    company_name = 'Fidget Street',
    tagline = 'Everyday Satisfaction',
    contact_email = 'hello@fidgetstreet.co.uk',
    instagram_url = 'https://instagram.com/fidgetstreet',
    primary_color = '#71c7e1',
    secondary_color = '#A8E0A2',
    default_title_suffix = 'Fidget Street',
    default_description = 'Eco-friendly fidget toys for focus, fun, and stress relief. For everyone.',
    free_shipping_threshold = 30,
    footer_tagline = 'Everyday Satisfaction - Eco-friendly fidget toys for all ages.',
    copyright_text = 'Fidget Street. All rights reserved.'
WHERE id = 1;

-- Verify the updates
SELECT 'Products: ' || COUNT(*) FROM products;
SELECT 'Categories: ' || string_agg(DISTINCT category, ', ') FROM products;

-- ============================================
-- Storage Bucket for Product Images
-- ============================================
-- This creates the 'product-images' bucket for storing product images.
-- Run this in Supabase SQL Editor if the bucket doesn't exist.

-- Create or update the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,  -- Public bucket for product images
    5242880,  -- 5MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Public read for product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow deletes from product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload access for product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete access for product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update access for product images" ON storage.objects;

-- Create permissive policies for product-images bucket
-- Authentication is handled at the Netlify function level
CREATE POLICY "Public read for product-images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');

CREATE POLICY "Allow uploads to product-images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Allow updates to product-images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'product-images');

CREATE POLICY "Allow deletes from product-images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'product-images');

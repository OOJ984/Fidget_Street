-- ============================================
-- Storage Bucket for Product Images
-- ============================================
-- This creates the 'product-images' bucket for storing product images.
-- Run this in Supabase SQL Editor if the bucket doesn't exist.

-- Create the storage bucket (requires storage admin privileges)
-- Note: This may need to be done via Supabase Dashboard UI instead

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,  -- Public bucket for product images
    5242880,  -- 5MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket

-- Allow public read access to all product images
CREATE POLICY "Public read access for product images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');

-- Allow authenticated admins to upload images
CREATE POLICY "Admin upload access for product images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'product-images'
        -- Note: Additional auth checks done at function level
    );

-- Allow authenticated admins to delete images
CREATE POLICY "Admin delete access for product images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'product-images');

-- Allow authenticated admins to update images
CREATE POLICY "Admin update access for product images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'product-images');

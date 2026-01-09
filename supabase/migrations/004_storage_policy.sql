-- ============================================
-- Storage Bucket Policy for item-images
-- ============================================
-- Run this in Supabase SQL Editor to allow uploads

-- Allow anyone to upload to item-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy: Allow all uploads (no auth required - internal tool)
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'item-images');

-- Policy: Allow all reads (images are public)
CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'item-images');

-- Policy: Allow all deletes
CREATE POLICY "Allow public deletes"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'item-images');

-- Tier-2: optional photo evidence on price submissions.
-- Run once in the Supabase SQL editor after enabling Storage in the project.

-- 1. Add nullable photo_url column to price_submissions
ALTER TABLE price_submissions
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Storage bucket — public read for transparency, anyone can upload
INSERT INTO storage.buckets (id, name, public)
VALUES ('price-photos', 'price-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS: allow public uploads to this bucket and public reads
DROP POLICY IF EXISTS "Public can upload price photos" ON storage.objects;
CREATE POLICY "Public can upload price photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'price-photos');

DROP POLICY IF EXISTS "Public can read price photos" ON storage.objects;
CREATE POLICY "Public can read price photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'price-photos');

-- =============================================
-- Storage Buckets for file uploads
-- Replaces Go backend file upload handlers
-- =============================================

-- Product images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Promo/display images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promos',
  'promos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- General media library bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Storage RLS Policies
-- =============================================

-- Products bucket: anyone can read, authenticated users can upload/delete
CREATE POLICY "Public read access for products" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products');

CREATE POLICY "Authenticated users can update product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products');

CREATE POLICY "Authenticated users can delete product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products');

-- Promos bucket: anyone can read, authenticated users can manage
CREATE POLICY "Public read access for promos" ON storage.objects
  FOR SELECT USING (bucket_id = 'promos');

CREATE POLICY "Authenticated users can upload promos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'promos');

CREATE POLICY "Authenticated users can update promos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'promos');

CREATE POLICY "Authenticated users can delete promos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'promos');

-- Media bucket: anyone can read, authenticated users can manage
CREATE POLICY "Public read access for media" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can upload media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Authenticated users can update media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can delete media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media');

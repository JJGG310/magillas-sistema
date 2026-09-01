-- Bucket público para fotos de personalización en pedidos (máx 100 KB, solo JPEG/PNG/WebP)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('magillas-fotos', 'magillas-fotos', true, 102400, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 102400;

DROP POLICY IF EXISTS magillas_fotos_public_read ON storage.objects;
CREATE POLICY magillas_fotos_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'magillas-fotos');

DROP POLICY IF EXISTS magillas_fotos_server_upload ON storage.objects;
CREATE POLICY magillas_fotos_server_upload ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'magillas-fotos' AND (storage.foldername(name))[1] = 'pedidos');

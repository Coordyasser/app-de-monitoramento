-- =============================================================
-- EleitoWatch | Migration 005 — Storage Bucket "incidents"
-- Armazenamento de fotos das ocorrências
-- =============================================================

-- Cria o bucket (público para leitura via URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incidents',
  'incidents',
  true,               -- URLs públicas de leitura sem autenticação
  5242880,            -- Limite de 5 MB por arquivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- Policies do Storage
-- ---------------------------------------------------------------

-- Qualquer usuário autenticado ou anônimo pode fazer upload
CREATE POLICY "incidents_upload_any"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'incidents');

-- Leitura pública de qualquer objeto no bucket
CREATE POLICY "incidents_read_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'incidents');

-- Somente o próprio uploader ou admin pode deletar
CREATE POLICY "incidents_delete_own_or_admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'incidents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

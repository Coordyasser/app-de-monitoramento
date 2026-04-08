-- =============================================================
-- EleitoWatch | Migration 006 — Correções de Segurança
-- Cobre todas as falhas identificadas na revisão técnica
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Role CHECK: adiciona 'revoked' como valor válido
-- ---------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('agent', 'admin', 'revoked'));

-- ---------------------------------------------------------------
-- 2. LGPD: campo para marcar solicitação de exclusão
-- ---------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

-- ---------------------------------------------------------------
-- 3. RLS ocorrencias — INSERT: valida que user_id = auth.uid()
--    Anônimo só pode inserir com user_id IS NULL
--    Autenticado só pode inserir com o próprio id
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "ocorrencias_insert_any" ON public.ocorrencias;

CREATE POLICY "ocorrencias_insert_validated"
  ON public.ocorrencias FOR INSERT
  WITH CHECK (
    user_id IS NULL                   -- denúncia anônima
    OR user_id = auth.uid()           -- denúncia autenticada (próprio id)
  );

-- ---------------------------------------------------------------
-- 4. RLS ocorrencias — SELECT agente: não bloqueia mais anônimos
--    (registros anônimos são irreidentificáveis, só admin os vê)
--    Apenas garante que agentes autenticados vejam os próprios
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "ocorrencias_select_own" ON public.ocorrencias;

CREATE POLICY "ocorrencias_select_own"
  ON public.ocorrencias FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- ---------------------------------------------------------------
-- 5. Storage — DROP e recriação com ownership validation
--    Autenticado: pasta deve iniciar com seu user_id
--    Anônimo: pasta deve iniciar com 'anonimo'
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "incidents_upload_any"            ON storage.objects;
DROP POLICY IF EXISTS "incidents_read_public"           ON storage.objects;
DROP POLICY IF EXISTS "incidents_delete_own_or_admin"   ON storage.objects;

-- Upload com validação de path
CREATE POLICY "incidents_upload_validated"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'incidents'
    AND (
      -- Autenticado: primeiro segmento do path = seu user_id
      (
        auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      -- Anônimo: primeiro segmento = 'anonimo'
      OR (
        auth.uid() IS NULL
        AND (storage.foldername(name))[1] = 'anonimo'
      )
    )
  );

-- Leitura pública permanece irrestrita (URLs são públicas por design)
CREATE POLICY "incidents_read_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'incidents');

-- Deleção: próprio uploader autenticado ou admin
CREATE POLICY "incidents_delete_own_or_admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'incidents'
    AND (
      -- Autenticado deleta seus próprios arquivos
      (
        auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      -- Admin deleta qualquer arquivo (incluindo pasta 'anonimo')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- ---------------------------------------------------------------
-- 6. RPC LGPD: anonimiza PII e registra solicitação de exclusão
--    Chamada pelo próprio usuário — não deleta auth.users
--    (deleção final do auth.users requer service_role pelo admin)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado';
  END IF;

  UPDATE public.profiles SET
    full_name             = 'Usuário Removido',
    phone                 = NULL,
    lgpd_consent          = false,
    deletion_requested_at = now()
  WHERE id = auth.uid();

  -- Anonimiza as ocorrências do usuário (desvincula user_id)
  UPDATE public.ocorrencias
  SET user_id = NULL
  WHERE user_id = auth.uid();
END;
$$;

-- ---------------------------------------------------------------
-- 7. RLS profiles — SELECT: bloqueia perfis revogados de se lerem
--    (previne acesso a dados próprios após revogação)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    AND role != 'revoked'
  );

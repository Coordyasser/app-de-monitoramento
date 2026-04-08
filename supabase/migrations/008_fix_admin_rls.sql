-- =============================================================
-- EleitoWatch | Migration 008 — Corrige RLS recursivo do admin
--
-- Problema: as policies "profiles_select_admin" e similares
-- fazem EXISTS (SELECT FROM profiles WHERE role = 'admin'),
-- que re-dispara a avaliação RLS da mesma tabela, podendo
-- causar falha silenciosa e retornar profile = null.
--
-- Solução: função SECURITY DEFINER is_admin() que lê a tabela
-- sem RLS, eliminando a recursão.
-- =============================================================

-- ── 1. Função helper is_admin() ───────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id   = auth.uid()
      AND  role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ── 2. Reconstrói policies da tabela profiles ─────────────────

DROP POLICY IF EXISTS "profiles_select_admin"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"  ON public.profiles;

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- ── 3. Reconstrói policies da tabela ocorrencias ──────────────

DROP POLICY IF EXISTS "ocorrencias_select_admin"          ON public.ocorrencias;
DROP POLICY IF EXISTS "ocorrencias_update_status_admin"   ON public.ocorrencias;

CREATE POLICY "ocorrencias_select_admin"
  ON public.ocorrencias FOR SELECT
  USING (public.is_admin());

CREATE POLICY "ocorrencias_update_status_admin"
  ON public.ocorrencias FOR UPDATE
  USING (public.is_admin());

-- ── 4. Garante acesso à view de ocorrências detalhadas ────────
-- (PostgREST expõe apenas objetos que o role authenticated pode SELECT)

GRANT SELECT ON public.vw_ocorrencias_detalhadas TO authenticated;

-- ── 5. Garante GRANT nas demais tabelas ao role authenticated ─
-- (Supabase cria esses grants automaticamente para tabelas novas,
--  mas é seguro reafirmá-los)

GRANT SELECT ON public.profiles              TO authenticated;
GRANT SELECT ON public.ocorrencias           TO authenticated;
GRANT SELECT ON public.secoes_eleitorais_pi  TO anon, authenticated;

-- =============================================================
-- EleitoWatch | Migration 004 — Row Level Security (RLS)
-- Segurança por linha em todas as tabelas públicas
-- =============================================================

-- ---------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Agente lê apenas o próprio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin lê todos os perfis
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Usuário edita apenas o próprio perfil
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin pode atualizar qualquer perfil (ex: revogar credencial, trocar role)
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------
-- SECOES_ELEITORAIS_PI
-- ---------------------------------------------------------------
ALTER TABLE public.secoes_eleitorais_pi ENABLE ROW LEVEL SECURITY;

-- Leitura pública irrestrita (qualquer visitante pode buscar seções)
CREATE POLICY "secoes_select_public"
  ON public.secoes_eleitorais_pi FOR SELECT
  USING (true);

-- Escrita exclusiva via service_role (Edge Function de sync)
-- Nenhuma policy INSERT/UPDATE/DELETE para anon ou authenticated
-- A Edge Function usa a service_role key que bypassa o RLS

-- ---------------------------------------------------------------
-- OCORRENCIAS
-- ---------------------------------------------------------------
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

-- Anônimo e autenticado podem inserir ocorrências
CREATE POLICY "ocorrencias_insert_any"
  ON public.ocorrencias FOR INSERT
  WITH CHECK (true);

-- Agente autenticado lê apenas as próprias ocorrências
CREATE POLICY "ocorrencias_select_own"
  ON public.ocorrencias FOR SELECT
  USING (auth.uid() = user_id);

-- Admin lê todas as ocorrências
CREATE POLICY "ocorrencias_select_admin"
  ON public.ocorrencias FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Somente admin pode atualizar o status
CREATE POLICY "ocorrencias_update_status_admin"
  ON public.ocorrencias FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------
-- VIEWS DE SUPORTE PARA O DASHBOARD (MD.05)
-- ---------------------------------------------------------------

-- View: ocorrências enriquecidas com dados da seção e do agente
CREATE OR REPLACE VIEW public.vw_ocorrencias_detalhadas AS
SELECT
  o.id,
  o.categoria,
  o.descricao,
  o.foto_url,
  o.latitude,
  o.longitude,
  o.status,
  o.created_at,
  o.user_id,
  p.full_name    AS agente_nome,
  p.phone        AS agente_phone,
  s.municipio,
  s.zona,
  s.local_votacao,
  s.secao,
  s.urna
FROM public.ocorrencias o
LEFT JOIN public.profiles p       ON p.id = o.user_id
LEFT JOIN public.secoes_eleitorais_pi s ON s.id = o.secao_id;

-- RPC: métricas de hoje vs. ontem (usada no dashboard de admin)
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_hoje',      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
    'total_ontem',     COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE - 1),
    'pendentes',       COUNT(*) FILTER (WHERE status = 'pendente'),
    'agentes_ativos',  (
      SELECT COUNT(DISTINCT user_id)
      FROM public.ocorrencias
      WHERE created_at >= now() - interval '24 hours'
        AND user_id IS NOT NULL
    )
  )
  INTO result
  FROM public.ocorrencias;

  RETURN result;
END;
$$;

-- RPC: distribuição por categoria (gráfico donut)
CREATE OR REPLACE FUNCTION public.get_ocorrencias_por_categoria()
RETURNS TABLE(categoria text, total bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT categoria, COUNT(*) AS total
  FROM public.ocorrencias
  GROUP BY categoria
  ORDER BY total DESC;
$$;

-- RPC: top 10 municípios (gráfico de barras)
CREATE OR REPLACE FUNCTION public.get_top_municipios(limit_n int DEFAULT 10)
RETURNS TABLE(municipio text, total bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT s.municipio, COUNT(o.id) AS total
  FROM public.ocorrencias o
  JOIN public.secoes_eleitorais_pi s ON s.id = o.secao_id
  GROUP BY s.municipio
  ORDER BY total DESC
  LIMIT limit_n;
$$;

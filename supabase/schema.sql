-- =============================================================
-- EleitoWatch | Migration 001 — Tabela profiles
-- Extensão do auth.users com dados do agente/admin
-- =============================================================

CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text        NOT NULL,
  phone       text,
  role        text        NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'admin')),
  lgpd_consent boolean    NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Trigger: cria profile automaticamente ao registrar usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, lgpd_consent)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE((NEW.raw_user_meta_data->>'lgpd_consent')::boolean, false)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- =============================================================
-- EleitoWatch | Migration 002 — Tabela secoes_eleitorais_pi
-- Cache local da API CKAN do TRE-PI (5 níveis de localização)
-- =============================================================

CREATE TABLE public.secoes_eleitorais_pi (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio       text        NOT NULL,
  zona            text        NOT NULL,
  local_votacao   text        NOT NULL,
  secao           text        NOT NULL,
  urna            text        NOT NULL,
  last_synced     timestamptz NOT NULL DEFAULT now(),

  -- Chave de unicidade para upsert idempotente pela Edge Function
  UNIQUE (municipio, zona, local_votacao, secao, urna)
);

-- Índices para os filtros em cascata (Município → Zona → Local → Seção)
CREATE INDEX idx_secoes_municipio          ON public.secoes_eleitorais_pi (municipio);
CREATE INDEX idx_secoes_zona               ON public.secoes_eleitorais_pi (zona);
CREATE INDEX idx_secoes_local_votacao      ON public.secoes_eleitorais_pi (local_votacao);
CREATE INDEX idx_secoes_municipio_zona     ON public.secoes_eleitorais_pi (municipio, zona);
CREATE INDEX idx_secoes_mun_zona_local     ON public.secoes_eleitorais_pi (municipio, zona, local_votacao);
CREATE INDEX idx_secoes_mun_zona_local_sec ON public.secoes_eleitorais_pi (municipio, zona, local_votacao, secao);
-- =============================================================
-- EleitoWatch | Migration 003 — Tabela ocorrencias
-- Incidentes registrados por agentes ou usuários anônimos
-- =============================================================

CREATE TABLE public.ocorrencias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL, -- nullable (anônimo)
  secao_id    uuid        NOT NULL REFERENCES public.secoes_eleitorais_pi(id) ON DELETE RESTRICT,
  categoria   text        NOT NULL CHECK (categoria IN (
                'irregularidade_administrativa',
                'problema_com_urna',
                'fila_aglomeracao',
                'acessibilidade',
                'conduta_suspeita',
                'outro'
              )),
  descricao   text        NOT NULL CHECK (char_length(descricao) BETWEEN 20 AND 1000),
  foto_url    text,
  latitude    float,
  longitude   float,
  status      text        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'arquivada')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índices para queries do Admin Dashboard
CREATE INDEX idx_ocorrencias_user_id    ON public.ocorrencias (user_id);
CREATE INDEX idx_ocorrencias_secao_id   ON public.ocorrencias (secao_id);
CREATE INDEX idx_ocorrencias_status     ON public.ocorrencias (status);
CREATE INDEX idx_ocorrencias_created_at ON public.ocorrencias (created_at DESC);
CREATE INDEX idx_ocorrencias_categoria  ON public.ocorrencias (categoria);
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

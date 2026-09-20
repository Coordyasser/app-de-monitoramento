-- =============================================================
-- Concept Plan | Migration 010 — Central de Registros
--
-- Muda a finalidade do produto: de registro de ocorrências para
-- consolidação dos registros de informação coletados em campo.
--
-- Campos do registro: Nome, Contato, Título, Zona, Seção, Cidade,
-- Vínculo e Observações.
--
-- Nada é removido: as tabelas de ocorrências continuam intactas.
-- =============================================================


-- ---------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------

-- Normaliza texto para agrupamento: minúsculas, sem acento,
-- espaços colapsados. Usado nas agregações do dashboard, já que
-- `vinculo` é campo de texto livre e sofre variação de grafia.
CREATE OR REPLACE FUNCTION public.txt_norm(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT btrim(regexp_replace(
           translate(
             lower(t),
             'áàâãäéèêëíìîïóòôõöúùûüçñ',
             'aaaaaeeeeiiiiooooouuuucn'
           ),
           '\s+', ' ', 'g'
         ))
$$;

-- Mantém `updated_at` coerente em qualquer UPDATE
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------
-- 2. Tabela registros
-- ---------------------------------------------------------------

CREATE TABLE public.registros (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Autoria: quem consolidou o registro
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Identificação da pessoa registrada
  nome        text        NOT NULL CHECK (char_length(btrim(nome))    BETWEEN 3 AND 120),
  contato     text        NOT NULL CHECK (char_length(btrim(contato)) BETWEEN 8 AND 60),
  titulo      text        NOT NULL CHECK (char_length(btrim(titulo))  BETWEEN 3 AND 120),
  vinculo     text        NOT NULL CHECK (char_length(btrim(vinculo)) BETWEEN 2 AND 80),

  -- Localização (texto é a fonte de verdade do registro)
  cidade      text        NOT NULL CHECK (char_length(btrim(cidade))  BETWEEN 2 AND 80),
  zona        text        NOT NULL CHECK (char_length(btrim(zona))    BETWEEN 1 AND 20),
  secao       text        NOT NULL CHECK (char_length(btrim(secao))   BETWEEN 1 AND 20),

  -- Vínculo opcional com a base oficial do TRE-PI. Preenchido quando
  -- a localização foi escolhida na cascata; NULL quando digitada à mão.
  secao_id    uuid        REFERENCES public.secoes_eleitorais_pi(id) ON DELETE SET NULL,

  observacoes text        CHECK (observacoes IS NULL OR char_length(observacoes) <= 2000),

  -- Só dígitos do contato — usado para detectar duplicidade
  contato_digits text GENERATED ALWAYS AS (regexp_replace(contato, '\D', '', 'g')) STORED,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_registros_updated_at
  BEFORE UPDATE ON public.registros
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE  public.registros            IS 'Central de registros consolidados em campo';
COMMENT ON COLUMN public.registros.secao_id   IS 'NULL quando a localização foi digitada manualmente';
COMMENT ON COLUMN public.registros.contato_digits IS 'Coluna gerada: apenas os dígitos de contato, para checagem de duplicidade';


-- ---------------------------------------------------------------
-- 3. Índices
-- ---------------------------------------------------------------

CREATE INDEX idx_registros_created_at     ON public.registros (created_at DESC);
CREATE INDEX idx_registros_created_by     ON public.registros (created_by);
CREATE INDEX idx_registros_cidade         ON public.registros (cidade);
CREATE INDEX idx_registros_cidade_zona    ON public.registros (cidade, zona);
CREATE INDEX idx_registros_secao_id       ON public.registros (secao_id);
CREATE INDEX idx_registros_contato_digits ON public.registros (contato_digits)
  WHERE contato_digits <> '';
CREATE INDEX idx_registros_nome_lower     ON public.registros (lower(nome));


-- ---------------------------------------------------------------
-- 4. RLS
--    Agente enxerga e edita apenas os próprios registros.
--    Admin enxerga e edita tudo. Anônimo não tem acesso algum —
--    o registro guarda dado pessoal de terceiros (LGPD).
-- ---------------------------------------------------------------

ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registros_insert_own"
  ON public.registros FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "registros_select_own"
  ON public.registros FOR SELECT
  USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "registros_select_admin"
  ON public.registros FOR SELECT
  USING (public.is_admin());

CREATE POLICY "registros_update_own"
  ON public.registros FOR UPDATE
  USING  (auth.uid() IS NOT NULL AND created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "registros_update_admin"
  ON public.registros FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "registros_delete_admin"
  ON public.registros FOR DELETE
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros TO authenticated;


-- ---------------------------------------------------------------
-- 5. View detalhada
--    security_invoker: a view respeita o RLS de quem consulta.
--    Sem isso a view roda como dona (postgres) e vaza todas as
--    linhas para qualquer usuário autenticado.
-- ---------------------------------------------------------------

CREATE OR REPLACE VIEW public.vw_registros_detalhados
WITH (security_invoker = on) AS
SELECT
  r.id,
  r.nome,
  r.contato,
  r.titulo,
  r.vinculo,
  r.cidade,
  r.zona,
  r.secao,
  r.observacoes,
  r.secao_id,
  r.created_by,
  r.created_at,
  r.updated_at,
  p.full_name         AS agente_nome,
  s.local_votacao     AS local_votacao,
  (r.secao_id IS NOT NULL) AS localizacao_validada
FROM public.registros r
LEFT JOIN public.profiles p              ON p.id = r.created_by
LEFT JOIN public.secoes_eleitorais_pi s  ON s.id = r.secao_id;

GRANT SELECT ON public.vw_registros_detalhados TO authenticated;

-- Correção da view legada: sem security_invoker ela expunha todas as
-- ocorrências (inclusive nome e telefone do agente) a qualquer
-- usuário autenticado, contornando o RLS da tabela.
ALTER VIEW public.vw_ocorrencias_detalhadas SET (security_invoker = on);


-- ---------------------------------------------------------------
-- 6. RPCs do dashboard
--
--    Todas SECURITY DEFINER com escopo explícito:
--      admin  → todos os registros
--      agente → apenas os próprios
--      anon   → conjunto vazio (auth.uid() é NULL)
--
--    Datas são calculadas no fuso do Piauí (America/Fortaleza),
--    não em UTC, para que "hoje" bata com o dia do agente.
-- ---------------------------------------------------------------

-- ── Métricas de topo ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_registros_metrics()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_hoje  date    := (now() AT TIME ZONE 'America/Fortaleza')::date;
  v_admin boolean := public.is_admin();
  v_uid   uuid    := auth.uid();
  result  json;
BEGIN
  WITH escopo AS (
    SELECT
      r.*,
      (r.created_at AT TIME ZONE 'America/Fortaleza')::date AS dia
    FROM public.registros r
    WHERE v_admin OR (v_uid IS NOT NULL AND r.created_by = v_uid)
  ),
  dup AS (
    SELECT contato_digits
    FROM   escopo
    WHERE  contato_digits <> ''
    GROUP  BY contato_digits
    HAVING COUNT(*) > 1
  )
  SELECT json_build_object(
    'total',               COUNT(*),
    'hoje',                COUNT(*) FILTER (WHERE dia = v_hoje),
    'ontem',               COUNT(*) FILTER (WHERE dia = v_hoje - 1),
    'semana',              COUNT(*) FILTER (WHERE dia >  v_hoje - 7),
    'semana_anterior',     COUNT(*) FILTER (WHERE dia <= v_hoje - 7 AND dia > v_hoje - 14),
    'cidades',             COUNT(DISTINCT cidade),
    'zonas',               COUNT(DISTINCT (cidade || '|' || zona)),
    'secoes',              COUNT(DISTINCT (cidade || '|' || zona || '|' || secao)),
    'colaboradores',       COUNT(DISTINCT created_by) FILTER (WHERE created_by IS NOT NULL),
    'validados',           COUNT(*) FILTER (WHERE secao_id IS NOT NULL),
    'contatos_duplicados', (SELECT COUNT(*) FROM dup)
  )
  INTO result
  FROM escopo;

  RETURN result;
END;
$fn$;

-- ── Série diária (últimos N dias, sem buracos) ───────────────
CREATE OR REPLACE FUNCTION public.get_registros_por_dia(p_dias int DEFAULT 30)
RETURNS TABLE(dia date, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  WITH limites AS (
    SELECT (now() AT TIME ZONE 'America/Fortaleza')::date AS hoje
  ),
  dias AS (
    SELECT generate_series(
             hoje - (GREATEST(p_dias, 1) - 1),
             hoje,
             interval '1 day'
           )::date AS dia
    FROM limites
  ),
  contagem AS (
    SELECT (r.created_at AT TIME ZONE 'America/Fortaleza')::date AS d,
           COUNT(*) AS total
    FROM   public.registros r
    WHERE  public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid())
    GROUP  BY 1
  )
  SELECT d.dia, COALESCE(c.total, 0) AS total
  FROM   dias d
  LEFT   JOIN contagem c ON c.d = d.dia
  ORDER  BY d.dia;
$fn$;

-- ── Distribuição por vínculo (texto livre, agrupado normalizado) ──
CREATE OR REPLACE FUNCTION public.get_registros_por_vinculo(p_limit int DEFAULT 12)
RETURNS TABLE(vinculo text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    -- rótulo = grafia mais recente dentro do grupo normalizado
    (array_agg(r.vinculo ORDER BY r.created_at DESC))[1] AS vinculo,
    COUNT(*) AS total
  FROM   public.registros r
  WHERE  public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid())
  GROUP  BY public.txt_norm(r.vinculo)
  ORDER  BY COUNT(*) DESC
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Top cidades ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_registros_por_cidade(p_limit int DEFAULT 10)
RETURNS TABLE(cidade text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT r.cidade, COUNT(*) AS total
  FROM   public.registros r
  WHERE  public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid())
  GROUP  BY r.cidade
  ORDER  BY COUNT(*) DESC, r.cidade
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Cobertura por zona ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_registros_por_zona(p_limit int DEFAULT 10)
RETURNS TABLE(cidade text, zona text, secoes bigint, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT r.cidade, r.zona, COUNT(DISTINCT r.secao) AS secoes, COUNT(*) AS total
  FROM   public.registros r
  WHERE  public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid())
  GROUP  BY r.cidade, r.zona
  ORDER  BY COUNT(*) DESC, r.cidade, r.zona
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Ranking de quem registrou (admin enxerga a equipe) ────────
CREATE OR REPLACE FUNCTION public.get_registros_por_colaborador(p_limit int DEFAULT 10)
RETURNS TABLE(colaborador text, total bigint, ultimo timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    COALESCE(p.full_name, 'Não identificado') AS colaborador,
    COUNT(*)          AS total,
    MAX(r.created_at) AS ultimo
  FROM   public.registros r
  LEFT   JOIN public.profiles p ON p.id = r.created_by
  WHERE  public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid())
  GROUP  BY 1
  ORDER  BY COUNT(*) DESC
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Contatos repetidos (qualidade da consolidação) ───────────
CREATE OR REPLACE FUNCTION public.get_registros_duplicados(p_limit int DEFAULT 20)
RETURNS TABLE(contato text, repeticoes bigint, nomes text[], ultimo timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    (array_agg(r.contato ORDER BY r.created_at DESC))[1] AS contato,
    COUNT(*)                                             AS repeticoes,
    array_agg(DISTINCT r.nome)                           AS nomes,
    MAX(r.created_at)                                    AS ultimo
  FROM   public.registros r
  WHERE  (public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid()))
    AND  r.contato_digits <> ''
  GROUP  BY r.contato_digits
  HAVING COUNT(*) > 1
  ORDER  BY COUNT(*) DESC, MAX(r.created_at) DESC
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Vínculos já usados (autocomplete do formulário) ──────────
--    Lista global de rótulos para a equipe convergir na mesma
--    grafia. São rótulos, não dados pessoais.
CREATE OR REPLACE FUNCTION public.get_vinculos_sugeridos(p_limit int DEFAULT 30)
RETURNS TABLE(vinculo text, usos bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    (array_agg(r.vinculo ORDER BY r.created_at DESC))[1] AS vinculo,
    COUNT(*) AS usos
  FROM   public.registros r
  WHERE  auth.uid() IS NOT NULL
  GROUP  BY public.txt_norm(r.vinculo)
  ORDER  BY COUNT(*) DESC
  LIMIT  GREATEST(p_limit, 1);
$fn$;


-- ---------------------------------------------------------------
-- 7. Cascata Cidade → Zona → Seção
--    A cascata existente exige o local de votação como nível
--    intermediário. O formulário de registro não usa esse nível,
--    então estas duas RPCs saltam direto de zona para seção.
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_secoes_cidade_zona_pi(
  p_municipio text,
  p_zona      text
)
RETURNS TABLE(secao text)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT t.secao
  FROM (
    SELECT DISTINCT s.secao
    FROM   public.secoes_eleitorais_pi s
    WHERE  s.municipio = p_municipio
      AND  s.zona      = p_zona
  ) t
  ORDER BY
    CASE WHEN t.secao ~ '^[0-9]+$' THEN t.secao::integer ELSE 0 END,
    t.secao;
$fn$;

CREATE OR REPLACE FUNCTION public.get_secao_id_cidade_zona_pi(
  p_municipio text,
  p_zona      text,
  p_secao     text
)
RETURNS TABLE(id uuid, local_votacao text)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT s.id, s.local_votacao
  FROM   public.secoes_eleitorais_pi s
  WHERE  s.municipio = p_municipio
    AND  s.zona      = p_zona
    AND  s.secao     = p_secao
  ORDER  BY s.local_votacao
  LIMIT  1;
$fn$;


-- ---------------------------------------------------------------
-- 8. Permissões das RPCs
--    Concedidas a `authenticated`: o escopo interno já zera o
--    resultado para anon, mas não há motivo para expor a função.
-- ---------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.get_registros_metrics()                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_dia(int)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_vinculo(int)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_cidade(int)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_zona(int)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_colaborador(int)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_duplicados(int)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vinculos_sugeridos(int)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_secoes_cidade_zona_pi(text, text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_secao_id_cidade_zona_pi(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.txt_norm(text)                                TO anon, authenticated;


-- ---------------------------------------------------------------
-- 9. Realtime
-- ---------------------------------------------------------------

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.registros;
EXCEPTION
  -- Passo opcional: a tabela já publicada, a publicação inexistente ou o
  -- usuário da conexão sem posse dela não podem derrubar a migration.
  WHEN OTHERS THEN
    RAISE NOTICE 'Realtime não configurado para public.registros: %', SQLERRM;
END;
$do$;

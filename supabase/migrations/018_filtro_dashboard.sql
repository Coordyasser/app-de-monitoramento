-- =============================================================
-- Concept Plan | Migration 018 — Filtro de data e Est no dashboard
--
-- A exportação do dashboard em PDF pede um recorte por período de
-- cadastro e por Est. Os números do dashboard saem todos destas RPCs,
-- então o filtro tem que entrar nelas: filtrar no navegador exigiria
-- baixar a base e refazer cada agregação em TypeScript, com duas
-- versões da mesma regra para divergir.
--
-- Cada RPC ganha três parâmetros opcionais, todos DEFAULT NULL:
--   p_de, p_ate  dia de cadastro, no fuso do Piauí, limites inclusos
--   p_est        'Ana', 'Gil' ou 'SEM' (Est em branco, como no filtro da lista)
-- Sem eles, o resultado é idêntico ao de antes — o app publicado, que
-- não os envia, segue funcionando.
--
-- A assinatura muda, então é DROP + CREATE: com as duas versões
-- convivendo, o PostgREST não sabe qual escolher numa chamada que só
-- manda p_limit. Os corpos são os que estavam em produção, alterados
-- só no filtro (e, em get_registros_por_dia, na janela de datas).
-- =============================================================

BEGIN;

-- ── Condição compartilhada ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registro_no_filtro(
  p_criado timestamptz, p_est_registro text,
  p_de date, p_ate date, p_est text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT (p_de  IS NULL OR (p_criado AT TIME ZONE 'America/Fortaleza')::date >= p_de)
     AND (p_ate IS NULL OR (p_criado AT TIME ZONE 'America/Fortaleza')::date <= p_ate)
     AND (p_est IS NULL
          OR (p_est = 'SEM' AND p_est_registro IS NULL)
          OR p_est_registro = p_est);
$fn$;

DROP FUNCTION IF EXISTS public.get_registros_metrics();
DROP FUNCTION IF EXISTS public.get_registros_por_dia(int);
DROP FUNCTION IF EXISTS public.get_registros_por_vinculo(int);
DROP FUNCTION IF EXISTS public.get_registros_por_zona(int);
DROP FUNCTION IF EXISTS public.get_registros_duplicados(int);
DROP FUNCTION IF EXISTS public.get_registros_por_bairro(text, int);
DROP FUNCTION IF EXISTS public.get_registros_por_municipio(int, text);
DROP FUNCTION IF EXISTS public.get_cobertura_geografica(text);
DROP FUNCTION IF EXISTS public.get_cobertura_bairro(text);

-- ── Métricas de topo ─────────────────────────────────────────
CREATE FUNCTION public.get_registros_metrics(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_est text DEFAULT NULL
)
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
    WHERE (v_admin OR (v_uid IS NOT NULL AND r.created_by = v_uid))
      AND public.registro_no_filtro(r.created_at, r.est, p_de, p_ate, p_est)
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

-- ── Série diária, sem buracos ─────────────────────────────────
-- Sem datas: os últimos p_dias até hoje, como antes. Com datas, a
-- janela é o próprio intervalo; só uma das pontas completa a outra
-- com p_dias (ou com hoje, no fim).
CREATE FUNCTION public.get_registros_por_dia(
  p_dias int DEFAULT 30,
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_est text DEFAULT NULL
)
RETURNS TABLE(dia date, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  WITH limites AS (
    SELECT COALESCE(p_ate, (now() AT TIME ZONE 'America/Fortaleza')::date) AS fim
  ),
  dias AS (
    SELECT generate_series(
             COALESCE(p_de, fim - (GREATEST(p_dias, 1) - 1)),
             fim,
             interval '1 day'
           )::date AS dia
    FROM limites
  ),
  contagem AS (
    SELECT (r.created_at AT TIME ZONE 'America/Fortaleza')::date AS d,
           COUNT(*) AS total
    FROM   public.registros r
    WHERE  (public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid()))
      AND  public.registro_no_filtro(r.created_at, r.est, p_de, p_ate, p_est)
    GROUP  BY 1
  )
  SELECT d.dia, COALESCE(c.total, 0) AS total
  FROM   dias d
  LEFT   JOIN contagem c ON c.d = d.dia
  ORDER  BY d.dia;
$fn$;

-- ── Distribuição por vínculo ─────────────────────────────────
CREATE FUNCTION public.get_registros_por_vinculo(
  p_limit int DEFAULT 12,
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_est text DEFAULT NULL
)
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
  WHERE  (public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid()))
    AND  public.registro_no_filtro(r.created_at, r.est, p_de, p_ate, p_est)
  GROUP  BY public.txt_norm(r.vinculo)
  ORDER  BY COUNT(*) DESC
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Cobertura por zona ────────────────────────────────────────
CREATE FUNCTION public.get_registros_por_zona(
  p_limit int DEFAULT 10,
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_est text DEFAULT NULL
)
RETURNS TABLE(cidade text, zona text, secoes bigint, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT r.cidade, r.zona, COUNT(DISTINCT r.secao) AS secoes, COUNT(*) AS total
  FROM   public.registros r
  WHERE  (public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid()))
    AND  public.registro_no_filtro(r.created_at, r.est, p_de, p_ate, p_est)
  GROUP  BY r.cidade, r.zona
  ORDER  BY COUNT(*) DESC, r.cidade, r.zona
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Contatos repetidos ───────────────────────────────────────
CREATE FUNCTION public.get_registros_duplicados(
  p_limit int DEFAULT 20,
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_est text DEFAULT NULL
)
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
    AND  public.registro_no_filtro(r.created_at, r.est, p_de, p_ate, p_est)
    AND  r.contato_digits <> ''
  GROUP  BY r.contato_digits
  HAVING COUNT(*) > 1
  ORDER  BY COUNT(*) DESC, MAX(r.created_at) DESC
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Bairros de um município ──────────────────────────────────
CREATE FUNCTION public.get_registros_por_bairro(
  p_municipio text, p_limit int DEFAULT 20,
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_est text DEFAULT NULL
)
RETURNS TABLE(bairro text, total bigint, secoes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    COALESCE(NULLIF(btrim(s.bairro), ''), 'Não informado') AS bairro,
    COUNT(*)                                               AS total,
    COUNT(DISTINCT s.secao)                                AS secoes
  FROM   public.registros r
  JOIN   public.secoes_eleitorais_pi s ON s.id = r.secao_id
  WHERE  (public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid()))
    AND  public.registro_no_filtro(r.created_at, r.est, p_de, p_ate, p_est)
    AND  public.txt_norm(s.municipio) = public.txt_norm(p_municipio)
  GROUP  BY 1
  ORDER  BY COUNT(*) DESC, 1
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Ranking de municípios ────────────────────────────────────
CREATE FUNCTION public.get_registros_por_municipio(
  p_limit int DEFAULT 30, p_excluir text DEFAULT NULL,
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_est text DEFAULT NULL
)
RETURNS TABLE(municipio text, total bigint, secoes bigint, validados bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    r.cidade                                           AS municipio,
    COUNT(*)                                           AS total,
    COUNT(DISTINCT r.zona || '|' || r.secao)           AS secoes,
    COUNT(*) FILTER (WHERE r.secao_id IS NOT NULL)     AS validados
  FROM   public.registros r
  WHERE  (public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid()))
    AND  public.registro_no_filtro(r.created_at, r.est, p_de, p_ate, p_est)
    AND  public.txt_norm(r.cidade) <> 'nao consta'
    AND  (p_excluir IS NULL OR public.txt_norm(r.cidade) <> public.txt_norm(p_excluir))
  GROUP  BY r.cidade
  ORDER  BY COUNT(*) DESC, r.cidade
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Cobertura geográfica ─────────────────────────────────────
CREATE FUNCTION public.get_cobertura_geografica(
  p_capital text DEFAULT 'TERESINA',
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_est text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  WITH escopo AS (
    SELECT r.*,
           public.txt_norm(r.cidade) AS cidade_norm,
           public.txt_norm(r.zona)   AS zona_norm
    FROM   public.registros r
    WHERE  (public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid()))
      AND  public.registro_no_filtro(r.created_at, r.est, p_de, p_ate, p_est)
  )
  SELECT json_build_object(
    'total',            COUNT(*),
    'sem_localizacao',  COUNT(*) FILTER (WHERE cidade_norm = 'nao consta'),
    -- Nunca teve zona nem seção
    'sem_zona_secao',   COUNT(*) FILTER (WHERE cidade_norm = 'nao consta'
                                           AND zona_norm   = 'nao consta'),
    -- Tem zona e seção, mas o par não bateu com a base oficial
    'secao_sem_base',   COUNT(*) FILTER (WHERE cidade_norm = 'nao consta'
                                           AND zona_norm  <> 'nao consta'),
    'capital',          COUNT(*) FILTER (WHERE cidade_norm = public.txt_norm(p_capital)),
    'interior',         COUNT(*) FILTER (WHERE cidade_norm <> 'nao consta'
                                           AND cidade_norm <> public.txt_norm(p_capital)),
    'municipios',       COUNT(DISTINCT cidade) FILTER (WHERE cidade_norm <> 'nao consta'),
    'municipios_interior', COUNT(DISTINCT cidade) FILTER (WHERE cidade_norm <> 'nao consta'
                                           AND cidade_norm <> public.txt_norm(p_capital))
  )
  FROM escopo;
$fn$;

-- ── Cobertura de bairro na capital ───────────────────────────
CREATE FUNCTION public.get_cobertura_bairro(
  p_municipio text,
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_est text DEFAULT NULL
)
RETURNS TABLE(total bigint, com_bairro bigint, bairros bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    COUNT(*)                                                       AS total,
    COUNT(*) FILTER (WHERE s.bairro IS NOT NULL AND btrim(s.bairro) <> '') AS com_bairro,
    COUNT(DISTINCT NULLIF(btrim(s.bairro), ''))                    AS bairros
  FROM   public.registros r
  LEFT   JOIN public.secoes_eleitorais_pi s ON s.id = r.secao_id
  WHERE  (public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid()))
    AND  public.registro_no_filtro(r.created_at, r.est, p_de, p_ate, p_est)
    AND  public.txt_norm(r.cidade) = public.txt_norm(p_municipio);
$fn$;

-- ── Permissões ───────────────────────────────────────────────
-- As mesmas de antes: as cinco da migration 010 fechadas para anon
-- (migration 011); as três da 013 com o padrão do Supabase.
REVOKE ALL ON FUNCTION public.get_registros_metrics(date, date, text)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_registros_por_dia(int, date, date, text)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_registros_por_vinculo(int, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_registros_por_zona(int, date, date, text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_registros_duplicados(int, date, date, text)  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_registros_metrics(date, date, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_dia(int, date, date, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_vinculo(int, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_zona(int, date, date, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_duplicados(int, date, date, text)  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

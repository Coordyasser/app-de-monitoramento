-- =============================================================
-- Concept Plan | Migration 013 — Bairro e visões geográficas
--
-- O CSV de locais de votação do TRE-PI sempre trouxe a coluna
-- BAIRRO, preenchida em 100% das linhas, mas a importação nunca
-- a aproveitou. Sem ela não há granularidade dentro de Teresina:
-- o município tem 5 zonas para 1.928 seções, então "zona" não
-- diz nada sobre onde a pessoa mora. Bairro resolve — são 130
-- em Teresina.
--
-- O bairro é propriedade do LOCAL de votação, não da seção, e é
-- por isso que todas as seções de um mesmo local o compartilham.
-- =============================================================


-- ---------------------------------------------------------------
-- 1. Coluna
-- ---------------------------------------------------------------

ALTER TABLE public.secoes_eleitorais_pi
  ADD COLUMN IF NOT EXISTS bairro text;

COMMENT ON COLUMN public.secoes_eleitorais_pi.bairro IS
  'Bairro do local de votação, vindo da coluna BAIRRO do CSV do TRE-PI.';

-- Sustenta o agrupamento por bairro dentro de um município.
CREATE INDEX IF NOT EXISTS idx_secoes_municipio_bairro
  ON public.secoes_eleitorais_pi (municipio, bairro);


-- ---------------------------------------------------------------
-- 2. Bairro na view detalhada
--
--    Chega ao registro pelo secao_id. Fica NULL quando a
--    localização foi digitada à mão, sem vínculo com a base.
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
  (r.secao_id IS NOT NULL) AS localizacao_validada,
  r.origem_id,
  r.situacao,
  s.bairro            AS bairro
FROM public.registros r
LEFT JOIN public.profiles p              ON p.id = r.created_by
LEFT JOIN public.secoes_eleitorais_pi s  ON s.id = r.secao_id;

GRANT SELECT ON public.vw_registros_detalhados TO authenticated;


-- ---------------------------------------------------------------
-- 3. RPCs das visões geográficas
--
--    Mesmo escopo das demais: admin vê tudo, agente vê o que é
--    seu, anônimo não vê nada (auth.uid() é NULL).
-- ---------------------------------------------------------------

-- ── Registros por município, com qualidade do vínculo ─────────
--
--    "NÃO CONSTA" é a sentinela que a importação grava quando a
--    planilha não permite deduzir a cidade. Ela não é município e
--    ficaria em primeiro lugar na lista, então sai daqui e é
--    contada à parte, em get_cobertura_geografica().
CREATE OR REPLACE FUNCTION public.get_registros_por_municipio(
  p_limit    int  DEFAULT 30,
  p_excluir  text DEFAULT NULL
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
    AND  public.txt_norm(r.cidade) <> 'nao consta'
    AND  (p_excluir IS NULL OR public.txt_norm(r.cidade) <> public.txt_norm(p_excluir))
  GROUP  BY r.cidade
  ORDER  BY COUNT(*) DESC, r.cidade
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Resumo da cobertura geográfica ────────────────────────────
--    Dá o denominador de tudo que as visões mostram: quanto do
--    total está localizado, quanto é da capital e quanto sobra
--    sem cidade conhecida.
CREATE OR REPLACE FUNCTION public.get_cobertura_geografica(
  p_capital text DEFAULT 'TERESINA'
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  WITH escopo AS (
    SELECT r.*, public.txt_norm(r.cidade) AS cidade_norm
    FROM   public.registros r
    WHERE  public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid())
  )
  SELECT json_build_object(
    'total',            COUNT(*),
    'sem_localizacao',  COUNT(*) FILTER (WHERE cidade_norm = 'nao consta'),
    'capital',          COUNT(*) FILTER (WHERE cidade_norm = public.txt_norm(p_capital)),
    'interior',         COUNT(*) FILTER (WHERE cidade_norm <> 'nao consta'
                                           AND cidade_norm <> public.txt_norm(p_capital)),
    'municipios',       COUNT(DISTINCT cidade) FILTER (WHERE cidade_norm <> 'nao consta'),
    'municipios_interior', COUNT(DISTINCT cidade) FILTER (WHERE cidade_norm <> 'nao consta'
                                           AND cidade_norm <> public.txt_norm(p_capital))
  )
  FROM escopo;
$fn$;

-- ── Registros por bairro de um município ──────────────────────
--    Só enxerga quem tem secao_id: o bairro vem da base oficial,
--    e localização digitada à mão não alcança esse nível.
CREATE OR REPLACE FUNCTION public.get_registros_por_bairro(
  p_municipio text,
  p_limit     int DEFAULT 20
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
    AND  public.txt_norm(s.municipio) = public.txt_norm(p_municipio)
  GROUP  BY 1
  ORDER  BY COUNT(*) DESC, 1
  LIMIT  GREATEST(p_limit, 1);
$fn$;

-- ── Quantos registros um município tem fora do alcance do bairro ──
--    Dá o denominador honesto para a visão de bairro: sem isso a
--    soma das barras não bate com o total do município.
CREATE OR REPLACE FUNCTION public.get_cobertura_bairro(p_municipio text)
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
    AND  public.txt_norm(r.cidade) = public.txt_norm(p_municipio);
$fn$;


-- ---------------------------------------------------------------
-- 4. Permissões
-- ---------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.get_registros_por_municipio(int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_bairro(text, int)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cobertura_bairro(text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cobertura_geografica(text)         TO authenticated;

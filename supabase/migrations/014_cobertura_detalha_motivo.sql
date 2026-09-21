-- =============================================================
-- Concept Plan | Migration 014 — Por que um registro não entra
--                                nas visões geográficas
--
-- get_cobertura_geografica devolvia "sem_localizacao" como um
-- número só. Quem olha o gráfico vê 366 de 604 e não tem como
-- saber o que houve com a diferença.
--
-- São duas causas distintas, e a diferença importa porque uma é
-- corrigível e a outra não:
--
--   sem_zona_secao  a planilha traz NÃO CONSTA em ZONA e SEÇÃO.
--                   Dado que nunca foi coletado; não há caminho
--                   até o município.
--
--   secao_sem_base  zona e seção estão preenchidas, mas o par não
--                   existe em secoes_eleitorais_pi. É digitação
--                   errada ou seção remanejada pelo TSE depois da
--                   última carga — dá para consertar na planilha.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_cobertura_geografica(
  p_capital text DEFAULT 'TERESINA'
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
    WHERE  public.is_admin() OR (auth.uid() IS NOT NULL AND r.created_by = auth.uid())
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

GRANT EXECUTE ON FUNCTION public.get_cobertura_geografica(text) TO authenticated;

-- =============================================================
-- Concept Plan | Migration 016 — Campo Est
--
-- Coluna de domínio fechado: ou "Ana", ou "Gil", ou nada. Os
-- registros que já existem ficam em branco — a coluna nasce NULL
-- para todos, e quem for preenchendo decide um a um.
--
-- Em branco aqui é NULL, e não a sentinela "NÃO CONSTA" que os
-- campos de texto livre usam. A diferença é o domínio: nome, cidade
-- e título aceitam qualquer coisa, então precisam de um literal para
-- dizer "ninguém coletou"; `est` só aceita dois valores, e o CHECK
-- recusaria a sentinela. NULL já diz o que precisa ser dito.
-- =============================================================


-- ---------------------------------------------------------------
-- 1. Coluna
-- ---------------------------------------------------------------

ALTER TABLE public.registros
  ADD COLUMN IF NOT EXISTS est text
    CHECK (est IS NULL OR est IN ('Ana', 'Gil'));

COMMENT ON COLUMN public.registros.est IS
  'Est: Ana ou Gil. NULL enquanto não preenchido.';

-- Filtrar por Est varre pouco: o índice parcial deixa de fora as
-- linhas em branco, que hoje são todas e nunca são procuradas.
CREATE INDEX IF NOT EXISTS idx_registros_est
  ON public.registros (est)
  WHERE est IS NOT NULL;


-- ---------------------------------------------------------------
-- 2. View detalhada — a coluna nova entra no fim
--
--    CREATE OR REPLACE VIEW exige que as colunas já existentes
--    mantenham nome, tipo e ordem.
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
  s.bairro            AS bairro,
  r.est
FROM public.registros r
LEFT JOIN public.profiles p              ON p.id = r.created_by
LEFT JOIN public.secoes_eleitorais_pi s  ON s.id = r.secao_id;

GRANT SELECT ON public.vw_registros_detalhados TO authenticated;

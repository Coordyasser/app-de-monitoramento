-- =============================================================
-- Concept Plan | Migration 012 — Origem em planilha
--
-- A lista nominal é mantida em uma planilha na máquina do
-- coordenador e reenviada periodicamente. Para sincronizar sem
-- duplicar, cada linha carrega o ID da planilha (ID001, ID002…)
-- e passa a ser a chave de reconciliação.
--
-- Também traz `situacao`, a coluna de triagem da planilha
-- (OK / PENDENTE / CONFERIR), que não tinha equivalente aqui.
-- =============================================================


-- ---------------------------------------------------------------
-- 1. Colunas de origem
-- ---------------------------------------------------------------

ALTER TABLE public.registros
  ADD COLUMN IF NOT EXISTS origem_id text
    CHECK (origem_id IS NULL OR char_length(btrim(origem_id)) BETWEEN 1 AND 40),
  ADD COLUMN IF NOT EXISTS situacao  text
    CHECK (situacao IS NULL OR char_length(btrim(situacao)) BETWEEN 1 AND 40);

COMMENT ON COLUMN public.registros.origem_id IS
  'ID da linha na planilha de origem (ex.: ID001). NULL para registros criados no app.';
COMMENT ON COLUMN public.registros.situacao IS
  'Coluna SITUAÇÃO da planilha: OK, PENDENTE ou CONFERIR. NULL para registros criados no app.';


-- ---------------------------------------------------------------
-- 2. Unicidade do ID de origem
--
--    Índice parcial: só vale para linhas vindas de planilha.
--    Registros criados no app têm origem_id NULL e ficam de fora,
--    sem competir pela chave.
-- ---------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_origem_id
  ON public.registros (origem_id)
  WHERE origem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registros_situacao
  ON public.registros (situacao)
  WHERE situacao IS NOT NULL;


-- ---------------------------------------------------------------
-- 3. View detalhada — expõe as duas colunas novas
--
--    CREATE OR REPLACE exige que as colunas já existentes mantenham
--    nome, tipo e ordem; as novas entram no fim.
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
  r.situacao
FROM public.registros r
LEFT JOIN public.profiles p              ON p.id = r.created_by
LEFT JOIN public.secoes_eleitorais_pi s  ON s.id = r.secao_id;

GRANT SELECT ON public.vw_registros_detalhados TO authenticated;

-- =============================================================
-- Concept Plan | Migration 017 — Município pela zona, como plano B
--
-- `get_municipios_por_zona_secao` (migration 015) exige o par exato.
-- Quando ele não existe, hoje não sobra nada e a cidade é digitada à
-- mão — e são 18 registros assim.
--
-- A causa não é formatação nem defasagem do nosso cache: conferido
-- contra o CSV do TRE-PI, a zona 97 tem as mesmas 469 seções nos dois
-- lados, e a seção 322 não está em nenhum. O dataset lista seções por
-- local de votação, e a zona 97 tem 176 números ausentes entre 1 e
-- 645 — seção agregada ou extinta não ganha linha ali, embora
-- continue sendo a seção de alguém.
--
-- A zona, essa, continua existindo e continua amarrada aos mesmos
-- municípios. É uma informação mais grossa e não confirma a seção,
-- mas é melhor que campo vazio: nos 18 registros, resolve 5 sozinha
-- e reduz 11 a uma escolha entre dois ou quatro nomes.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_municipios_por_zona(p_zona text)
RETURNS TABLE(municipio text, secoes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT s.municipio, COUNT(DISTINCT s.secao) AS secoes
  FROM   public.secoes_eleitorais_pi s
  WHERE  public.num_norm(s.zona) = public.num_norm(p_zona)
  GROUP  BY s.municipio
  -- Maior primeiro: numa zona partilhada, o município com mais seções é
  -- o palpite mais provável, e fica no topo da lista de escolha.
  ORDER  BY COUNT(DISTINCT s.secao) DESC, s.municipio;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_municipios_por_zona(text) TO anon, authenticated;

-- O índice da 015 é sobre (num_norm(zona), num_norm(secao)); o Postgres
-- usa o prefixo dele para uma busca só por zona, então não há índice novo.

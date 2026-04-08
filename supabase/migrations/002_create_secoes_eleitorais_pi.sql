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

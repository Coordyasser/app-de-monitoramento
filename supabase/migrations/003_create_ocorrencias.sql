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

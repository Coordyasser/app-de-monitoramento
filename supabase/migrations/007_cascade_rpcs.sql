-- ============================================================
-- EleitoWatch | Migration 007 — RPCs para cascata de seções
-- Retornam valores DISTINCT em cada nível sem varrer a tabela
-- inteira pelo cliente (evita limite de 1000 linhas do PostgREST)
-- ============================================================

-- ── Nível 1: Municípios disponíveis ──────────────────────────
CREATE OR REPLACE FUNCTION get_municipios_pi()
RETURNS TABLE(municipio text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT DISTINCT municipio
  FROM   secoes_eleitorais_pi
  ORDER  BY municipio;
$$;

-- ── Nível 2: Zonas de um município ───────────────────────────
CREATE OR REPLACE FUNCTION get_zonas_pi(p_municipio text)
RETURNS TABLE(zona text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT DISTINCT zona
  FROM   secoes_eleitorais_pi
  WHERE  municipio = p_municipio
  ORDER  BY zona;
$$;

-- ── Nível 3: Locais de votação (município + zona) ─────────────
CREATE OR REPLACE FUNCTION get_locais_pi(p_municipio text, p_zona text)
RETURNS TABLE(local_votacao text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT DISTINCT local_votacao
  FROM   secoes_eleitorais_pi
  WHERE  municipio     = p_municipio
    AND  zona          = p_zona
  ORDER  BY local_votacao;
$$;

-- ── Nível 4: Seções (município + zona + local) ────────────────
CREATE OR REPLACE FUNCTION get_secoes_pi(
  p_municipio     text,
  p_zona          text,
  p_local_votacao text
)
RETURNS TABLE(secao text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT secao
  FROM (
    SELECT DISTINCT secao
    FROM   secoes_eleitorais_pi
    WHERE  municipio     = p_municipio
      AND  zona          = p_zona
      AND  local_votacao = p_local_votacao
  ) s
  ORDER BY
    CASE WHEN secao ~ '^[0-9]+$' THEN secao::integer ELSE 0 END,
    secao;
$$;

-- ── Nível 5: ID da seção (resolução do secao_id) ─────────────
CREATE OR REPLACE FUNCTION get_secao_id_pi(
  p_municipio     text,
  p_zona          text,
  p_local_votacao text,
  p_secao         text
)
RETURNS TABLE(id uuid, urna text)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id, urna
  FROM   secoes_eleitorais_pi
  WHERE  municipio     = p_municipio
    AND  zona          = p_zona
    AND  local_votacao = p_local_votacao
    AND  secao         = p_secao
  LIMIT  1;
$$;

-- ── Permissões ────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_municipios_pi()                      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_zonas_pi(text)                       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_locais_pi(text, text)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_secoes_pi(text, text, text)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_secao_id_pi(text, text, text, text)  TO anon, authenticated;

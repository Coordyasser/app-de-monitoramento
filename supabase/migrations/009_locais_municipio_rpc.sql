-- =============================================================
-- EleitoWatch | Migration 009 — RPC de locais por município
-- Retorna todos os locais de votação de um município (sem zona).
-- Usado no filtro de ocorrências do painel admin.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_locais_municipio_pi(p_municipio text)
RETURNS TABLE(local_votacao text)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT local_votacao
  FROM   public.secoes_eleitorais_pi
  WHERE  municipio = p_municipio
  ORDER  BY local_votacao;
$$;

GRANT EXECUTE ON FUNCTION public.get_locais_municipio_pi(text) TO anon, authenticated;

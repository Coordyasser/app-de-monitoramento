-- =============================================================
-- Concept Plan | Migration 011 — Fecha as RPCs do dashboard
--
-- O PostgreSQL concede EXECUTE a PUBLIC em toda função nova, então
-- o GRANT ... TO authenticated da migration 010 não restringiu nada:
-- o papel anon também consegue chamar as RPCs do dashboard.
--
-- Hoje isso não expõe dado nenhum — o escopo interno de cada função
-- (is_admin() OR created_by = auth.uid()) devolve conjunto vazio para
-- quem não está autenticado. Isto aqui é defesa em profundidade: faz
-- a permissão real bater com a intenção declarada na 010, para que
-- uma função futura não nasça aberta por descuido.
-- =============================================================

REVOKE EXECUTE ON FUNCTION public.get_registros_metrics()            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_registros_por_dia(int)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_registros_por_vinculo(int)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_registros_por_cidade(int)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_registros_por_zona(int)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_registros_por_colaborador(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_registros_duplicados(int)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_vinculos_sugeridos(int)        FROM PUBLIC, anon;

-- Reafirma o acesso de quem deve ter
GRANT EXECUTE ON FUNCTION public.get_registros_metrics()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_dia(int)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_vinculo(int)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_cidade(int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_zona(int)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_por_colaborador(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_duplicados(int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vinculos_sugeridos(int)        TO authenticated;

-- A cascata Cidade → Zona → Seção segue aberta a anon, igual às RPCs
-- equivalentes da migration 007: são dados públicos do TRE-PI.

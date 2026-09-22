-- =============================================================
-- Concept Plan | Migration 015 — Vínculos como cadastro
--                                Município deduzido da seção
--
-- Duas mudanças que tiram trabalho do agente em campo.
--
-- 1. `vinculo` era texto livre. Toda variação de grafia virava um
--    vínculo novo nos gráficos ("Liderança", "lideranca", "LIDERANÇA"),
--    e não havia como renomear um vínculo sem reescrever registro a
--    registro. Agora existe um cadastro, o campo do formulário só
--    escolhe dele, e renomear alcança todos os registros de uma vez.
--
--    A coluna `registros.vinculo` continua sendo texto, e não um FK:
--    a sincronização da planilha grava o nome que vem de lá, e uma
--    chave estrangeira recusaria a carga inteira por causa de um
--    vínculo novo. O cadastro absorve esses nomes em vez de barrá-los.
--
-- 2. A cascata pedia o município primeiro, mas quem está em campo lê
--    a zona e a seção no comprovante — o município é consequência.
--    `get_municipios_por_zona_secao` faz o caminho inverso, o mesmo
--    que a sincronização da planilha já fazia em memória.
-- =============================================================


-- ---------------------------------------------------------------
-- 1. Normalização de número de zona e seção
--
--    A planilha traz "0185", a base do TRE traz "185", e o agente
--    digita um ou outro. Comparar sem os zeros à esquerda é o que a
--    sincronização já faz em JS (`semZeros`).
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.num_norm(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT NULLIF(regexp_replace(btrim(t), '^0+', ''), '')
$$;

GRANT EXECUTE ON FUNCTION public.num_norm(text) TO anon, authenticated;

-- Sem este índice a dedução do município vira varredura da base
-- inteira do TRE-PI a cada tecla digitada no formulário.
CREATE INDEX IF NOT EXISTS idx_secoes_zona_secao_norm
  ON public.secoes_eleitorais_pi (public.num_norm(zona), public.num_norm(secao));


-- ---------------------------------------------------------------
-- 2. Cadastro de vínculos
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vinculos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text        NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 2 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unicidade pela forma normalizada: "Liderança" e "lideranca" são o
-- mesmo vínculo, e é justamente essa duplicação que o cadastro corrige.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculos_nome_norm
  ON public.vinculos (public.txt_norm(nome));

-- CREATE TRIGGER não tem IF NOT EXISTS: sem o DROP a migration só
-- roda uma vez, e ela precisa ser repetível.
DROP TRIGGER IF EXISTS trg_vinculos_updated_at ON public.vinculos;
CREATE TRIGGER trg_vinculos_updated_at
  BEFORE UPDATE ON public.vinculos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.vinculos IS
  'Cadastro dos vínculos que o formulário de registro oferece. registros.vinculo guarda o nome, não o id.';


-- ---------------------------------------------------------------
-- 3. Carga inicial a partir dos registros existentes
--
--    Mesmo critério de get_vinculos_sugeridos: agrupa pela forma
--    normalizada e adota a grafia mais recente do grupo. A sentinela
--    fica de fora — "NÃO CONSTA" é ausência de vínculo, não um vínculo.
-- ---------------------------------------------------------------

INSERT INTO public.vinculos (nome)
SELECT (array_agg(r.vinculo ORDER BY r.created_at DESC))[1]
FROM   public.registros r
WHERE  public.txt_norm(r.vinculo) <> 'nao consta'
  AND  char_length(btrim(r.vinculo)) BETWEEN 2 AND 80
GROUP  BY public.txt_norm(r.vinculo)
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------
-- 4. RLS
--    Todo autenticado lê — é o que alimenta o campo do formulário.
--    Só admin escreve: renomear um vínculo reescreve registros da
--    equipe inteira, que o agente não enxerga nem pode editar.
-- ---------------------------------------------------------------

ALTER TABLE public.vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vinculos_select_autenticado" ON public.vinculos;
CREATE POLICY "vinculos_select_autenticado"
  ON public.vinculos FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "vinculos_insert_admin" ON public.vinculos;
CREATE POLICY "vinculos_insert_admin"
  ON public.vinculos FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "vinculos_update_admin" ON public.vinculos;
CREATE POLICY "vinculos_update_admin"
  ON public.vinculos FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "vinculos_delete_admin" ON public.vinculos;
CREATE POLICY "vinculos_delete_admin"
  ON public.vinculos FOR DELETE
  USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vinculos TO authenticated;


-- ---------------------------------------------------------------
-- 5. Lista com uso
--    O total ao lado do nome é o que deixa visível o tamanho de uma
--    renomeação antes de confirmá-la.
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_vinculos_cadastrados()
RETURNS TABLE(id uuid, nome text, registros bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    v.id,
    v.nome,
    (SELECT COUNT(*)
     FROM   public.registros r
     WHERE  public.txt_norm(r.vinculo) = public.txt_norm(v.nome)) AS registros
  FROM   public.vinculos v
  WHERE  auth.uid() IS NOT NULL
  ORDER  BY v.nome;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_vinculos_cadastrados() TO authenticated;


-- ---------------------------------------------------------------
-- 6. Renomear
--
--    Cadastro e registros mudam na mesma transação: a função inteira
--    roda numa, então ou os dois andam ou nenhum anda. Fosse pelo
--    cliente, seriam duas requisições e uma delas poderia falhar
--    sozinha, deixando registros apontando para um nome que não
--    existe mais no cadastro.
--
--    SECURITY DEFINER para alcançar registros de qualquer agente,
--    com a checagem de admin explícita logo na entrada.
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.renomear_vinculo(p_id uuid, p_nome text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_antigo text;
  v_novo   text := btrim(p_nome);
  v_total  int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem renomear vínculos';
  END IF;

  IF char_length(v_novo) < 2 OR char_length(v_novo) > 80 THEN
    RAISE EXCEPTION 'O nome do vínculo precisa ter entre 2 e 80 caracteres';
  END IF;

  SELECT nome INTO v_antigo FROM public.vinculos WHERE id = p_id;
  IF v_antigo IS NULL THEN
    RAISE EXCEPTION 'Vínculo não encontrado';
  END IF;

  -- Colidir com outro vínculo seria fundir dois cadastros sem que
  -- ninguém tenha pedido isso. Recusa e deixa a decisão com quem edita.
  IF EXISTS (
    SELECT 1 FROM public.vinculos
    WHERE  id <> p_id AND public.txt_norm(nome) = public.txt_norm(v_novo)
  ) THEN
    RAISE EXCEPTION 'Já existe um vínculo com esse nome';
  END IF;

  UPDATE public.vinculos SET nome = v_novo WHERE id = p_id;

  UPDATE public.registros
  SET    vinculo = v_novo
  WHERE  public.txt_norm(vinculo) = public.txt_norm(v_antigo);
  GET DIAGNOSTICS v_total = ROW_COUNT;

  RETURN json_build_object('antigo', v_antigo, 'novo', v_novo, 'registros', v_total);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.renomear_vinculo(uuid, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.renomear_vinculo(uuid, text) TO authenticated;


-- ---------------------------------------------------------------
-- 7. Município a partir de zona + seção
--
--    Devolve um município por linha. Uma linha só significa dedução
--    inequívoca; mais de uma, que o par existe em vários municípios e
--    alguém precisa escolher; nenhuma, que o par não está na base —
--    e aí o município é digitado à mão.
--
--    O secao_id acompanha cada candidato pelo mesmo critério da
--    get_secao_id_cidade_zona_pi: o menor local_votacao.
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_municipios_por_zona_secao(
  p_zona  text,
  p_secao text
)
RETURNS TABLE(municipio text, secao_id uuid, local_votacao text)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT DISTINCT ON (s.municipio)
         s.municipio,
         s.id   AS secao_id,
         s.local_votacao
  FROM   public.secoes_eleitorais_pi s
  WHERE  public.num_norm(s.zona)  = public.num_norm(p_zona)
    AND  public.num_norm(s.secao) = public.num_norm(p_secao)
  ORDER  BY s.municipio, s.local_votacao;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_municipios_por_zona_secao(text, text) TO anon, authenticated;

# Sincronização da LISTA NOMINAL

A lista nominal é mantida em uma planilha na máquina do coordenador e reenviada
periodicamente. Este script reconcilia a planilha com a tabela `registros`.

## Como rodar

```bash
# confere o que mudaria, sem gravar — rode SEMPRE isto antes
node scripts/sincronizar-lista-nominal.mjs --arquivo "C:/Users/Pichau/Downloads/LISTA NOMINAL.xlsx" --dry-run

# aplica
node scripts/sincronizar-lista-nominal.mjs --arquivo "C:/Users/Pichau/Downloads/LISTA NOMINAL.xlsx"

# só insere quem é novo; quem já está no banco não é tocado
node scripts/sincronizar-lista-nominal.mjs --arquivo "C:/Users/Pichau/Downloads/LISTA NOMINAL.xlsx" --somente-novos
```

> **Hoje o modo certo é `--somente-novos`.** Correções passaram a ser feitas
> direto no sistema e não voltam para a planilha, então ela está divergente
> nos registros antigos. Sincronizar tudo desfaria essas correções (vínculo,
> situação, telefone…). Nesse modo, as divergências só aparecem como
> contagem, o `origem_id` de quem já existe não muda, e só o vínculo dos
> registros novos entra no cadastro. Um novo cujo título ou nome já exista no
> banco (linha repetida mais abaixo na planilha) não é inserido e vai para os
> avisos.

Aceita `.xlsx` e `.csv`. **Prefira `.xlsx`:** ele guarda o valor numérico em
precisão total, enquanto o CSV só carrega o texto que o Excel exibiu — se a
coluna estiver estreita na hora de exportar, um título vira `3,71E+10` e o dado
se perde sem recuperação. O CSV ainda traz separador `;` e codificação ANSI no
Excel em português, que quebram acentos.

Credenciais saem do `.env.local` (`VITE_SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY`). A chave de serviço ignora RLS, então isto roda só
localmente, nunca no navegador.

## A chave de reconciliação NÃO é a coluna ID

A coluna `ID` da planilha é um **contador de linha**: quando alguém apaga uma
linha, tudo abaixo é renumerado. Isso já aconteceu — três linhas removidas
deslocaram 533 pessoas em uma posição cada, e o `ID063` passou a apontar para
outra pessoa. Sincronizar por ele teria sobrescrito 533 cadastros com dados de
terceiros, em silêncio.

A reconciliação é pela identidade da pessoa, em três passadas:

1. **Título de eleitor** — identificador nacional único, acompanha a pessoa e
   não a linha. Cobre a grande maioria dos registros.
2. **Nome + vínculo** — para quem ainda não tem título.
3. **`origem_id`, e só quando o nome confirma** — rede de segurança para quem
   não tem título e teve o vínculo corrigido na planilha. Sem ela, a chave da
   passada 2 muda junto com o vínculo, a pessoa é inserida de novo e a linha
   antiga fica órfã: duas cópias da mesma pessoa. Já aconteceu.

> A condição do nome na passada 3 é o que a torna segura. Sem ela seria o
> mesmo que usar o `origem_id` como chave — exatamente o que deslocou 533
> pessoas quando a planilha renumerou. Quando a linha anda, o ID aponta para
> outra pessoa e o nome não bate, então o par é recusado.

Quem não tem título e teve nome **e** vínculo alterados ao mesmo tempo não
casa por nenhuma das três. É ambíguo de verdade, e o script reporta em vez de
adivinhar.

Título repetido por pessoas diferentes é desempatado pelo nome dentro do
próprio grupo, nunca procurando no resto da base.

O `origem_id` continua gravado, mas como **rastreio**, não como chave: ele é
reescrito a cada sincronização para refletir a linha atual da planilha.

| Situação | Ação |
|---|---|
| Pessoa nova na planilha | `INSERT` |
| Pessoa já no banco, com campo diferente | `UPDATE` só dos campos que mudaram |
| Pessoa já no banco, tudo igual | ignorada |
| Pessoa sumiu da planilha | **apenas reportada, nunca apagada** |

Quem some da planilha fica no banco com `origem_id` nulo. Se a remoção foi
proposital (deduplicação, por exemplo), apague manualmente — o script não
decide isso sozinho.

## Dado vazio nunca sobrescreve dado cheio

Se a planilha disser `NÃO CONSTA` num campo onde o banco já tem valor real, o
valor do banco é mantido e o relatório avisa. Foi assim que um título digitado
direto no app não se perdeu na segunda sincronização. Localização (`cidade`,
`zona`, `secao`, `secao_id`) é tratada em bloco, para não sobrar cidade sem
zona.

## Limpeza aplicada

A planilha é editada no Excel, que trata título, zona, seção e telefone como
número. Isso causa dois estragos, ambos desfeitos em `lib/normalizar.mjs`:

- **zeros à esquerda somem** — `012345678900` vira `12345678900`. O título tem
  12 dígitos fixos, então o padding restaura o valor.
- **números grandes viram notação científica** — `8.69E10` volta a ser
  `(86) 90000-0000`.

Que a reconstrução está correta foi verificado pelos dígitos verificadores: os
títulos reconstruídos passam na validação na mesma taxa dos que vieram como
texto e nunca foram tocados.

> **Conserto na origem:** selecione as colunas TÍTULO, ZONA, SEÇÃO e TELEFONE
> → Formatar Células → Personalizado → `000000000000` (ajustando a quantidade
> de dígitos). Aí o Excel para de destruir o dado.

## Relatórios

Cada execução grava, em `scripts/`:

- **`avisos-lista-nominal.csv`** — linhas que merecem conferência humana:
  título com dígito verificador inválido, título de outra UF, telefone com dois
  números na mesma célula, seção inexistente na base do TRE, e todo caso em que
  um dado do banco foi preservado contra um `NÃO CONSTA` da planilha.
- **`duplicidades.csv`** — grupos com o mesmo título (duplicata de fato, já que
  o título é único por eleitor) ou o mesmo nome (só indício; homônimo é comum).

Nenhum aviso descarta linha: a planilha é a fonte de verdade e a correção é
humana.

## Cidade e seção oficial

A planilha não tem coluna de cidade. O script deduz pelo par **zona + seção**
contra `secoes_eleitorais_pi`. Esse par identifica um único município em
11.220 de 11.220 casos da base do TRE-PI — a seção é numerada dentro da zona, e
cada seção pertence a um só local de votação. Resolvido o par, o registro ainda
recebe o `secao_id` oficial, que alimenta `localizacao_validada` na view.

Quando o par não existe na base (o TRE só lista seção que tem local de
votação; seção agregada ou extinta some), vale o mesmo plano B do app
(migration 017): se a zona cobre **um único** município, a cidade vem dela,
sem `secao_id`. Zona partilhada (a 97 cobre Teresina e Nazária) fica
`NÃO CONSTA` e vai para os avisos.

Zona isolada não é critério principal: só 9 das 74 zonas do Piauí cobrem um
município único.

## Coluna EST

Aceita `Ana` ou `Gil`, sem diferenciar maiúsculas de minúsculas. Qualquer outro valor fica em branco
(`NULL`) e vai para os avisos. Célula vazia **não apaga** um Est marcado pelo
app: é o caso normal, porque a maior parte é preenchida por lá, e o script só
informa quantos foram mantidos, sem um aviso por linha.
O número do título também não ajuda — ele codifica a UF, não o município.

Sem zona/seção, a cidade fica `NÃO CONSTA`. Campo sem informação vira esse
literal, e não `NULL`, porque as colunas são `NOT NULL` com `CHECK` de tamanho.

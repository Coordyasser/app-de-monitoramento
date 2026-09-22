// Regra da coluna SITUAÇÃO.
//
// A planilha de origem traz OK, PENDENTE ou CONFERIR, mas o PENDENTE de lá
// envelheceu: muita linha ficou marcada assim por falta de um dado que depois
// chegou. O que de fato mantém alguém pendente é não ter como identificar
// (título) **nem** como falar (contato) — faltando os dois. Com qualquer um
// dos dois em mãos o registro está utilizável e vale OK.
//
// CONFERIR é triagem humana ("tem algo estranho aqui") e nenhum campo prova
// ou desmente isso, então passa intacto. NULL é registro criado no app, que
// nunca teve situação.

import { conferirTitulo } from './titulo'
import { ehNaoConsta } from './texto'

/** Valores que a planilha de origem usa na coluna SITUAÇÃO. */
export const SITUACOES = ['OK', 'PENDENTE', 'CONFERIR'] as const

export type Situacao = (typeof SITUACOES)[number]

/** Campo que ficou com a sentinela "NÃO CONSTA" — ou em branco, no limite. */
function semValor(bruto: string | null | undefined): boolean {
  return !(bruto ?? '').trim() || ehNaoConsta(bruto)
}

/** Sem título informado — título errado ainda é um título que alguém deu. */
export function tituloPendente(titulo: string | null | undefined): boolean {
  return conferirTitulo(titulo).situacao === 'ausente'
}

export function contatoPendente(contato: string | null | undefined): boolean {
  return semValor(contato)
}

export interface RegistroSituacao {
  situacao: string | null
  titulo:   string | null
  contato:  string | null
}

/**
 * Situação depois da regra: o que a aplicação exibe e grava.
 *
 * PENDENTE só resiste sem título e sem contato; caso contrário vira OK.
 * CONFERIR e NULL seguem como estão.
 */
export function situacaoEfetiva(registro: RegistroSituacao): string | null {
  const bruta = (registro.situacao ?? '').trim()
  if (!bruta) return null
  if (bruta.toUpperCase() !== 'PENDENTE') return bruta

  return tituloPendente(registro.titulo) && contatoPendente(registro.contato)
    ? 'PENDENTE'
    : 'OK'
}

// ── A mesma regra, dita em PostgREST ───────────────────────────────────────
//
// O filtro da lista não pode olhar a coluna crua: ela ainda guarda o PENDENTE
// velho da planilha, e filtrar por ele traria linhas que a tela mostra como
// OK. A regra precisa valer na consulta também.
//
// Dá para reproduzi-la no filtro porque o banco não aceita título nem contato
// vazios (CHECKs da migration 010): a única ausência gravável é a sentinela.
// Se `situacaoEfetiva` mudar, esta função muda junto.

/** Casa "NÃO CONSTA", "NAO CONSTA" e "NÃOCONSTA". `_` é um caractere, `*` é o % do PostgREST. */
const SENTINELA_ILIKE = 'n_o*consta'

const semTitulo   = `titulo.ilike.${SENTINELA_ILIKE}`
const semContato  = `contato.ilike.${SENTINELA_ILIKE}`
const temTitulo   = `titulo.not.ilike.${SENTINELA_ILIKE}`
const temContato  = `contato.not.ilike.${SENTINELA_ILIKE}`

/** Opções do filtro de situação, na ordem em que aparecem. */
export const FILTROS_SITUACAO = [
  { value: 'OK',        label: 'OK' },
  { value: 'PENDENTE',  label: 'PENDENTE' },
  { value: 'CONFERIR',  label: 'CONFERIR' },
  { value: 'SEM',       label: 'Sem situação' },
]

/**
 * Expressão para o `.or()` do supabase-js, ou null quando não há filtro.
 *
 * O OK efetivo é o OK gravado mais o PENDENTE que a regra derruba — daí ele
 * ser o único caso com dois ramos.
 */
export function filtroSituacao(valor: string): string | null {
  switch (valor) {
    case 'OK':
      return `situacao.ilike.OK,and(situacao.ilike.PENDENTE,or(${temTitulo},${temContato}))`
    case 'PENDENTE':
      return `and(situacao.ilike.PENDENTE,${semTitulo},${semContato})`
    case 'CONFERIR':
      return 'situacao.ilike.CONFERIR'
    case 'SEM':
      return 'situacao.is.null'
    default:
      return null
  }
}

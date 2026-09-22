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

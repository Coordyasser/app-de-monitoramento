// Campo Est: domínio fechado de dois valores, espelhando o CHECK da
// migration 016. Em branco é NULL, e não a sentinela "NÃO CONSTA" dos campos
// de texto livre — o CHECK recusaria a sentinela, e com domínio fechado o
// próprio NULL já diz que ninguém preencheu.

export const EST_OPCOES = ['Ana', 'Gil'] as const

export type Est = (typeof EST_OPCOES)[number]

/** Opções do campo, com a saída explícita para deixá-lo em branco de novo. */
export const EST_SELECT = [
  { value: '', label: 'Em branco' },
  ...EST_OPCOES.map(v => ({ value: v, label: v })),
]

export function ehEstValido(valor: string): boolean {
  return valor === '' || (EST_OPCOES as readonly string[]).includes(valor)
}

/**
 * Opções do filtro da lista. Vazio ali significa "não filtrar", então o
 * registro em branco precisa de um valor próprio para ser procurável.
 */
export const SEM_EST = 'SEM'

export const FILTROS_EST = [
  ...EST_OPCOES.map(v => ({ value: v, label: v })),
  { value: SEM_EST, label: 'Em branco' },
]

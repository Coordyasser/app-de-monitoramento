// Recorte do dashboard por data de cadastro e Est (migration 018).

import { SEM_EST } from '@/lib/est'

export interface FiltroDash {
  /** AAAA-MM-DD, limites inclusos, no fuso do Piauí */
  de:  string
  ate: string
  /** '' = todos; 'Ana', 'Gil' ou SEM_EST */
  est: string
}

export const FILTRO_VAZIO: FiltroDash = { de: '', ate: '', est: '' }

export const temFiltro = (f: FiltroDash) => Boolean(f.de || f.ate || f.est)

/**
 * Parâmetros das RPCs. Sem filtro não manda nada: a chamada fica igual à de
 * antes da migration 018 e continua valendo contra o banco antigo.
 */
export function paramsFiltro(f: FiltroDash) {
  if (!temFiltro(f)) return {}
  return { p_de: f.de || null, p_ate: f.ate || null, p_est: f.est || null }
}

// O Piauí não tem horário de verão: o dia vai de 00:00 a 24:00 em -03:00.
const inicioDoDia = (d: string) => `${d}T00:00:00-03:00`
const fimDoDia    = (d: string) => `${d}T23:59:59.999-03:00`

interface ConsultaFiltravel<Q> {
  gte(coluna: string, valor: string): Q
  lte(coluna: string, valor: string): Q
  eq(coluna: string, valor: string): Q
  is(coluna: string, valor: null): Q
}

/** O mesmo recorte das RPCs, para as consultas que vão direto na view. */
export function filtrarView<Q extends ConsultaFiltravel<Q>>(q: Q, f: FiltroDash): Q {
  if (f.de)  q = q.gte('created_at', inicioDoDia(f.de))
  if (f.ate) q = q.lte('created_at', fimDoDia(f.ate))
  if (f.est) q = f.est === SEM_EST ? q.is('est', null) : q.eq('est', f.est)
  return q
}

const dataBR = (d: string) => d.split('-').reverse().join('/')

/** Texto do recorte, para o cabeçalho do PDF. */
export function descreverFiltro(f: FiltroDash): string {
  const partes: string[] = []
  if (f.de && f.ate)  partes.push(`Período: ${dataBR(f.de)} a ${dataBR(f.ate)}`)
  else if (f.de)      partes.push(`A partir de ${dataBR(f.de)}`)
  else if (f.ate)     partes.push(`Até ${dataBR(f.ate)}`)
  if (f.est) partes.push(`Est: ${f.est === SEM_EST ? 'em branco' : f.est}`)
  return partes.join(' · ')
}

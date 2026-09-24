// Filtros e consulta da lista de registros. Ficam fora do componente porque
// a tabela e o popup de exportação montam a mesma query.

import { supabase } from '@/lib/supabase'
import { capitalizarLugar, ehNaoConsta, exibirTexto } from '@/lib/texto'
import { FILTROS_SITUACAO, filtroSituacao } from '@/lib/situacao'
import { FILTROS_EST, SEM_EST } from '@/lib/est'
import type { RegistroDetalhado } from '@/types/database.types'

export interface Filtros {
  busca:    string
  cidade:   string
  vinculo:  string
  situacao: string
  est:      string
  dataDe:   string
  dataAte:  string
}

export const FILTROS_VAZIOS: Filtros = {
  busca: '', cidade: '', vinculo: '', situacao: '', est: '', dataDe: '', dataAte: '',
}

const COLUNAS = 'id,nome,contato,titulo,vinculo,cidade,zona,secao,observacoes,secao_id,created_by,created_at,updated_at,agente_nome,local_votacao,localizacao_validada,origem_id,situacao,est'

/** PostgREST interpreta vírgula e parênteses como sintaxe no filtro `or` */
function sanitizarBusca(termo: string) {
  return termo.replace(/[,()*\\]/g, ' ').trim()
}

export function montarQuery(f: Filtros, contar: boolean) {
  let q = supabase
    .from('vw_registros_detalhados')
    .select(COLUNAS, contar ? { count: 'exact' } : undefined)
    .order('created_at', { ascending: false })

  const termo = sanitizarBusca(f.busca)
  if (termo) {
    q = q.or(`nome.ilike.%${termo}%,titulo.ilike.%${termo}%,contato.ilike.%${termo}%`)
  }
  if (f.cidade)  q = q.eq('cidade', f.cidade)
  if (f.vinculo) q = q.eq('vinculo', f.vinculo)

  // A situação é derivada, então o filtro reproduz a regra em vez de
  // comparar a coluna crua. Ver `filtroSituacao`.
  const situacao = filtroSituacao(f.situacao)
  if (situacao) q = q.or(situacao)

  // Est é coluna de verdade, com domínio fechado: comparação direta. Em
  // branco é NULL, que `eq` nunca casaria.
  if (f.est === SEM_EST)  q = q.is('est', null)
  else if (f.est)         q = q.eq('est', f.est)

  if (f.dataDe)  q = q.gte('created_at', `${f.dataDe}T00:00:00`)
  if (f.dataAte) q = q.lte('created_at', `${f.dataAte}T23:59:59`)

  return q
}

// ── Formatação ─────────────────────────────────────────────────────────────

export function formatarData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

/**
 * "Teresina · Z1 · S185", omitindo o que ainda não foi coletado. Sem isso o
 * registro parcial vira "Não consta · ZNÃO CONSTA · SNÃO CONSTA" na lista.
 */
export function descreverLocal(r: RegistroDetalhado): string {
  const partes = [
    ehNaoConsta(r.cidade) ? null : capitalizarLugar(r.cidade),
    ehNaoConsta(r.zona)   ? null : `Z${r.zona}`,
    ehNaoConsta(r.secao)  ? null : `S${r.secao}`,
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(' · ') : 'Não consta'
}

function dataCurta(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Os filtros ativos em texto corrido, para o cabeçalho do PDF. */
export function descreverFiltros(f: Filtros): string[] {
  const rotulo = (opcoes: { value: string; label: string }[], v: string) =>
    opcoes.find(o => o.value === v)?.label ?? v

  const partes: string[] = []
  if (f.busca.trim()) partes.push(`Busca: "${f.busca.trim()}"`)
  if (f.cidade)       partes.push(`Cidade: ${capitalizarLugar(f.cidade)}`)
  if (f.vinculo)      partes.push(`Vínculo: ${exibirTexto(f.vinculo)}`)
  if (f.situacao)     partes.push(`Situação: ${rotulo(FILTROS_SITUACAO, f.situacao)}`)
  if (f.est)          partes.push(`Est: ${rotulo(FILTROS_EST, f.est)}`)
  if (f.dataDe && f.dataAte) partes.push(`Período: ${dataCurta(f.dataDe)} a ${dataCurta(f.dataAte)}`)
  else if (f.dataDe)         partes.push(`A partir de ${dataCurta(f.dataDe)}`)
  else if (f.dataAte)        partes.push(`Até ${dataCurta(f.dataAte)}`)
  return partes
}

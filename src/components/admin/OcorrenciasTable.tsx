import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Eye, X, Filter, RotateCcw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, Modal, Button, ComboboxSelect } from '@/components/ui'
import type { OcorrenciaCategoria, OcorrenciaStatus } from '@/types/database.types'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface OcorrenciaRow {
  id:            string
  categoria:     string
  descricao:     string
  foto_url:      string | null
  status:        string
  created_at:    string
  agente_nome:   string | null
  municipio:     string | null
  zona:          string | null
  local_votacao: string | null
  secao:         string | null
}

interface Filters {
  dateFrom:  string
  dateTo:    string
  municipio: string
  local:     string
}

const EMPTY_FILTERS: Filters = { dateFrom: '', dateTo: '', municipio: '', local: '' }

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<OcorrenciaCategoria, string> = {
  irregularidade_administrativa: 'Irr. Administrativa',
  problema_com_urna:             'Prob. com Urna',
  fila_aglomeracao:              'Fila / Aglomeração',
  acessibilidade:                'Acessibilidade',
  conduta_suspeita:              'Conduta Suspeita',
  outro:                         'Outro',
}

const STATUS_OPTIONS: { value: OcorrenciaStatus; label: string; cls: string }[] = [
  { value: 'pendente',   label: 'Pendente',   cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-700' },
  { value: 'em_analise', label: 'Em análise', cls: 'text-blue-600  bg-blue-50  dark:bg-blue-900/20  dark:text-blue-400  border-blue-200  dark:border-blue-700'  },
  { value: 'arquivado',  label: 'Arquivado',  cls: 'text-slate-600 bg-slate-50 dark:bg-slate-800/60 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
]

function BadgeStatus({ status }: { status: string }) {
  const opt = STATUS_OPTIONS.find(o => o.value === status)
  if (!opt) return <span className="text-xs text-slate-400">{status}</span>
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${opt.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-soft" />
      {opt.label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const PAGE_SIZE = 12

// ── Componente ─────────────────────────────────────────────────────────────

export function OcorrenciasTable() {
  const [rows,     setRows]     = useState<OcorrenciaRow[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [detail,   setDetail]   = useState<OcorrenciaRow | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  // Filtros
  const [filters,    setFilters]    = useState<Filters>(EMPTY_FILTERS)
  const [munOpts,    setMunOpts]    = useState<string[]>([])
  const [localOpts,  setLocalOpts]  = useState<string[]>([])
  const [localLoading, setLocalLoading] = useState(false)

  // Refs para evitar closures desatualizadas no handler realtime
  const pageRef    = useRef(page)
  const filtersRef = useRef(filters)
  useEffect(() => { pageRef.current    = page    }, [page])
  useEffect(() => { filtersRef.current = filters }, [filters])

  const totalPages  = Math.ceil(total / PAGE_SIZE)
  const hasFilters  = Object.values(filters).some(Boolean)

  // ── Fetch principal ───────────────────────────────────────────────────

  const fetchRows = useCallback(async (p: number, f: Filters) => {
    setLoading(true)
    setError(null)
    const from = p * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    let q = supabase
      .from('vw_ocorrencias_detalhadas')
      .select(
        'id,categoria,descricao,foto_url,status,created_at,agente_nome,municipio,zona,local_votacao,secao',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    if (f.dateFrom) q = q.gte('created_at', f.dateFrom + 'T00:00:00')
    if (f.dateTo)   q = q.lte('created_at', f.dateTo   + 'T23:59:59')
    if (f.municipio) q = q.eq('municipio',    f.municipio)
    if (f.local)     q = q.eq('local_votacao', f.local)

    const { data, error: err, count } = await q
    if (err) { setError(err.message); setLoading(false); return }
    setRows((data as OcorrenciaRow[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [])

  // Dispara fetch quando page ou filters mudam
  useEffect(() => { fetchRows(page, filters) }, [fetchRows, page, filters])

  // Realtime: nova ocorrência inserida
  useEffect(() => {
    const channel = supabase
      .channel('ocorrencias-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ocorrencias' }, () => {
        if (pageRef.current === 0) fetchRows(0, filtersRef.current)
        else setTotal(prev => prev + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchRows])

  // ── Opções dos selects de filtro ──────────────────────────────────────

  useEffect(() => {
    supabase.rpc('get_municipios_pi').then(({ data }) => {
      setMunOpts((data ?? []).map((r: { municipio: string }) => r.municipio))
    })
  }, [])

  useEffect(() => {
    if (!filters.municipio) { setLocalOpts([]); return }
    setLocalLoading(true)
    supabase
      .rpc('get_locais_municipio_pi', { p_municipio: filters.municipio })
      .then(({ data }) => {
        setLocalOpts((data ?? []).map((r: { local_votacao: string }) => r.local_votacao))
        setLocalLoading(false)
      })
  }, [filters.municipio])

  // ── Helpers de estado ─────────────────────────────────────────────────

  function applyFilter(patch: Partial<Filters>) {
    const next = { ...filters, ...patch }
    // Ao trocar município, limpa local
    if (patch.municipio !== undefined && patch.municipio !== filters.municipio) {
      next.local = ''
    }
    setFilters(next)
    setPage(0)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setPage(0)
  }

  // ── Update de status ──────────────────────────────────────────────────

  async function handleStatusChange(id: string, newStatus: OcorrenciaStatus) {
    const previousStatus = rows.find(r => r.id === id)?.status
    setUpdating(id)

    setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
    if (detail?.id === id) setDetail(prev => prev ? { ...prev, status: newStatus } : prev)

    const { error: err } = await supabase.from('ocorrencias').update({ status: newStatus }).eq('id', id)

    if (err) {
      if (previousStatus) {
        setRows(prev => prev.map(r => r.id === id ? { ...r, status: previousStatus } : r))
        if (detail?.id === id) setDetail(prev => prev ? { ...prev, status: previousStatus } : prev)
      }
      setError(`Falha ao atualizar status: ${err.message}`)
    }
    setUpdating(null)
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <Card padding="none" className="overflow-hidden">

        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-white/20 dark:border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Filter size={14} className="text-indigo-500" />
                Ocorrências em Tempo Real
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {total} registro{total !== 1 ? 's' : ''} · atualização automática
                {hasFilters && <span className="ml-1 text-indigo-500">(filtrado)</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400
                             hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                >
                  <RotateCcw size={12} />
                  Limpar filtros
                </button>
              )}
              {page > 0 && (
                <button
                  onClick={() => setPage(0)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Ver mais recentes
                </button>
              )}
            </div>
          </div>

          {/* Barra de filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Data início */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Data início
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={e => applyFilter({ dateFrom: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border
                           border-slate-200/80 dark:border-white/10
                           bg-white/60 dark:bg-white/5 backdrop-blur-sm
                           text-slate-800 dark:text-slate-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400
                           dark:focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Data fim */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Data fim
              </label>
              <input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={e => applyFilter({ dateTo: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-xl border
                           border-slate-200/80 dark:border-white/10
                           bg-white/60 dark:bg-white/5 backdrop-blur-sm
                           text-slate-800 dark:text-slate-100
                           focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400
                           dark:focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Município */}
            <ComboboxSelect
              label="Município"
              placeholder="Todos os municípios"
              options={[
                { value: '', label: 'Todos os municípios' },
                ...munOpts.map(m => ({ value: m, label: m })),
              ]}
              value={filters.municipio}
              onChange={v => applyFilter({ municipio: v })}
            />

            {/* Local de votação */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Local de votação
              </label>
              <div className="relative">
                <select
                  value={filters.local}
                  disabled={!filters.municipio || localLoading}
                  onChange={e => applyFilter({ local: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border appearance-none
                             border-slate-200/80 dark:border-white/10
                             bg-white/60 dark:bg-white/5 backdrop-blur-sm
                             text-slate-800 dark:text-slate-100
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400
                             dark:focus:border-indigo-500 transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!filters.municipio
                      ? 'Selecione um município primeiro'
                      : localLoading
                        ? 'Carregando...'
                        : 'Todos os locais'}
                  </option>
                  {localOpts.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                {localLoading && (
                  <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Corpo */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center gap-2 px-6 py-4 text-rose-600 dark:text-rose-400 text-sm">
            <AlertCircle size={16} />{error}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-16 text-sm text-slate-400 dark:text-slate-500">
            {hasFilters
              ? 'Nenhuma ocorrência encontrada para os filtros selecionados.'
              : 'Nenhuma ocorrência registrada ainda.'}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 dark:border-white/5">
                  {['ID', 'Categoria', 'Município', 'Local de Votação', 'Seção', 'Agente', 'Data/Hora', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={[
                      'border-b border-white/10 dark:border-white/5 transition-colors',
                      i % 2 === 0 ? '' : 'bg-white/20 dark:bg-white/3',
                      'hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {row.id.substring(0, 8)}…
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                      {CATEGORIA_LABELS[row.categoria as OcorrenciaCategoria] ?? row.categoria}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-[110px] truncate">
                      {row.municipio ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[160px] truncate">
                      {row.local_votacao ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.secao ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[100px] truncate">
                      {row.agente_nome ?? <span className="italic text-slate-400">Anônimo</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {updating === row.id
                        ? <Loader2 size={14} className="animate-spin text-indigo-500" />
                        : (
                          <select
                            value={row.status}
                            onChange={e => handleStatusChange(row.id, e.target.value as OcorrenciaStatus)}
                            className="text-xs rounded-lg px-2 py-1 border cursor-pointer appearance-none
                                       bg-white/50 dark:bg-white/5 backdrop-blur-sm
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all
                                       text-slate-700 dark:text-slate-300"
                          >
                            {STATUS_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        )
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetail(row)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50
                                   dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/20 dark:border-white/10">
            <p className="text-xs text-slate-400">
              Página {page + 1} de {totalPages} · {total} registro{total !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100
                           dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100
                           dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal de detalhe */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detalhe da Ocorrência" maxWidth="lg">
        {detail && (
          <div className="flex flex-col gap-4">
            {detail.foto_url && (
              <img
                src={detail.foto_url}
                alt="Foto da ocorrência"
                className="w-full max-h-60 object-cover rounded-xl"
              />
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Status',           value: <BadgeStatus status={detail.status} /> },
                { label: 'Categoria',        value: CATEGORIA_LABELS[detail.categoria as OcorrenciaCategoria] ?? detail.categoria },
                { label: 'Município',        value: detail.municipio    ?? '—' },
                { label: 'Zona',             value: detail.zona         ?? '—' },
                { label: 'Local de Votação', value: detail.local_votacao ?? '—' },
                { label: 'Seção',            value: detail.secao        ?? '—' },
                { label: 'Agente',           value: detail.agente_nome  ?? 'Anônimo' },
                { label: 'Data/Hora',        value: formatDate(detail.created_at) },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-slate-50/60 dark:bg-white/5 border border-white/20 dark:border-white/10">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{value}</div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-slate-50/60 dark:bg-white/5 border border-white/20 dark:border-white/10">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Descrição</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {detail.descricao}
              </p>
            </div>

            {/* Alterar status no modal */}
            <div className="flex items-center gap-3 pt-2">
              <p className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Alterar status:</p>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    disabled={detail.status === opt.value || !!updating}
                    onClick={() => handleStatusChange(detail.id, opt.value)}
                    className={[
                      'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      detail.status === opt.value
                        ? `${opt.cls} cursor-default`
                        : 'opacity-50 hover:opacity-100 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-white/30 dark:border-white/10',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
                {updating && <Loader2 size={14} className="animate-spin text-indigo-500 self-center" />}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setDetail(null)} icon={<X size={16} />}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

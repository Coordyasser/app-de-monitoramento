import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle, ChevronLeft, ChevronRight, Download, Filter,
  Loader2, MapPin, RotateCcw, Search, ShieldCheck,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button, Card, ComboboxSelect, Input } from '@/components/ui'
import type { RegistroDetalhado } from '@/types/database.types'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Filtros {
  busca:    string
  cidade:   string
  vinculo:  string
  dataDe:   string
  dataAte:  string
}

const FILTROS_VAZIOS: Filtros = { busca: '', cidade: '', vinculo: '', dataDe: '', dataAte: '' }

interface Props {
  /** Modo enxuto para o dashboard: sem filtros, sem paginação, sem export */
  compact?: boolean
  /** Quantidade de linhas no modo enxuto */
  limit?:   number
}

const PAGE_SIZE   = 12
const EXPORT_MAX  = 5000

const COLUNAS = 'id,nome,contato,titulo,vinculo,cidade,zona,secao,observacoes,secao_id,created_by,created_at,updated_at,agente_nome,local_votacao,localizacao_validada,origem_id,situacao'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatarData(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

/** PostgREST interpreta vírgula e parênteses como sintaxe no filtro `or` */
function sanitizarBusca(termo: string) {
  return termo.replace(/[,()*\\]/g, ' ').trim()
}

function paraCSV(linhas: RegistroDetalhado[]): string {
  const cabecalho = [
    'Nome', 'Contato', 'Título', 'Vínculo', 'Cidade', 'Zona', 'Seção',
    'Local de votação', 'Localização validada', 'Observações', 'Registrado por', 'Data',
  ]
  const escapar = (v: unknown) => {
    const texto = v === null || v === undefined ? '' : String(v)
    return `"${texto.replace(/"/g, '""')}"`
  }
  const corpo = linhas.map(r => [
    r.nome, r.contato, r.titulo, r.vinculo, r.cidade, r.zona, r.secao,
    r.local_votacao ?? '', r.localizacao_validada ? 'Sim' : 'Não',
    r.observacoes ?? '', r.agente_nome ?? '', formatarData(r.created_at),
  ].map(escapar).join(';'))

  return [cabecalho.map(escapar).join(';'), ...corpo].join('\r\n')
}

function baixarCSV(conteudo: string) {
  // BOM para o Excel reconhecer o acento
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `registros-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Componente ─────────────────────────────────────────────────────────────

export function RegistrosTable({ compact = false, limit = 8 }: Props) {
  const navigate = useNavigate()

  const [linhas,   setLinhas]   = useState<RegistroDetalhado[]>([])
  const [total,    setTotal]    = useState(0)
  const [pagina,   setPagina]   = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  const [filtros,      setFiltros]      = useState<Filtros>(FILTROS_VAZIOS)
  const [buscaInput,   setBuscaInput]   = useState('')
  const [cidadeOpts,   setCidadeOpts]   = useState<string[]>([])
  const [vinculoOpts,  setVinculoOpts]  = useState<string[]>([])

  // Refs para o handler de realtime não capturar estado velho
  const paginaRef  = useRef(pagina)
  const filtrosRef = useRef(filtros)
  useEffect(() => { paginaRef.current  = pagina  }, [pagina])
  useEffect(() => { filtrosRef.current = filtros }, [filtros])

  const totalPaginas = Math.ceil(total / PAGE_SIZE)
  const temFiltro    = Object.values(filtros).some(Boolean)

  // ── Query base com filtros aplicados ─────────────────────────────────

  const montarQuery = useCallback((f: Filtros, contar: boolean) => {
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
    if (f.dataDe)  q = q.gte('created_at', `${f.dataDe}T00:00:00`)
    if (f.dataAte) q = q.lte('created_at', `${f.dataAte}T23:59:59`)

    return q
  }, [])

  // ── Busca das linhas ──────────────────────────────────────────────────

  const buscar = useCallback(async (p: number, f: Filtros) => {
    setLoading(true)
    setErro(null)

    const de   = compact ? 0 : p * PAGE_SIZE
    const ate  = compact ? limit - 1 : de + PAGE_SIZE - 1

    const { data, error, count } = await montarQuery(f, !compact).range(de, ate)

    if (error) { setErro(error.message); setLoading(false); return }
    setLinhas((data as RegistroDetalhado[]) ?? [])
    setTotal(count ?? data?.length ?? 0)
    setLoading(false)
  }, [compact, limit, montarQuery])

  useEffect(() => { buscar(pagina, filtros) }, [buscar, pagina, filtros])

  // ── Realtime: novo registro entrando ─────────────────────────────────

  useEffect(() => {
    const canal = supabase
      .channel('registros-lista')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registros' }, () => {
        if (paginaRef.current === 0) buscar(0, filtrosRef.current)
        else setTotal(prev => prev + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [buscar])

  // ── Opções dos filtros ───────────────────────────────────────────────

  useEffect(() => {
    if (compact) return
    supabase.rpc('get_registros_por_cidade', { p_limit: 200 }).then(({ data }) => {
      setCidadeOpts((data ?? []).map(r => r.cidade))
    })
    supabase.rpc('get_vinculos_sugeridos', { p_limit: 100 }).then(({ data }) => {
      setVinculoOpts((data ?? []).map(r => r.vinculo))
    })
  }, [compact])

  // Debounce da busca textual
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros(f => f.busca === buscaInput ? f : { ...f, busca: buscaInput })
      setPagina(0)
    }, 350)
    return () => clearTimeout(t)
  }, [buscaInput])

  // ── Ações ────────────────────────────────────────────────────────────

  function aplicar(patch: Partial<Filtros>) {
    setFiltros(f => ({ ...f, ...patch }))
    setPagina(0)
  }

  function limpar() {
    setFiltros(FILTROS_VAZIOS)
    setBuscaInput('')
    setPagina(0)
  }

  async function exportar() {
    setExportando(true)
    const { data, error } = await montarQuery(filtros, false).range(0, EXPORT_MAX - 1)
    setExportando(false)
    if (error) { setErro(`Falha ao exportar: ${error.message}`); return }
    baixarCSV(paraCSV((data as RegistroDetalhado[]) ?? []))
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <Card padding="none" className="overflow-hidden">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4
                      border-b border-white/40 dark:border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {compact ? 'Últimos registros' : 'Registros'}
          </h3>
          {!compact && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'registro' : 'registros'}`}
              {temFiltro ? ' com os filtros aplicados' : ''}
            </p>
          )}
        </div>

        {compact ? (
          <Link
            to="/registros"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Ver todos
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            {temFiltro && (
              <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={limpar}>
                Limpar
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              loading={exportando}
              onClick={exportar}
              disabled={total === 0}
            >
              Exportar CSV
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      {!compact && (
        <div className="px-5 py-4 border-b border-white/40 dark:border-white/10
                        bg-white/30 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Filter size={13} />
            Filtros
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input
              placeholder="Nome, título ou contato"
              icon={<Search size={15} />}
              value={buscaInput}
              onChange={e => setBuscaInput(e.target.value)}
            />
            <ComboboxSelect
              options={cidadeOpts.map(c => ({ value: c, label: c }))}
              value={filtros.cidade}
              onChange={v => aplicar({ cidade: v })}
              placeholder="Todas as cidades"
            />
            <ComboboxSelect
              options={vinculoOpts.map(v => ({ value: v, label: v }))}
              value={filtros.vinculo}
              onChange={v => aplicar({ vinculo: v })}
              placeholder="Todos os vínculos"
            />
            <Input
              type="date"
              value={filtros.dataDe}
              onChange={e => aplicar({ dataDe: e.target.value })}
            />
            <Input
              type="date"
              value={filtros.dataAte}
              onChange={e => aplicar({ dataAte: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div className="flex items-center gap-2 px-5 py-3 bg-rose-50 dark:bg-rose-900/20
                        text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={15} className="shrink-0" />
          {erro}
        </div>
      )}

      {/* Corpo */}
      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 size={26} className="animate-spin text-indigo-500" />
        </div>
      ) : linhas.length === 0 ? (
        <div className="py-16 px-5 text-center">
          <MapPin size={30} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {temFiltro ? 'Nenhum registro encontrado com esses filtros.' : 'Nenhum registro ainda.'}
          </p>
          {!temFiltro && (
            <Link to="/registros/novo" className="inline-block mt-4">
              <Button size="sm">Criar o primeiro registro</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide
                             text-slate-400 dark:text-slate-500
                             border-b border-white/40 dark:border-white/10">
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium hidden md:table-cell">Título</th>
                <th className="px-5 py-3 font-medium hidden lg:table-cell">Vínculo</th>
                <th className="px-5 py-3 font-medium">Localização</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Data</th>
                <th className="px-5 py-3 font-medium text-right sr-only">Abrir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40 dark:divide-white/[0.06]">
              {linhas.map(r => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/registros/${r.id}`)}
                  className="cursor-pointer transition-colors
                             hover:bg-white/50 dark:hover:bg-white/[0.06]"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[200px]">
                      {r.nome}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                      {r.contato}
                    </p>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell text-slate-600 dark:text-slate-300">
                    <span className="truncate block max-w-[180px]">{r.titulo}</span>
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                                     bg-indigo-100/70 text-indigo-700
                                     dark:bg-indigo-900/40 dark:text-indigo-300">
                      {r.vinculo}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      {r.localizacao_validada && (
                        <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                      )}
                      <span className="truncate max-w-[160px]">
                        {r.cidade} · Z{r.zona} · S{r.secao}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatarData(r.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ChevronRight size={16} className="inline text-slate-300 dark:text-slate-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {!compact && totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-3 px-5 py-3
                        border-t border-white/40 dark:border-white/10">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Página {pagina + 1} de {totalPaginas}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              disabled={pagina === 0}
              onClick={() => setPagina(p => Math.max(p - 1, 0))}
              icon={<ChevronLeft size={15} />}
            >
              Anterior
            </Button>
            <Button
              variant="ghost" size="sm"
              disabled={pagina >= totalPaginas - 1}
              onClick={() => setPagina(p => p + 1)}
            >
              Próxima <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}

    </Card>
  )
}

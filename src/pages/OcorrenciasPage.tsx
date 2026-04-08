import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, FileText, ChevronLeft, ChevronRight,
  Calendar, Tag, MapPin, Loader2, AlertCircle, Image, User,
} from 'lucide-react'
import { supabase }   from '@/lib/supabase'
import { useAuth }    from '@/contexts/AuthContext'
import { AppShell }   from '@/components/layout/AppShell'
import { Card, Button, PageHeader } from '@/components/ui'
import type { OcorrenciaCategoria } from '@/types/database.types'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface OcorrenciaCard {
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

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<OcorrenciaCategoria, string> = {
  irregularidade_administrativa: 'Irregularidade administrativa',
  problema_com_urna:             'Problema com urna',
  fila_aglomeracao:              'Fila / Aglomeração',
  acessibilidade:                'Acessibilidade',
  conduta_suspeita:              'Conduta suspeita',
  outro:                         'Outro',
}

const STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  pendente:   { cls: 'badge-pendente',   label: 'Pendente'   },
  em_analise: { cls: 'badge-em_analise', label: 'Em análise' },
  resolvido:  { cls: 'badge-resolvido',  label: 'Resolvido'  },
  arquivado:  { cls: 'badge-arquivada',  label: 'Arquivado'  },
}

function BadgeStatus({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { cls: 'badge-arquivada', label: status }
  return (
    <span className={s.cls}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-soft" />
      {s.label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const PAGE_SIZE = 9

// ── Página ────────────────────────────────────────────────────────────────

export function OcorrenciasPage() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [items,   setItems]   = useState<OcorrenciaCard[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchOcorrencias = useCallback(async (p: number) => {
    if (!user) return
    setLoading(true)
    setError(null)

    const from = p * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    // Usa a view que já traz dados da seção e do agente.
    // RLS garante: admin vê tudo, agente vê apenas as próprias.
    let q = supabase
      .from('vw_ocorrencias_detalhadas')
      .select(
        'id,categoria,descricao,foto_url,status,created_at,agente_nome,municipio,zona,local_votacao,secao',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to)

    // Agente: filtra pelas próprias (reforça RLS e melhora performance)
    if (!isAdmin) {
      q = q.eq('user_id', user.id)
    }

    const { data, error: err, count } = await q

    if (err) { setError(err.message); setLoading(false); return }
    setItems((data as OcorrenciaCard[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [user, isAdmin])

  useEffect(() => { fetchOcorrencias(page) }, [fetchOcorrencias, page])

  function goToPage(p: number) {
    if (p < 0 || p >= totalPages) return
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const pageTitle    = isAdmin ? 'Todas as ocorrências' : 'Minhas ocorrências'
  const pageSubtitle = total > 0
    ? `${total} ocorrência${total > 1 ? 's' : ''} registrada${total > 1 ? 's' : ''}`
    : 'Nenhuma ocorrência ainda'

  return (
    <AppShell>
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        back="/"
        actions={
          <Link to="/buscar-secao">
            <Button icon={<Plus size={16} />} size="sm">Nova</Button>
          </Link>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      )}

      {!loading && error && (
        <Card padding="lg" className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-sm">{error}</p>
        </Card>
      )}

      {!loading && !error && items.length === 0 && (
        <Card padding="lg" className="text-center py-16">
          <FileText size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h2 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-2">
            Nenhuma ocorrência registrada
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
            {isAdmin
              ? 'Nenhum agente registrou ocorrências ainda.'
              : 'Registre incidentes observados durante a eleição.'}
          </p>
          {!isAdmin && (
            <Link to="/buscar-secao">
              <Button icon={<Plus size={16} />}>Registrar primeira ocorrência</Button>
            </Link>
          )}
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {items.map(item => (
              <Card key={item.id} hover padding="none" className="flex flex-col overflow-hidden">

                {/* Foto */}
                {item.foto_url ? (
                  <div className="h-40 overflow-hidden bg-slate-100 dark:bg-white/5">
                    <img
                      src={item.foto_url}
                      alt="Foto da ocorrência"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center bg-slate-50/60 dark:bg-white/5 border-b border-white/20 dark:border-white/10">
                    <Image size={28} className="text-slate-200 dark:text-slate-700" />
                  </div>
                )}

                {/* Conteúdo */}
                <div className="flex flex-col gap-3 p-4 flex-1">

                  {/* Status + categoria */}
                  <div className="flex items-start justify-between gap-2">
                    <BadgeStatus status={item.status} />
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                      <Tag size={10} />
                      {CATEGORIA_LABELS[item.categoria as OcorrenciaCategoria] ?? item.categoria}
                    </span>
                  </div>

                  {/* Agente (visível apenas para admin) */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                      <User size={11} className="shrink-0" />
                      <span className="truncate">
                        {item.agente_nome ?? <em className="text-slate-400">Anônimo</em>}
                      </span>
                    </div>
                  )}

                  {/* Descrição truncada */}
                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {item.descricao}
                  </p>

                  {/* Localização */}
                  {item.municipio && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                      <MapPin size={11} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-1">
                        {item.municipio}
                        {item.zona   && ` · Zona ${item.zona}`}
                        {item.secao  && ` · Seção ${item.secao}`}
                      </span>
                    </div>
                  )}

                  {/* Data */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-auto pt-2 border-t border-white/20 dark:border-white/10">
                    <Calendar size={11} />
                    {formatDate(item.created_at)}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronLeft size={16} />}
                onClick={() => goToPage(page - 1)}
                disabled={page === 0}
              >
                Anterior
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => goToPage(i)}
                    className={[
                      'w-8 h-8 rounded-lg text-sm font-medium transition-all',
                      i === page
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                        : 'text-slate-500 hover:bg-white/40 dark:hover:bg-white/10',
                    ].join(' ')}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages - 1}
              >
                Próxima
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}

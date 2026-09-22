import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, CalendarDays, ClipboardList, LayoutDashboard,
  MapPin, MapPinOff, Plus, SearchX, ShieldCheck, TrendingUp, Users,
} from 'lucide-react'
import { supabase }     from '@/lib/supabase'
import { useAuth }      from '@/contexts/AuthContext'
import { AppShell }     from '@/components/layout/AppShell'
import { Button, Card, PageHeader } from '@/components/ui'
import { MetricCard }   from '@/components/admin/MetricCard'
import { AgentesTable } from '@/components/admin/AgentesTable'
import { TimelineChart } from '@/components/dashboard/TimelineChart'
import { VinculoRanking, type Vinculo } from '@/components/dashboard/VinculoRanking'
import { EstBarra, type EstContagem } from '@/components/dashboard/EstBarra'
import {
  GeografiaCard,
  type Bairro, type CoberturaBairro, type CoberturaGeografica, type Municipio,
} from '@/components/dashboard/GeografiaCard'
import { MunicipioRanking } from '@/components/dashboard/MunicipioRanking'
import {
  DuplicadosCard, ZonaCoberturaCard,
  type Duplicado, type ZonaCobertura,
} from '@/components/dashboard/ListasDashboard'
import { RegistrosTable } from '@/components/registros/RegistrosTable'
import type { RegistrosMetrics } from '@/types/database.types'

// ── Stat compacto da faixa secundária ──────────────────────────────────────

function StatCompacto({ icon, label, valor, detalhe, alerta = false, loading }: {
  icon: ReactNode; label: string; valor: string; detalhe?: string
  alerta?: boolean; loading: boolean
}) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <span className={[
        'p-2 rounded-xl shrink-0',
        alerta
          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
          : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300',
      ].join(' ')}>
        {icon}
      </span>
      <div className="min-w-0">
        {loading ? (
          <div className="h-5 w-16 rounded bg-slate-200 dark:bg-white/10 animate-pulse" />
        ) : (
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">
            {valor}
          </p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
        {detalhe && !loading && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{detalhe}</p>
        )}
      </div>
    </Card>
  )
}

// ── Tabs ───────────────────────────────────────────────────────────────────

type Tab = 'visao' | 'equipe'

/**
 * Capital do estado. É a única cidade grande o bastante para que a visão por
 * município não diga nada: são 5 zonas para 1.928 seções, então lá o recorte
 * útil é o bairro. No interior, o município já é o próprio recorte.
 */
const CAPITAL = 'TERESINA'

/**
 * Contagem de um valor de Est.
 *
 * Est não tem RPC própria: são três contagens diretas na view, que já respeita
 * o RLS — admin conta a base toda, agente conta a sua. `head` traz só o número
 * no cabeçalho, sem nenhuma linha no corpo da resposta.
 */
function contarEst(valor: string | null) {
  const q = supabase
    .from('vw_registros_detalhados')
    .select('id', { count: 'exact', head: true })
  return valor === null ? q.is('est', null) : q.eq('est', valor)
}

// ── Página ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { profile } = useAuth()
  const ehAdmin = profile?.role === 'admin'

  const [tab, setTab] = useState<Tab>('visao')

  const [metrics, setMetrics] = useState<RegistrosMetrics | null>(null)
  const [serie,   setSerie]   = useState<{ dia: string; total: number }[]>([])
  const [vinculos,      setVinculos]      = useState<Vinculo[]>([])
  const [zonas,         setZonas]         = useState<ZonaCobertura[]>([])
  const [duplicados,    setDuplicados]    = useState<Duplicado[]>([])
  const [bairros,       setBairros]       = useState<Bairro[]>([])
  const [interior,      setInterior]      = useState<Municipio[]>([])
  const [municipios,    setMunicipios]    = useState<Municipio[]>([])
  const [cobertura,     setCobertura]     = useState<CoberturaGeografica | null>(null)
  const [cobBairro,     setCobBairro]     = useState<CoberturaBairro | null>(null)
  const [est,           setEst]           = useState<EstContagem | null>(null)

  const [dias,        setDias]        = useState(30)
  const [loading,     setLoading]     = useState(true)
  const [serieLoading, setSerieLoading] = useState(true)
  const [erro,        setErro]        = useState<string | null>(null)

  // ── Carga dos painéis ────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)

    const [m, v, z, d, b, int, mun, cob, cb, estAna, estGil, estBranco] = await Promise.all([
      supabase.rpc('get_registros_metrics'),
      // Todos os vínculos: o gráfico existe para dar a dimensão do conjunto,
      // e cortar na 12ª liderança escondia dois terços da lista.
      supabase.rpc('get_registros_por_vinculo',   { p_limit: 200 }),
      supabase.rpc('get_registros_por_zona',      { p_limit: 8  }),
      supabase.rpc('get_registros_duplicados',    { p_limit: 8  }),
      // 70 bairros da capital têm registro. Mostrar todos deixaria o cartão
      // com quase dois mil pixels de altura; 25 cobre a maior parte e o
      // rodapé declara o resto.
      supabase.rpc('get_registros_por_bairro',    { p_municipio: CAPITAL, p_limit: 25 }),
      // A capital sai da aba de interior: ela tem aba própria, por bairro.
      // O limite cobre todos os municípios alcançados, senão a nota de rodapé
      // precisa explicar um resto que não deveria existir.
      supabase.rpc('get_registros_por_municipio', { p_limit: 60, p_excluir: CAPITAL }),
      // O ranking geral inclui a capital.
      supabase.rpc('get_registros_por_municipio', { p_limit: 60 }),
      supabase.rpc('get_cobertura_geografica',    { p_capital: CAPITAL }),
      supabase.rpc('get_cobertura_bairro',        { p_municipio: CAPITAL }),
      contarEst('Ana'),
      contarEst('Gil'),
      contarEst(null),
    ])

    const falha = [m, v, z, d, b, int, mun, cob, cb, estAna, estGil, estBranco].find(r => r.error)
    if (falha?.error) setErro(falha.error.message)

    if (m.data)   setMetrics(m.data as unknown as RegistrosMetrics)
    if (v.data)   setVinculos(v.data)
    if (z.data)   setZonas(z.data)
    if (d.data)   setDuplicados(d.data as Duplicado[])
    if (b.data)   setBairros(b.data as Bairro[])
    if (int.data) setInterior(int.data as Municipio[])
    if (mun.data) setMunicipios(mun.data as Municipio[])
    if (cob.data) setCobertura(cob.data as unknown as CoberturaGeografica)
    // RETURNS TABLE devolve array; aqui é sempre uma linha só
    if (cb.data)  setCobBairro((cb.data as CoberturaBairro[])[0] ?? null)

    setEst({
      ana:    estAna.count    ?? 0,
      gil:    estGil.count    ?? 0,
      branco: estBranco.count ?? 0,
    })

    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Série temporal recarrega sozinha ao trocar o período
  useEffect(() => {
    let ativo = true
    setSerieLoading(true)
    supabase.rpc('get_registros_por_dia', { p_dias: dias }).then(({ data }) => {
      if (!ativo) return
      setSerie(data ?? [])
      setSerieLoading(false)
    })
    return () => { ativo = false }
  }, [dias])

  // ── Tendências ───────────────────────────────────────────────────────

  function variacao(atual: number, anterior: number): number {
    if (anterior === 0) return atual > 0 ? 100 : 0
    return ((atual - anterior) / anterior) * 100
  }

  const percentualValidado = metrics && metrics.total > 0
    ? Math.round((metrics.validados / metrics.total) * 100)
    : 0

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        subtitle={ehAdmin
          ? 'Consolidação dos registros de toda a equipe'
          : 'Consolidação dos seus registros em campo'}
        actions={
          <Link to="/registros/novo">
            <Button icon={<Plus size={17} />}>Novo registro</Button>
          </Link>
        }
      />

      {/* Tabs — a aba de equipe só existe para a coordenação */}
      {ehAdmin && (
        <div className="flex gap-1 p-1 rounded-xl glass w-fit mb-8">
          {([
            { key: 'visao',  label: 'Visão geral',   icon: LayoutDashboard },
            { key: 'equipe', label: 'Equipe & LGPD', icon: Users           },
          ] as { key: Tab; label: string; icon: typeof LayoutDashboard }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                tab === key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
              ].join(' ')}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}

      {erro && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl
                        bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {erro}
        </div>
      )}

      {tab === 'visao' && (
        <div className="space-y-6 animate-fade-in">

          {/* Métricas principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Registros no total"
              value={metrics?.total ?? 0}
              loading={loading}
              icon={<ClipboardList size={20} className="text-indigo-600 dark:text-indigo-400" />}
              iconColor="bg-indigo-100 dark:bg-indigo-900/40"
            />
            <MetricCard
              title="Registros hoje"
              value={metrics?.hoje ?? 0}
              loading={loading}
              icon={<CalendarDays size={20} className="text-violet-600 dark:text-violet-400" />}
              iconColor="bg-violet-100 dark:bg-violet-900/40"
              trend={metrics ? {
                value: variacao(metrics.hoje, metrics.ontem),
                label: 'vs. ontem',
              } : undefined}
            />
            <MetricCard
              title="Últimos 7 dias"
              value={metrics?.semana ?? 0}
              loading={loading}
              icon={<TrendingUp size={20} className="text-emerald-600 dark:text-emerald-400" />}
              iconColor="bg-emerald-100 dark:bg-emerald-900/40"
              trend={metrics ? {
                value: variacao(metrics.semana, metrics.semana_anterior),
                label: 'vs. 7 dias antes',
              } : undefined}
            />
            <MetricCard
              title="Cidades alcançadas"
              value={metrics?.cidades ?? 0}
              loading={loading}
              icon={<MapPin size={20} className="text-sky-600 dark:text-sky-400" />}
              iconColor="bg-sky-100 dark:bg-sky-900/40"
            />
          </div>

          {/* Faixa secundária — alcance e, logo em seguida, o que falta.
              Os dois últimos explicam por que os gráficos de cidade e bairro
              somam menos que o total de registros. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCompacto
              icon={<MapPin size={16} />}
              label="Zonas cobertas"
              valor={(metrics?.zonas ?? 0).toLocaleString('pt-BR')}
              loading={loading}
            />
            <StatCompacto
              icon={<ClipboardList size={16} />}
              label="Seções cobertas"
              valor={(metrics?.secoes ?? 0).toLocaleString('pt-BR')}
              loading={loading}
            />
            <StatCompacto
              icon={<ShieldCheck size={16} />}
              label="Localização validada"
              valor={`${percentualValidado}%`}
              detalhe={metrics ? `${metrics.validados} de ${metrics.total} na base do TRE-PI` : undefined}
              loading={loading}
            />
            <StatCompacto
              icon={<MapPinOff size={16} />}
              label="Sem zona e seção"
              valor={(cobertura?.sem_zona_secao ?? 0).toLocaleString('pt-BR')}
              detalhe="Planilha não informa"
              alerta={(cobertura?.sem_zona_secao ?? 0) > 0}
              loading={loading}
            />
            <StatCompacto
              icon={<SearchX size={16} />}
              label="Seção fora da base"
              valor={(cobertura?.secao_sem_base ?? 0).toLocaleString('pt-BR')}
              detalhe="Corrigível na planilha"
              alerta={(cobertura?.secao_sem_base ?? 0) > 0}
              loading={loading}
            />
          </div>

          {/* ── Bloco geográfico ────────────────────────────────────
              Do recorte fino para o amplo: primeiro onde a base está
              dentro da capital, depois o ranking entre municípios. */}
          <GeografiaCard
            capital={CAPITAL}
            bairros={bairros}
            municipios={interior}
            cobertura={cobertura}
            coberturaBairro={cobBairro}
            loading={loading}
          />

          <MunicipioRanking
            data={municipios}
            cobertura={cobertura}
            capital={CAPITAL}
            loading={loading}
          />

          {/* Evolução no tempo */}
          <TimelineChart
            data={serie}
            dias={dias}
            onDiasChange={setDias}
            loading={serieLoading}
          />

          {/* Est vem antes do ranking de vínculos porque é o corte mais grosso
              do mesmo conjunto: primeiro a divisão em dois, depois o detalhe
              liderança a liderança */}
          <EstBarra data={est} loading={loading} />

          {/* Vínculos ocupam a largura inteira: são 38 lideranças e a leitura
              depende de compará-las entre si, não de espremê-las numa coluna */}
          <VinculoRanking data={vinculos} loading={loading} />

          {/* Listas de apoio */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ZonaCoberturaCard data={zonas}      loading={loading} />
            <DuplicadosCard    data={duplicados} loading={loading} />
          </div>

          {/* Últimos registros */}
          <RegistrosTable compact limit={8} />
        </div>
      )}

      {tab === 'equipe' && ehAdmin && (
        <div className="animate-fade-in">
          <AgentesTable />
        </div>
      )}
    </AppShell>
  )
}

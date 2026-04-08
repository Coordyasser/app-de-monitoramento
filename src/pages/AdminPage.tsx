import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Activity,
  Clock, AlertTriangle,
} from 'lucide-react'
import { supabase }         from '@/lib/supabase'
import { AppShell }         from '@/components/layout/AppShell'
import { PageHeader }       from '@/components/ui'
import { MetricCard }       from '@/components/admin/MetricCard'
import { CategoryChart }    from '@/components/admin/CategoryChart'
import { MunicipioChart }   from '@/components/admin/MunicipioChart'
import { OcorrenciasTable } from '@/components/admin/OcorrenciasTable'
import { AgentesTable }     from '@/components/admin/AgentesTable'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface DashboardMetrics {
  total_hoje:     number
  total_ontem:    number
  pendentes:      number
  agentes_ativos: number
}

// ── Tabs ───────────────────────────────────────────────────────────────────

type Tab = 'painel' | 'agentes'

// ── Página ────────────────────────────────────────────────────────────────

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('painel')

  const [metrics,         setMetrics]         = useState<DashboardMetrics | null>(null)
  const [metricsLoading,  setMetricsLoading]  = useState(true)
  const [categorias,      setCategorias]      = useState<{ categoria: string; total: number }[]>([])
  const [catLoading,      setCatLoading]      = useState(true)
  const [municipios,      setMunicipios]      = useState<{ municipio: string; total: number }[]>([])
  const [munLoading,      setMunLoading]      = useState(true)

  // ── Busca das métricas ───────────────────────────────────────────────

  useEffect(() => {
    async function fetchAll() {
      // Métricas
      setMetricsLoading(true)
      const { data: mData } = await supabase.rpc('get_dashboard_metrics')
      if (mData) setMetrics(mData as unknown as DashboardMetrics)
      setMetricsLoading(false)

      // Categorias
      setCatLoading(true)
      const { data: cData } = await supabase.rpc('get_ocorrencias_por_categoria')
      if (cData) setCategorias(cData as { categoria: string; total: number }[])
      setCatLoading(false)

      // Municípios
      setMunLoading(true)
      const { data: mun } = await supabase.rpc('get_top_municipios', { limit_n: 10 })
      if (mun) setMunicipios(mun as { municipio: string; total: number }[])
      setMunLoading(false)
    }
    fetchAll()
  }, [])

  // Tendência % hoje vs. ontem
  function calcTrend(hoje: number, ontem: number): number {
    if (ontem === 0) return hoje > 0 ? 100 : 0
    return ((hoje - ontem) / ontem) * 100
  }

  return (
    <AppShell>
      <PageHeader
        title="Dashboard Administrativo"
        subtitle="Monitoramento em tempo real — Piauí"
        back="/"
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl glass w-fit mb-8">
        {([
          { key: 'painel',  label: 'Painel Principal', icon: LayoutDashboard },
          { key: 'agentes', label: 'Agentes & LGPD',   icon: Users           },
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

      {/* ── PAINEL PRINCIPAL ─────────────────────────────────────────────── */}
      {tab === 'painel' && (
        <div className="space-y-8 animate-fade-in">

          {/* Métricas de topo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              title="Ocorrências hoje"
              value={metrics?.total_hoje ?? 0}
              loading={metricsLoading}
              icon={<Activity size={20} className="text-indigo-600 dark:text-indigo-400" />}
              iconColor="bg-indigo-100 dark:bg-indigo-900/40"
              trend={metrics ? {
                value: calcTrend(metrics.total_hoje, metrics.total_ontem),
                label: 'vs. ontem',
              } : undefined}
            />
            <MetricCard
              title="Pendentes"
              value={metrics?.pendentes ?? 0}
              loading={metricsLoading}
              icon={<AlertTriangle size={20} className="text-amber-500" />}
              iconColor="bg-amber-100 dark:bg-amber-900/40"
              badge={
                !metricsLoading && (metrics?.pendentes ?? 0) > 0 ? (
                  <span className="badge-pendente animate-pulse-soft">Atenção</span>
                ) : undefined
              }
            />
            <MetricCard
              title="Agentes ativos (24h)"
              value={metrics?.agentes_ativos ?? 0}
              loading={metricsLoading}
              icon={<Clock size={20} className="text-emerald-600 dark:text-emerald-400" />}
              iconColor="bg-emerald-100 dark:bg-emerald-900/40"
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CategoryChart  data={categorias} loading={catLoading} />
            <MunicipioChart data={municipios} loading={munLoading} />
          </div>

          {/* Tabela em tempo real */}
          <OcorrenciasTable />
        </div>
      )}

      {/* ── AGENTES & LGPD ──────────────────────────────────────────────── */}
      {tab === 'agentes' && (
        <div className="animate-fade-in">
          <AgentesTable />
        </div>
      )}
    </AppShell>
  )
}

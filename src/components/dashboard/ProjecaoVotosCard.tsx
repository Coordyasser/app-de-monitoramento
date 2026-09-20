import { useState } from 'react'
import { Info, Minus, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatarNumero } from './viz'
import type { RegistrosMetrics } from '@/types/database.types'

interface Props {
  metrics:  RegistrosMetrics | null
  loading?: boolean
}

const HORIZONTES = [30, 60, 90]

/** Cada registro consolidado equivale a um voto projetado. */
function dataFutura(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ProjecaoVotosCard({ metrics, loading = false }: Props) {
  const [horizonte, setHorizonte] = useState(30)

  const confirmados = metrics?.total ?? 0
  // Ritmo dos últimos 7 dias — base da extrapolação linear
  const ritmoDia    = (metrics?.semana ?? 0) / 7
  const adicionais  = Math.round(ritmoDia * horizonte)
  const projetado   = confirmados + adicionais

  // Aceleração: ritmo da última semana contra a anterior
  const semana   = metrics?.semana ?? 0
  const anterior = metrics?.semana_anterior ?? 0
  const variacao = anterior === 0
    ? (semana > 0 ? 100 : 0)
    : ((semana - anterior) / anterior) * 100

  const semRitmo = ritmoDia === 0
  const pctConfirmado = projetado > 0 ? (confirmados / projetado) * 100 : 100

  const TendIcon = variacao === 0 ? Minus : variacao > 0 ? TrendingUp : TrendingDown
  const tendCor  = variacao === 0
    ? 'text-slate-400'
    : variacao > 0 ? 'text-emerald-500' : 'text-rose-500'

  return (
    <Card padding="lg" className="flex flex-col gap-5">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
            <Target size={20} className="text-indigo-600 dark:text-indigo-400" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Projeção de votos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cada registro consolidado equivale a um voto
            </p>
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-white/50 dark:bg-white/5">
          {HORIZONTES.map(h => (
            <button
              key={h}
              onClick={() => setHorizonte(h)}
              className={[
                'px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200',
                horizonte === h
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
              ].join(' ')}
            >
              +{h}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="h-12 w-52 rounded-lg bg-slate-200 dark:bg-white/10" />
          <div className="h-3 rounded-full bg-slate-100 dark:bg-white/5" />
          <div className="h-4 w-72 rounded bg-slate-100 dark:bg-white/5" />
        </div>
      ) : (
        <>
          {/* Número principal */}
          <div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
                {formatarNumero(projetado)}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                votos projetados até {dataFutura(horizonte)}
              </span>
            </div>
          </div>

          {/* Composição: confirmado x estimado.
              A faixa listrada marca a parte que ainda não existe. */}
          <div className="flex flex-col gap-2">
            <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-white/10 gap-[2px]">
              <div
                className="h-full rounded-l-full"
                style={{
                  width: `${Math.max(pctConfirmado, 2)}%`,
                  background: 'var(--viz-accent)',
                }}
              />
              {adicionais > 0 && (
                <div
                  className="h-full rounded-r-full flex-1"
                  style={{
                    background:
                      'repeating-linear-gradient(45deg, var(--viz-accent-soft) 0 6px, transparent 6px 12px)',
                    border: '1px solid var(--viz-accent-soft)',
                  }}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--viz-accent)' }} />
                <span className="text-slate-600 dark:text-slate-300">Confirmados</span>
                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {formatarNumero(confirmados)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    background:
                      'repeating-linear-gradient(45deg, var(--viz-accent-soft) 0 3px, transparent 3px 6px)',
                    border: '1px solid var(--viz-accent-soft)',
                  }}
                />
                <span className="text-slate-600 dark:text-slate-300">Estimados</span>
                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {formatarNumero(adicionais)}
                </span>
              </span>
            </div>
          </div>

          {/* Ritmo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="rounded-xl bg-white/50 dark:bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium">
                Ritmo atual
              </p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {ritmoDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> votos/dia</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                média dos últimos 7 dias
              </p>
            </div>

            <div className="rounded-xl bg-white/50 dark:bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-medium">
                Aceleração
              </p>
              <p className={`text-lg font-bold tabular-nums flex items-center gap-1.5 ${tendCor}`}>
                <TendIcon size={17} className="shrink-0" />
                {variacao === 0 ? 'estável' : `${Math.abs(variacao).toFixed(0)}%`}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {formatarNumero(semana)} nesta semana · {formatarNumero(anterior)} na anterior
              </p>
            </div>
          </div>

          {/* Metodologia — a projeção é uma extrapolação, não uma promessa */}
          <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400
                        border-t border-white/40 dark:border-white/10 pt-3">
            <Info size={13} className="mt-0.5 shrink-0" />
            {semRitmo
              ? 'Sem registros nos últimos 7 dias — não há ritmo para projetar, então a estimativa repete o total confirmado.'
              : `Extrapolação linear: mantido o ritmo dos últimos 7 dias, somam-se ${formatarNumero(adicionais)} votos em ${horizonte} dias. Não considera sazonalidade, meta de campanha nem duplicidade de contato.`}
          </p>
        </>
      )}
    </Card>
  )
}

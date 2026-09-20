import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card } from '@/components/ui'
import { ACCENT, ACCENT_SOFT, GRID, formatarNumero, tickStyle, tooltipStyle } from './viz'

interface Props {
  data:     { dia: string; total: number }[]
  dias:     number
  onDiasChange: (dias: number) => void
  loading?: boolean
}

const OPCOES_PERIODO = [7, 30, 90]

function rotuloDia(iso: string) {
  // `dia` vem como date puro (YYYY-MM-DD); o T12:00 evita o recuo de fuso
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit',
  })
}

export function TimelineChart({ data, dias, onDiasChange, loading = false }: Props) {
  const chartData = data.map(d => ({ ...d, rotulo: rotuloDia(d.dia) }))
  const totalPeriodo = data.reduce((acc, d) => acc + d.total, 0)

  // Um tick a cada N dias, para o eixo não virar uma parede de datas
  const passo = Math.max(1, Math.ceil(chartData.length / 8))
  const ticks = chartData.filter((_, i) => i % passo === 0).map(d => d.rotulo)

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Registros por dia
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {loading ? 'Carregando...' : `${formatarNumero(totalPeriodo)} no período`}
          </p>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-white/50 dark:bg-white/5">
          {OPCOES_PERIODO.map(opcao => (
            <button
              key={opcao}
              onClick={() => onDiasChange(opcao)}
              className={[
                'px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200',
                dias === opcao
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
              ].join(' ')}
            >
              {opcao}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[220px] rounded-xl bg-slate-100/70 dark:bg-white/5 animate-pulse" />
      ) : totalPeriodo === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Nenhum registro nos últimos {dias} dias
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="grad-registros" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={ACCENT} stopOpacity={0.28} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="rotulo"
              ticks={ticks}
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={44}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: ACCENT, strokeWidth: 1, strokeDasharray: '4 4' }}
              labelFormatter={(label) => `Dia ${label}`}
              formatter={(value) => [
                formatarNumero(Number(value ?? 0)),
                Number(value) === 1 ? 'registro' : 'registros',
              ]}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#grad-registros)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: ACCENT_SOFT }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

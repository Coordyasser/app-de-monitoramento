import {
  Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card } from '@/components/ui'
import { ACCENT, AXIS, formatarNumero, tickStyle, tooltipStyle } from './viz'

interface Props {
  data:     { cidade: string; total: number }[]
  loading?: boolean
}

const MAX_ROTULO = 16

export function CidadeChart({ data, loading = false }: Props) {
  const chartData = data.map(d => ({
    nome:  d.cidade.length > MAX_ROTULO ? `${d.cidade.slice(0, MAX_ROTULO - 1)}…` : d.cidade,
    completo: d.cidade,
    total: d.total,
  }))

  const altura = Math.max(220, chartData.length * 30)

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Votos por cidade
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Votos confirmados — um por registro consolidado
        </p>
      </div>

      {loading ? (
        <div className="h-[260px] flex flex-col justify-center gap-2.5 animate-pulse">
          {[88, 72, 64, 55, 48, 40, 33, 26].map((w, i) => (
            <div key={i} className="h-4 rounded bg-slate-100 dark:bg-white/10" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Sem dados ainda
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={altura}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
            barCategoryGap={6}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nome"
              width={118}
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: 'var(--viz-accent-soft)' }}
              formatter={(value, _nome, item) => [
                formatarNumero(Number(value ?? 0)),
                (item as { payload?: { completo?: string } }).payload?.completo ?? '',
              ]}
            />
            {/* Uma única matiz: a barra mede magnitude, não identidade */}
            <Bar dataKey="total" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={18}>
              <LabelList
                dataKey="total"
                position="right"
                offset={8}
                style={{ fontSize: 11, fill: AXIS, fontVariantNumeric: 'tabular-nums' }}
                formatter={(v) => formatarNumero(Number(v ?? 0))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

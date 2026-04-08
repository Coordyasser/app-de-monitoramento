import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Card } from '@/components/ui'

interface MunicipioChartProps {
  data:     { municipio: string; total: number }[]
  loading?: boolean
}

export function MunicipioChart({ data, loading = false }: MunicipioChartProps) {
  const chartData = data.map(d => ({
    name:  d.municipio.length > 14 ? d.municipio.substring(0, 13) + '…' : d.municipio,
    full:  d.municipio,
    value: d.total,
  }))

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        Top 10 Municípios — Ocorrências
      </h3>

      {loading ? (
        <div className="h-56 space-y-2 px-2 flex flex-col justify-end pb-4 animate-pulse">
          {[70, 55, 80, 40, 65, 45, 90, 30, 50, 35].map((h, i) => (
            <div key={i} className="h-5 rounded bg-slate-100 dark:bg-white/10" style={{ width: `${h}%` }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Sem dados ainda
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background:   'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
                border:       '1px solid rgba(0,0,0,0.08)',
                borderRadius: '12px',
                fontSize:     '12px',
              }}
              formatter={(value, _name, entry) => [
                Number(value ?? 0),
                (entry as { payload?: { full?: string } }).payload?.full ?? '',
              ]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={18}>
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={`hsl(${240 + i * 12}, 70%, ${60 - i * 2}%)`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

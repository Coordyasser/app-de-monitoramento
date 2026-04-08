import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui'
import type { OcorrenciaCategoria } from '@/types/database.types'

interface CategoryChartProps {
  data:     { categoria: string; total: number }[]
  loading?: boolean
}

const CATEGORIA_LABELS: Record<OcorrenciaCategoria, string> = {
  irregularidade_administrativa: 'Irr. Administrativa',
  problema_com_urna:             'Prob. com Urna',
  fila_aglomeracao:              'Fila / Aglomeração',
  acessibilidade:                'Acessibilidade',
  conduta_suspeita:              'Conduta Suspeita',
  outro:                         'Outro',
}

const COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#64748b', // slate
]

export function CategoryChart({ data, loading = false }: CategoryChartProps) {
  const chartData = data.map(d => ({
    name:  CATEGORIA_LABELS[d.categoria as OcorrenciaCategoria] ?? d.categoria,
    value: d.total,
  }))

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        Ocorrências por Categoria
      </h3>

      {loading ? (
        <div className="h-56 flex items-center justify-center">
          <div className="w-40 h-40 rounded-full border-8 border-slate-100 dark:border-white/10 animate-pulse" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Sem dados ainda
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background:   'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
                border:       '1px solid rgba(0,0,0,0.08)',
                borderRadius: '12px',
                fontSize:     '12px',
              }}
              formatter={(value) => [Number(value ?? 0), 'ocorrências']}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: '11px', color: '#64748b' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

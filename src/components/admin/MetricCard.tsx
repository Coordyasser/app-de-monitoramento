import { type ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@/components/ui'

interface MetricCardProps {
  title:       string
  value:       number | string
  icon:        ReactNode
  iconColor:   string
  trend?:      { value: number; label: string }   // % vs. período anterior
  badge?:      ReactNode
  loading?:    boolean
}

export function MetricCard({
  title, value, icon, iconColor, trend, badge, loading = false,
}: MetricCardProps) {
  const trendPositive = trend && trend.value > 0
  const trendNeutral  = trend && trend.value === 0

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${iconColor}`}>
          {icon}
        </div>
        {badge}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-8 w-24 bg-slate-200 dark:bg-white/10 rounded-lg" />
          <div className="h-3 w-32 bg-slate-100 dark:bg-white/5 rounded" />
        </div>
      ) : (
        <div>
          <p className="text-3xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
            {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            {trend && (
              <span className={[
                'flex items-center gap-0.5 text-xs font-semibold',
                trendNeutral  ? 'text-slate-400'
                : trendPositive ? 'text-emerald-500'
                : 'text-rose-500',
              ].join(' ')}>
                {trendNeutral
                  ? <Minus size={12} />
                  : trendPositive
                    ? <TrendingUp  size={12} />
                    : <TrendingDown size={12} />
                }
                {Math.abs(trend.value).toFixed(0)}% {trend.label}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

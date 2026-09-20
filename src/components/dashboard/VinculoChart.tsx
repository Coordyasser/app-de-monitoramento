import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from '@/components/ui'
import { MAX_CATEGORIAS, OUTROS, SERIES, formatarNumero, tooltipStyle } from './viz'

interface Props {
  data:     { vinculo: string; total: number }[]
  loading?: boolean
}

interface Fatia {
  nome:  string
  total: number
  cor:   string
}

/**
 * `vinculo` é campo livre: a cauda longa vira uma fatia "Outros" em vez de
 * gerar cores novas — a ordem dos slots categóricos nunca é ciclada.
 */
function montarFatias(data: { vinculo: string; total: number }[]): Fatia[] {
  const principais: Fatia[] = data.slice(0, MAX_CATEGORIAS).map((d, i) => ({
    nome:  d.vinculo,
    total: d.total,
    cor:   SERIES[i],
  }))

  const resto = data.slice(MAX_CATEGORIAS).reduce((acc, d) => acc + d.total, 0)
  if (resto > 0) {
    principais.push({ nome: 'Outros', total: resto, cor: OUTROS })
  }
  return principais
}

export function VinculoChart({ data, loading = false }: Props) {
  const fatias = montarFatias(data)
  const total  = fatias.reduce((acc, f) => acc + f.total, 0)

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Distribuição por vínculo
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Campo livre, agrupado sem diferenciar acento ou caixa
        </p>
      </div>

      {loading ? (
        <div className="h-[230px] flex items-center justify-center">
          <div className="w-36 h-36 rounded-full border-[14px] border-slate-100 dark:border-white/10 animate-pulse" />
        </div>
      ) : total === 0 ? (
        <div className="h-[230px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Sem dados ainda
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Rosca */}
          <div className="relative w-[190px] h-[190px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fatias}
                  dataKey="total"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="none"
                >
                  {fatias.map(f => <Cell key={f.nome} fill={f.cor} />)}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, nome) => [
                    `${formatarNumero(Number(value ?? 0))} (${Math.round((Number(value) / total) * 100)}%)`,
                    String(nome),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Total no centro da rosca */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
                {formatarNumero(total)}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                registros
              </span>
            </div>
          </div>

          {/* Legenda com rótulo e valor visíveis — identidade nunca só pela cor */}
          <ul className="flex-1 w-full flex flex-col gap-1.5 min-w-0">
            {fatias.map(f => (
              <li key={f.nome} className="flex items-center gap-2.5 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: f.cor }}
                />
                <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                  {f.nome}
                </span>
                <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                  {formatarNumero(f.total)}
                </span>
                <span className="tabular-nums text-xs text-slate-400 dark:text-slate-500 w-10 text-right">
                  {Math.round((f.total / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

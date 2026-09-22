import { Card } from '@/components/ui'
import { SERIES, OUTROS, formatarNumero } from './viz'

export interface EstContagem {
  ana:    number
  gil:    number
  branco: number
}

interface Props {
  data:     EstContagem | null
  loading?: boolean
}

// Cor por entidade, em ordem fixa — Ana e Gil não trocam de cor quando um
// passa o outro. "Em branco" usa o slot recessivo, que é ausência, não uma
// terceira categoria.
const FATIAS = [
  { chave: 'ana',    rotulo: 'Ana',       cor: SERIES[0] },
  { chave: 'gil',    rotulo: 'Gil',       cor: SERIES[1] },
  { chave: 'branco', rotulo: 'Em branco', cor: OUTROS     },
] as const

/** Abaixo disso o rótulo dentro da fatia não cabe e sai; a legenda o carrega. */
const LARGURA_MINIMA_ROTULO = 14

/**
 * Est em uma barra proporcional.
 *
 * São duas categorias que somam o total: o que interessa é a divisão entre
 * elas, não o valor absoluto de cada uma — e para isso uma barra só,
 * segmentada, lê mais rápido que duas barras lado a lado. A fatia em branco
 * aparece apenas se existir, porque depois do preenchimento ela é zero e uma
 * legenda com zero só ocupa espaço.
 */
export function EstBarra({ data, loading = false }: Props) {
  const total = data ? data.ana + data.gil + data.branco : 0

  const fatias = FATIAS
    .map(f => ({ ...f, total: data?.[f.chave] ?? 0 }))
    .filter(f => f.total > 0)
    .map(f => ({ ...f, pct: total > 0 ? (f.total / total) * 100 : 0 }))

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Registros por Est
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Divisão da base inteira entre os dois responsáveis
          </p>
        </div>
        {!loading && total > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatarNumero(total)} registros
          </span>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-10 rounded-full bg-slate-200/70 dark:bg-white/10" />
          <div className="h-3 w-56 rounded bg-slate-200/70 dark:bg-white/10" />
        </div>
      ) : total === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Nenhum registro com Est preenchido ainda.
        </p>
      ) : (
        <>
          {/* A barra: cantos arredondados nas pontas, e 2px de trilho entre as
              fatias para a divisa não depender só da diferença de cor. */}
          <div className="flex h-10 w-full gap-[2px] rounded-full overflow-hidden
                          bg-slate-200/60 dark:bg-white/10">
            {fatias.map(f => (
              <div
                key={f.chave}
                style={{ width: `${f.pct}%`, background: f.cor }}
                title={`${f.rotulo}: ${formatarNumero(f.total)} registros (${f.pct.toFixed(1).replace('.', ',')}%)`}
                className="flex items-center justify-center min-w-0
                           transition-[width] duration-500 ease-out"
              >
                {f.pct >= LARGURA_MINIMA_ROTULO && (
                  <span className="px-2 truncate text-xs font-semibold text-white/95 tabular-nums">
                    {f.rotulo} · {f.pct.toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Legenda: a identidade nunca depende só da cor, e é aqui que o
              número absoluto aparece — dentro da fatia só cabe o percentual. */}
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {fatias.map(f => (
              <li key={f.chave} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: f.cor }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {f.rotulo}
                </span>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-100 tabular-nums">
                  {formatarNumero(f.total)}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                  {f.pct.toFixed(1).replace('.', ',')}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

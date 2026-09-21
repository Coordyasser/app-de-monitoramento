import { type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatarNumero } from './viz'

export interface ItemRanking {
  chave:     string
  rotulo:    string
  total:     number
  /** Texto curto à direita da barra, ex.: "12 seções" */
  detalhe?:  string
  /** Elemento no fim da linha, ex.: selo de validação */
  selo?:     ReactNode
  /** Põe o rótulo em negrito — para a capital, por exemplo */
  destaque?: boolean
}

interface Props {
  titulo:     string
  subtitulo?: string
  /** Canto superior direito, normalmente um resumo do conjunto */
  resumo?:    ReactNode
  itens:      ItemRanking[]
  /** Denominador do percentual. Raramente é a soma bruta de tudo. */
  base:       number
  colunas?:   1 | 2
  loading?:   boolean
  vazio?:     string
  rodape?:    ReactNode
}

/**
 * Ranking com barra proporcional.
 *
 * Existe porque gráfico de barras convencional falha nos dois conjuntos que
 * este dashboard precisa mostrar: quando um item concentra quase tudo, os
 * demais viram traços de um pixel; e quando há dezenas de itens, a altura
 * necessária inviabiliza a leitura. Aqui o número continua legível como
 * texto, a barra serve só para a proporção, e duas colunas cortam a altura
 * pela metade.
 */
export function RankingBarras({
  titulo, subtitulo, resumo, itens, base,
  colunas = 2, loading = false, vazio = 'Sem dados ainda', rodape,
}: Props) {
  const maior = itens.reduce((m, i) => Math.max(m, i.total), 0)
  const grade = colunas === 2 ? 'grid-cols-1 lg:grid-cols-2 gap-x-8' : 'grid-cols-1'

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {titulo}
          </h3>
          {subtitulo && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitulo}</p>
          )}
        </div>
        {!loading && resumo && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {resumo}
          </div>
        )}
      </div>

      {loading ? (
        <div className={`grid ${grade} gap-y-3 animate-pulse`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 flex-1 rounded bg-slate-100 dark:bg-white/10" />
              <div className="h-3 w-10 rounded bg-slate-100 dark:bg-white/10" />
            </div>
          ))}
        </div>
      ) : itens.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
          {vazio}
        </div>
      ) : (
        <ol className={`grid ${grade} gap-y-1`}>
          {itens.map((item, i) => {
            const proporcao  = maior > 0 ? (item.total / maior) * 100 : 0
            const percentual = base  > 0 ? (item.total / base)  * 100 : 0

            return (
              <li key={item.chave} className="py-1.5">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[11px] tabular-nums text-slate-300 dark:text-slate-600 w-5 shrink-0">
                    {i + 1}
                  </span>
                  <span
                    className={[
                      'text-[13px] truncate',
                      item.destaque
                        ? 'font-semibold text-slate-800 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-300',
                    ].join(' ')}
                    title={item.rotulo}
                  >
                    {item.rotulo}
                  </span>

                  <span className="flex-1" />

                  <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatarNumero(item.total)}
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 w-11 text-right shrink-0">
                    {percentual.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center gap-2 pl-7">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-white/[0.07] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        // Piso de 1.5% para o item menor não sumir da tela
                        width: `${Math.max(proporcao, 1.5)}%`,
                        background: 'var(--viz-accent)',
                      }}
                    />
                  </div>
                  {item.detalhe && (
                    <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                      {item.detalhe}
                    </span>
                  )}
                  {item.selo}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {!loading && rodape && (
        <div className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed
                        text-slate-400 dark:text-slate-500
                        border-t border-white/40 dark:border-white/10">
          <Info size={12} className="mt-1.5 shrink-0" />
          <p className="pt-1">{rodape}</p>
        </div>
      )}
    </Card>
  )
}

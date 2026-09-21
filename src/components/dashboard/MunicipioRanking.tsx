import { Info, MapPin, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatarNumero } from './viz'
import type { CoberturaGeografica, Municipio } from './GeografiaCard'

interface Props {
  data:      Municipio[]
  cobertura: CoberturaGeografica | null
  capital:   string
  loading?:  boolean
}

/**
 * Ranking por município.
 *
 * Gráfico de barras não serve aqui: a capital concentra a base e o interior
 * some em traços de um pixel. A lista mantém cada número legível como texto,
 * e a barra vira só a leitura rápida da proporção.
 */
export function MunicipioRanking({ data, cobertura, capital, loading = false }: Props) {
  const maior = data.reduce((m, d) => Math.max(m, d.total), 0)
  // Denominador é o que está localizado, não o total bruto: registro sem
  // cidade não pertence a município nenhum e distorceria os percentuais.
  const baseLocalizada = data.reduce((s, d) => s + d.total, 0)

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Ranking por município
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Onde a base está concentrada, capital incluída
          </p>
        </div>
        {!loading && cobertura && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <MapPin size={13} className="text-slate-400 dark:text-slate-500" />
            {formatarNumero(cobertura.municipios)} municípios ·{' '}
            {formatarNumero(baseLocalizada)} registros localizados
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3 animate-pulse">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 flex-1 rounded bg-slate-100 dark:bg-white/10" />
              <div className="h-3 w-10 rounded bg-slate-100 dark:bg-white/10" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
          Nenhum registro com município identificado.
        </div>
      ) : (
        <ol className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1">
          {data.map((m, i) => {
            const proporcao  = maior > 0 ? (m.total / maior) * 100 : 0
            const percentual = baseLocalizada > 0 ? (m.total / baseLocalizada) * 100 : 0
            const ehCapital  = m.municipio.toUpperCase() === capital.toUpperCase()
            // Quantos daquele município a base oficial confirmou
            const validado   = m.total > 0 ? Math.round((m.validados / m.total) * 100) : 0

            return (
              <li key={m.municipio} className="group py-1.5">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[11px] tabular-nums text-slate-300 dark:text-slate-600 w-5 shrink-0">
                    {i + 1}
                  </span>
                  <span className={[
                    'text-sm truncate',
                    ehCapital
                      ? 'font-semibold text-slate-800 dark:text-slate-100'
                      : 'text-slate-600 dark:text-slate-300',
                  ].join(' ')}>
                    {m.municipio}
                  </span>

                  <span className="flex-1" />

                  <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatarNumero(m.total)}
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
                        width: `${Math.max(proporcao, 1.5)}%`,
                        background: 'var(--viz-accent)',
                      }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                    {formatarNumero(m.secoes)} {m.secoes === 1 ? 'seção' : 'seções'}
                  </span>
                  {validado === 100 ? (
                    <ShieldCheck size={11} className="text-emerald-500 shrink-0" />
                  ) : (
                    <span className="text-[11px] tabular-nums text-amber-500 shrink-0 w-8 text-right">
                      {validado}%
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {!loading && cobertura && cobertura.sem_localizacao > 0 && (
        <div className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed
                        text-slate-400 dark:text-slate-500 border-t border-white/40 dark:border-white/10">
          <Info size={12} className="mt-1.5 shrink-0" />
          <p className="pt-1">
            Fora do ranking: {formatarNumero(cobertura.sem_localizacao)} registros sem
            cidade informada na planilha de origem. O escudo indica município com
            100% das seções conferidas na base do TRE-PI.
          </p>
        </div>
      )}
    </Card>
  )
}

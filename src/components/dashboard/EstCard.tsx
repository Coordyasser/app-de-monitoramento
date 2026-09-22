import { numero, pct } from './formato'

export interface EstContagem {
  ana:    number
  gil:    number
  branco: number
}

interface Props {
  data:     EstContagem | null
  loading?: boolean
}

// Cor por responsável, em ordem fixa — Ana e Gil não trocam de cor quando um
// passa o outro. "Em branco" usa a tinta recessiva: é ausência, não um
// terceiro responsável.
const FATIAS = [
  { chave: 'ana',    rotulo: 'Ana',       cor: 'var(--est-a)' },
  { chave: 'gil',    rotulo: 'Gil',       cor: 'var(--est-b)' },
  { chave: 'branco', rotulo: 'Em branco', cor: 'var(--ink-3)' },
] as const

/** Abaixo disso o nome não cabe dentro da fatia; a lista abaixo o carrega. */
const LARGURA_MINIMA_ROTULO = 12

/**
 * Divisão da base entre os responsáveis.
 *
 * Duas categorias que somam o total: o que interessa é a proporção, não o
 * valor isolado de cada uma. A fatia em branco só aparece se existir — hoje é
 * zero, e reaparece sozinha se um registro novo entrar sem Est.
 */
export function EstCard({ data, loading = false }: Props) {
  const total = data ? data.ana + data.gil + data.branco : 0

  const fatias = FATIAS
    .map(f => ({ ...f, total: data?.[f.chave] ?? 0 }))
    .filter(f => f.total > 0)
    .map(f => ({ ...f, pct: total > 0 ? (f.total / total) * 100 : 0 }))

  return (
    <article className="card span-4">
      <div className="card-head">
        <div>
          <h2 className="card-title">Registros por Est</h2>
          <p className="card-sub">
            {loading || total === 0
              ? 'Divisão dos registros entre os responsáveis'
              : `Divisão dos ${numero(total)} registros entre os responsáveis`}
          </p>
        </div>
      </div>

      {loading ? (
        <>
          <div className="skel" style={{ height: 40, borderRadius: 12 }} />
          <div className="est-rows">
            {[0, 1].map(i => <div key={i} className="skel skel-line" style={{ height: 34 }} />)}
          </div>
        </>
      ) : total === 0 ? (
        <p className="card-sub">Nenhum registro com Est preenchido ainda.</p>
      ) : (
        <>
          <div
            className="est-split"
            role="img"
            aria-label={fatias.map(f => `${f.rotulo}: ${numero(f.total)} registros`).join(', ')}
          >
            {fatias.map(f => (
              <div
                key={f.chave}
                style={{ width: `${f.pct}%`, background: f.cor }}
                title={`${f.rotulo}: ${numero(f.total)} registros`}
              >
                {f.pct >= LARGURA_MINIMA_ROTULO && f.rotulo}
              </div>
            ))}
          </div>

          <div className="est-rows">
            {fatias.map(f => (
              <div key={f.chave} className="est-row">
                <span className="swatch" style={{ background: f.cor, margin: 0 }} aria-hidden="true" />
                <div>
                  <div className="est-name">{f.rotulo}</div>
                  <div className="est-hint">
                    {numero(Math.round(f.pct))} de cada 100 registros da base
                  </div>
                </div>
                <div className="est-val">
                  <span className="num">{numero(f.total)}</span>
                  <span className="num">{pct(f.pct)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </article>
  )
}

import { Link } from 'react-router-dom'
import { capitalizarLugar, ehNaoConsta } from '@/lib/texto'
import { nomeProprio, numero } from './formato'

// ── Cobertura por zona ─────────────────────────────────────────────────────

export interface ZonaCobertura {
  cidade: string
  zona:   string
  secoes: number
  total:  number
}

/**
 * Cobertura por zona.
 *
 * As linhas sem cidade ou sem zona ficam em laranja e dizem o que falta em vez
 * de estampar "NÃO CONSTA": a sentinela é linguagem de planilha, e quem lê o
 * dashboard precisa saber que aquilo é trabalho pendente, não um lugar.
 */
export function ZonaCoberturaCard({ data, loading }: { data: ZonaCobertura[]; loading: boolean }) {
  const maior = Math.max(1, ...data.map(z => z.total))
  const incompletos = data
    .filter(z => ehNaoConsta(z.cidade) || ehNaoConsta(z.zona))
    .reduce((s, z) => s + z.total, 0)

  return (
    <article className="card span-6">
      <div className="card-head">
        <div>
          <h2 className="card-title">Cobertura por zona</h2>
          <p className="card-sub">Onde a equipe está alcançando</p>
        </div>
      </div>

      {loading ? (
        <div className="zone-rows">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel skel-line" style={{ height: 34, margin: '10px 0' }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="card-sub">Nenhuma zona coberta ainda.</p>
      ) : (
        <>
          <div className="zone-head">
            <span>Cidade e zona</span>
            <span>Seções</span>
            <span />
            <span>Reg.</span>
          </div>

          <div className="zone-rows">
            {data.map((z, i) => {
              const semCidade = ehNaoConsta(z.cidade)
              const semZona   = ehNaoConsta(z.zona)
              const alerta    = semCidade || semZona
              const cidade    = semCidade ? 'Cidade não informada' : capitalizarLugar(z.cidade)
              const sub       = semZona ? 'Zona não informada' : `Zona ${z.zona}`
              return (
                <div key={`${z.cidade}-${z.zona}-${i}`} className={`zone-row${alerta ? ' flag' : ''}`}>
                  <div className="zone-place">
                    <span className="zone-chip">{semZona ? '?' : `Z${z.zona}`}</span>
                    <div className="zone-place-text">
                      <span className="zone-city ellipsis">{cidade}</span>
                      <span className="zone-sub">{sub}</span>
                    </div>
                  </div>
                  <span className="sec">{numero(z.secoes)}</span>
                  <div
                    className="track thin"
                    role="img"
                    aria-label={`${cidade}, ${sub}: ${numero(z.total)} registros`}
                  >
                    <div className="fill" style={{ width: `${(z.total / maior * 100).toFixed(1)}%` }} />
                  </div>
                  <span className="reg">{numero(z.total)}</span>
                </div>
              )
            })}
          </div>

          <div className="card-foot">
            {incompletos > 0 ? (
              <span>
                <strong>{numero(incompletos)}</strong> registros sem cidade ou zona aparecem em
                laranja. <Link to="/registros">Completar dados</Link>
              </span>
            ) : (
              <span>Todos os registros têm cidade e zona informadas.</span>
            )}
          </div>
        </>
      )}
    </article>
  )
}

// ── Contatos repetidos ─────────────────────────────────────────────────────

export interface Duplicado {
  contato:    string
  repeticoes: number
  nomes:      string[]
  ultimo:     string
}

/** 4 ou mais é vermelho, 3 é laranja, 2 é neutro. */
function classeContagem(n: number) {
  if (n >= 4) return 'count-badge hi'
  if (n === 3) return 'count-badge mid'
  return 'count-badge'
}

export function DuplicadosCard({ data, loading }: { data: Duplicado[]; loading: boolean }) {
  const atingidos = data.reduce((s, d) => s + d.repeticoes, 0)

  return (
    <article className="card span-6">
      <div className="card-head">
        <div>
          <h2 className="card-title">Contatos repetidos</h2>
          <p className="card-sub">
            {loading
              ? 'Mesmo telefone ou e-mail em mais de um registro'
              : `${numero(data.length)} contatos repetidos em ${numero(atingidos)} registros`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="dups">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skel skel-line" style={{ height: 40, margin: '11px 0' }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="card-sub">Nenhuma repetição encontrada.</p>
      ) : (
        <div className="dups">
          {data.map(d => (
            <div key={d.contato} className="dup">
              <span className="dup-phone">{d.contato}</span>
              <span
                className={classeContagem(d.repeticoes)}
                title={`${d.repeticoes} registros com este contato`}
              >
                {d.repeticoes}×
              </span>
              <div className="dup-names">
                {d.nomes.map(n => (
                  <span key={n} className="name-chip" title={nomeProprio(n)}>
                    {nomeProprio(n)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

import { useState } from 'react'
import { iniciais, nomeProprio, numero, pad2, paletaPara, pct } from './formato'

export interface Vinculo { vinculo: string; total: number }

interface Props {
  data:     Vinculo[]
  loading?: boolean
}

const VISIVEIS = 20

/**
 * Distribuição por vínculo.
 *
 * Era uma rosca com as 12 maiores e uma fatia "Outros", que escondia dois
 * terços das lideranças. Aqui aparecem todas, em duas colunas, com a média
 * marcada em cada barra — é ela que responde a pergunta real do cartão, que
 * não é "quanto tem fulano" e sim "quem está acima ou abaixo do esperado".
 */
export function VinculoRanking({ data, loading = false }: Props) {
  const [verTodos, setVerTodos] = useState(false)

  const total  = data.reduce((s, d) => s + d.total, 0)
  const media  = data.length > 0 ? total / data.length : 0
  const maior  = Math.max(1, ...data.map(d => d.total))
  const lista  = verTodos ? data : data.slice(0, VISIVEIS)
  const marcaMedia = `${(media / maior * 100).toFixed(1)}%`

  return (
    <article className="card span-12">
      <div className="card-head">
        <div>
          <h2 className="card-title">Registros por vínculo</h2>
          <p className="card-sub">
            Lideranças ordenadas por volume. {numero(data.length)} vínculos, média de{' '}
            {media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} registros
          </p>
        </div>
        <div className="people-legend">
          <span><span className="dashline" aria-hidden="true" /> média</span>
          <span><span className="badge">2× média</span> acima do dobro</span>
        </div>
      </div>

      {loading ? (
        <div className="people">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skel skel-line" style={{ height: 40, margin: '9px 0' }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="card-sub">Nenhum vínculo registrado ainda.</p>
      ) : (
        <>
          <div className="people">
            {lista.map((v, i) => {
              const nome = nomeProprio(v.vinculo)
              const [fundo, tinta] = paletaPara(v.vinculo)
              return (
                <div key={v.vinculo} className="person">
                  <span className="rank">{pad2(i + 1)}</span>
                  <span className="avatar" style={{ background: fundo, color: tinta }} aria-hidden="true">
                    {iniciais(v.vinculo)}
                  </span>
                  <div className="person-main">
                    <div className="person-name">
                      <span title={nome}>{nome}</span>
                      {v.total > media * 2 && <span className="badge">2× média</span>}
                    </div>
                    <div
                      className="track"
                      role="img"
                      aria-label={`${nome}: ${numero(v.total)} registros, ${pct(total > 0 ? v.total / total * 100 : 0)} do total`}
                    >
                      <div className="fill" style={{ width: `${(v.total / maior * 100).toFixed(1)}%` }} />
                      <div className="avg-mark" style={{ left: marcaMedia }} aria-hidden="true" />
                    </div>
                  </div>
                  <div className="person-val">
                    <span className="num">{numero(v.total)}</span>
                    <span className="num">{pct(total > 0 ? v.total / total * 100 : 0)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {data.length > VISIVEIS && (
            <button type="button" className="btn show-more" onClick={() => setVerTodos(v => !v)}>
              {verTodos ? 'Mostrar menos' : `Ver todos os ${numero(data.length)} vínculos`}
            </button>
          )}

          <div className="card-foot">
            <span>
              O percentual é sobre os <strong>{numero(total)}</strong> registros com vínculo
              informado. Variações do mesmo nome são agrupadas ignorando acento e caixa.
            </span>
          </div>
        </>
      )}
    </article>
  )
}

import { useState } from 'react'
import { iniciais, nomeProprio, numero, pad2, paletaPara, pct } from './formato'

export interface Vinculo { vinculo: string; total: number }

/** Os mesmos vínculos, recortados por Est. */
export interface VinculosPorEst {
  Gil: Vinculo[]
  Ana: Vinculo[]
  SEM: Vinculo[]
}

type Visao = 'todos' | keyof VinculosPorEst

interface Props {
  data:     Vinculo[]
  /** Ausente quando o dashboard já está recortado por um Est só. */
  porEst?:  VinculosPorEst | null
  loading?: boolean
}

const VISIVEIS = 20
/** Em "Todos" cada lado é uma coluna só: metade das linhas por lado. */
const VISIVEIS_POR_LADO = 10

// Mesmas cores do cartão de Est: a liderança de Gil tem a cor de Gil lá e aqui.
const VISOES: { chave: Visao; rotulo: string; cor?: string }[] = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'Gil',   rotulo: 'Gil',       cor: 'var(--est-b)' },
  { chave: 'Ana',   rotulo: 'Ana',       cor: 'var(--est-a)' },
  { chave: 'SEM',   rotulo: 'Em branco', cor: 'var(--ink-3)' },
]

const soma = (l: Vinculo[]) => l.reduce((s, d) => s + d.total, 0)
const fmtMedia = (m: number) => m.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

interface PessoasProps {
  lista: Vinculo[]
  /** Base do percentual e da média: o conjunto a que a lista pertence. */
  total: number
  media: number
  /** Maior valor da escala — em "Todos", o mesmo dos dois lados. */
  maior: number
  cor?:  string
}

function Pessoas({ lista, total, media, maior, cor }: PessoasProps) {
  const marcaMedia = `${(media / maior * 100).toFixed(1)}%`
  return (
    <>
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
                <div className="fill" style={{ width: `${(v.total / maior * 100).toFixed(1)}%`, background: cor }} />
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
    </>
  )
}

/**
 * Distribuição por vínculo.
 *
 * Era uma rosca com as 12 maiores e uma fatia "Outros", que escondia dois
 * terços das lideranças. Aqui aparecem todas, em duas colunas, com a média
 * marcada em cada barra — é ela que responde a pergunta real do cartão, que
 * não é "quanto tem fulano" e sim "quem está acima ou abaixo do esperado".
 */
export function VinculoRanking({ data: todos, porEst, loading = false }: Props) {
  const [verTodos, setVerTodos] = useState(false)
  const [visao,    setVisao]    = useState<Visao>('todos')

  // "Em branco" só aparece se existir registro sem Est, como no cartão de Est.
  const visoes = porEst
    ? VISOES.filter(v => v.chave !== 'SEM' || porEst.SEM.length > 0)
    : []
  const atual: Visao = porEst ? visao : 'todos'
  const data  = atual === 'todos' || !porEst ? todos : porEst[atual]
  const cor   = VISOES.find(v => v.chave === atual)?.cor

  const total  = soma(data)
  const media  = data.length > 0 ? total / data.length : 0
  const maior  = Math.max(1, ...data.map(d => d.total))
  const lista  = verTodos ? data : data.slice(0, VISIVEIS)

  // "Todos" com a separação disponível: Gil de um lado, Ana do outro. A
  // escala das barras é a mesma nos dois, para os lados serem comparáveis;
  // média e percentual são de cada lado.
  const lados = atual === 'todos' && porEst
    ? (['Gil', 'Ana'] as const).map(chave => {
        const itens = porEst[chave]
        const tot   = soma(itens)
        return {
          chave, itens, total: tot,
          media: itens.length > 0 ? tot / itens.length : 0,
          cor:   VISOES.find(v => v.chave === chave)?.cor,
        }
      })
    : null
  const maiorLados = lados ? Math.max(1, ...lados.flatMap(l => l.itens.map(d => d.total))) : 1
  const maisLongo  = lados ? Math.max(...lados.map(l => l.itens.length)) : 0
  const semEst     = porEst ? soma(porEst.SEM) : 0

  return (
    <article className="card span-12">
      <div className="card-head">
        <div>
          <h2 className="card-title">Registros por vínculo</h2>
          <p className="card-sub">
            Lideranças ordenadas por volume. {numero(data.length)} vínculos, média de{' '}
            {fmtMedia(media)} registros
          </p>
        </div>
        {porEst && (
          <div className="segmented" role="group" aria-label="Separar vínculos por Est">
            {visoes.map(v => (
              <button
                key={v.chave}
                type="button"
                aria-pressed={v.chave === atual}
                onClick={() => { setVisao(v.chave); setVerTodos(false) }}
              >
                {v.cor && <span className="est-dot" style={{ background: v.cor }} aria-hidden="true" />}
                {v.rotulo}
                <span className="num seg-count">
                  {numero(v.chave === 'todos' ? soma(todos) : soma(porEst[v.chave]))}
                </span>
              </button>
            ))}
          </div>
        )}
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
        <p className="card-sub">
          {atual === 'todos' ? 'Nenhum vínculo registrado ainda.' : 'Nenhum vínculo com este Est.'}
        </p>
      ) : lados ? (
        <>
          <div className="vinc-split">
            {lados.map(l => (
              <section key={l.chave} className="vinc-col" aria-label={`Vínculos de ${l.chave}`}>
                <header className="vinc-col-head">
                  <span className="est-dot" style={{ background: l.cor }} aria-hidden="true" />
                  <strong>{l.chave}</strong>
                  <span className="vinc-col-meta">
                    <span className="num">{numero(l.total)}</span> registros ·{' '}
                    {numero(l.itens.length)} vínculos · média {fmtMedia(l.media)}
                  </span>
                </header>
                {l.itens.length === 0 ? (
                  <p className="card-sub">Nenhum vínculo com este Est.</p>
                ) : (
                  <div className="people one-col">
                    <Pessoas
                      lista={verTodos ? l.itens : l.itens.slice(0, VISIVEIS_POR_LADO)}
                      total={l.total}
                      media={l.media}
                      maior={maiorLados}
                      cor={l.cor}
                    />
                  </div>
                )}
              </section>
            ))}
          </div>

          {maisLongo > VISIVEIS_POR_LADO && (
            <button type="button" className="btn show-more" onClick={() => setVerTodos(v => !v)}>
              {verTodos ? 'Mostrar menos' : 'Ver todos os vínculos de Gil e Ana'}
            </button>
          )}

          <div className="card-foot">
            <span>
              Cada lado mostra o percentual sobre os registros do próprio Est; as barras
              usam a mesma escala, para os dois lados serem comparáveis.
              {semEst > 0 && <> <strong>{numero(semEst)}</strong> registros sem Est ficam fora desta divisão.</>}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="people">
            <Pessoas lista={lista} total={total} media={media} maior={maior} cor={cor} />
          </div>

          {data.length > VISIVEIS && (
            <button type="button" className="btn show-more" onClick={() => setVerTodos(v => !v)}>
              {verTodos ? 'Mostrar menos' : `Ver todos os ${numero(data.length)} vínculos`}
            </button>
          )}

          <div className="card-foot">
            <span>
              O percentual é sobre os <strong>{numero(total)}</strong> registros com vínculo
              informado{atual === 'todos' ? '' : ` e Est ${atual === 'SEM' ? 'em branco' : atual}`}. Variações do mesmo nome são agrupadas ignorando acento e caixa.
            </span>
          </div>
        </>
      )}
    </article>
  )
}

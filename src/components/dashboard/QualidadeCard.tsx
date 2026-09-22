import { Link } from 'react-router-dom'
import { numero, pct } from './formato'
import type { CoberturaGeografica } from './tipos'

interface Props {
  cobertura: CoberturaGeografica | null
  loading?:  boolean
}

/**
 * Base de registros numa barra só.
 *
 * Eram três cards soltos — 59%, 256, 13 — que não diziam ser partes de um
 * mesmo inteiro. Empilhados, a soma é visível e as proporções se comparam
 * sem aritmética mental.
 *
 * Os três grupos vêm de `get_cobertura_geografica` e fecham o total: o
 * localizado é o que sobra depois de tirar quem nunca teve zona e seção e
 * quem tem o par fora da base oficial.
 */
export function QualidadeCard({ cobertura, loading = false }: Props) {
  if (loading || !cobertura) {
    return (
      <article className="card span-8">
        <div className="card-head">
          <div><h2 className="card-title">Base de Registros</h2></div>
        </div>
        <div className="skel" style={{ height: 14, borderRadius: 999 }} />
        <div className="legend">
          {[0, 1, 2].map(i => <div key={i} className="skel skel-line" style={{ height: 44 }} />)}
        </div>
      </article>
    )
  }

  const total     = cobertura.total
  const validos   = total - cobertura.sem_localizacao
  const semZona   = cobertura.sem_zona_secao
  const foraBase  = cobertura.secao_sem_base
  const proporcao = (v: number) => (total > 0 ? `${(v / total * 100).toFixed(1)}%` : '0%')

  return (
    <article className="card span-8">
      <div className="card-head">
        <div>
          <h2 className="card-title">Base de Registros</h2>
          <p className="card-sub">
            Como os {numero(total)} registros se distribuem após o cruzamento com a base do TRE-PI
          </p>
        </div>
        <div className="quality-score">
          <span className="num">{total > 0 ? Math.round(validos / total * 100) : 0}%</span>
          <span>localizados</span>
        </div>
      </div>

      <div
        className="stack"
        role="img"
        aria-label={`${numero(validos)} localizados, ${numero(semZona)} sem zona e seção, ${numero(foraBase)} com seção fora da base`}
      >
        <div style={{ width: proporcao(validos),  background: 'var(--accent)' }} />
        <div style={{ width: proporcao(semZona),  background: 'var(--warn)' }} />
        <div style={{ flex: 1, background: 'var(--danger)' }} />
      </div>

      <div className="legend">
        <ItemLegenda
          cor="var(--accent)" valor={validos} rotulo="Localizados"
          descricao="Cidade identificada, entram nas visões por município e bairro."
        />
        <ItemLegenda
          cor="var(--warn)" valor={semZona} rotulo="Sem zona e seção"
          descricao="Sem Cidade informada/localizada."
        />
        <ItemLegenda
          cor="var(--danger)" valor={foraBase} rotulo="Seção fora da base"
          descricao="Zona e seção preenchidas, mas o par não existe no TRE-PI."
          // Sem filtro na URL: a lista de registros filtra por estado local, e
          // inventar um parâmetro que ela não lê daria um link que mente.
          acao={<Link to="/registros">Abrir registros</Link>}
        />
      </div>

      <div className="card-foot">
        <span>
          <strong>{pct(total > 0 ? validos / total * 100 : 0)}</strong> da base tem cidade
          identificada. Os outros dois grupos somam <strong>{numero(semZona + foraBase)}</strong> registros.
        </span>
      </div>
    </article>
  )
}

function ItemLegenda({ cor, valor, rotulo, descricao, acao }: {
  cor: string; valor: number; rotulo: string; descricao: string; acao?: React.ReactNode
}) {
  return (
    <div className="legend-item">
      <span className="swatch" style={{ background: cor }} aria-hidden="true" />
      <div>
        <div className="legend-line">
          <span className="num">{numero(valor)}</span>
          <span>{rotulo}</span>
        </div>
        <div className="legend-desc">{descricao}</div>
        {acao && <div style={{ marginTop: 6, fontSize: 12 }}>{acao}</div>}
      </div>
    </div>
  )
}

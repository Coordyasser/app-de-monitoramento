import { ShieldCheck } from 'lucide-react'
import { capitalizarLugar } from '@/lib/texto'
import { numero, pad2, pct } from './formato'
import type { Municipio } from './tipos'

interface Props {
  capital:        string
  municipios:     Municipio[]
  /** Registros com cidade identificada — base dos percentuais */
  localizados:    number
  semCidade:      number
  loading?:       boolean
}

/** Percentual das seções do município conferidas na base do TRE-PI. */
const conferido = (m: Municipio) =>
  m.total > 0 ? Math.round(m.validados / m.total * 100) : 0

/**
 * Ranking por município.
 *
 * A capital sai da lista e vira bloco próprio: com 84,8% dos registros, ela
 * achatava todo o interior contra a margem esquerda. Na lista de baixo a
 * escala é relativa ao maior município do interior, então a comparação que
 * importa ali — entre municípios pequenos — volta a existir.
 */
export function MunicipioRanking({
  capital, municipios, localizados, semCidade, loading = false,
}: Props) {
  const ehCapital = (m: Municipio) =>
    m.municipio.trim().toLocaleUpperCase('pt-BR') === capital.trim().toLocaleUpperCase('pt-BR')

  const cap   = municipios.find(ehCapital)
  const resto = municipios.filter(m => !ehCapital(m))
  const totalInterior = resto.reduce((s, m) => s + m.total, 0)
  const maiorInterior = Math.max(1, ...resto.map(m => m.total))
  const proporcao = (v: number) => (localizados > 0 ? v / localizados * 100 : 0)

  return (
    <article className="card span-5">
      <div className="card-head">
        <div>
          <h2 className="card-title">Ranking por município</h2>
          <p className="card-sub">
            {numero(municipios.length)} municípios, {numero(localizados)} registros localizados
          </p>
        </div>
      </div>

      {loading ? (
        <>
          <div className="skel" style={{ height: 86, borderRadius: 14 }} />
          <div className="city-rows">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel skel-line" />)}
          </div>
        </>
      ) : municipios.length === 0 ? (
        <p className="card-sub">Nenhum município identificado ainda.</p>
      ) : (
        <>
          {cap && (
            <div className="capital">
              <div className="capital-line">
                <div>
                  <span className="rank">01</span>
                  <span className="capital-name">{capitalizarLugar(cap.municipio)}</span>
                  <span className="capital-meta">capital, {numero(cap.secoes)} seções</span>
                </div>
                <div>
                  <span className="capital-value">{numero(cap.total)}</span>
                  <span className="capital-pct">{pct(proporcao(cap.total))}</span>
                  <SeloConferencia m={cap} />
                </div>
              </div>
              <div
                className="track"
                role="img"
                aria-label={`${capitalizarLugar(cap.municipio)}: ${numero(cap.total)} registros, ${pct(proporcao(cap.total))} do total localizado`}
              >
                <div className="fill" style={{ width: `${proporcao(cap.total).toFixed(1)}%` }} />
              </div>
            </div>
          )}

          <div className="list-head">
            <span>Interior, {numero(totalInterior)} registros</span>
            <span>Registros</span>
          </div>

          <div className="city-rows">
            {resto.map((m, i) => (
              <div key={m.municipio} className="city-row">
                <span className="rank">{pad2(i + 2)}</span>
                <span className="name">
                  <span
                    className="ellipsis"
                    title={`${capitalizarLugar(m.municipio)}, ${numero(m.secoes)} seções`}
                  >
                    {capitalizarLugar(m.municipio)}
                  </span>
                  <SeloConferencia m={m} />
                </span>
                <div
                  className="track thin"
                  role="img"
                  aria-label={`${capitalizarLugar(m.municipio)}: ${numero(m.total)} registros`}
                >
                  <div className="fill" style={{ width: `${(m.total / maiorInterior * 100).toFixed(1)}%` }} />
                </div>
                <span className="v">{numero(m.total)}</span>
                <span className="p">{pct(proporcao(m.total))}</span>
              </div>
            ))}
          </div>

          <div className="card-foot">
            <ShieldCheck size={13} style={{ color: 'var(--ok)' }} />
            <span>
              Escudo = 100% das seções conferidas; o laranja diz quanto falta.{' '}
              <strong>{numero(semCidade)}</strong> sem cidade ficam fora.
            </span>
          </div>
        </>
      )}
    </article>
  )
}

/** Escudo verde só com 100%; abaixo disso, o número em laranja. */
function SeloConferencia({ m }: { m: Municipio }) {
  const p = conferido(m)
  return p >= 100 ? (
    <span className="verify">
      <ShieldCheck
        size={13}
        style={{ color: 'var(--ok)' }}
        aria-label="Todas as seções conferidas na base do TRE-PI"
      />
    </span>
  ) : (
    <span className="verify-pct" title={`${p}% das seções conferidas na base do TRE-PI`}>
      {p}%
    </span>
  )
}

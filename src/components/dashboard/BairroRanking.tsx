import { useState } from 'react'
import { capitalizarLugar } from '@/lib/texto'
import { numero, pad2 } from './formato'
import type { Bairro, CoberturaBairro } from './tipos'

interface Props {
  capital:      string
  bairros:      Bairro[]
  cobertura:    CoberturaBairro | null
  /** Registros do interior, para o botão da direita */
  interior:     number
  semLocalizacao: number
  loading?:     boolean
}

type Regiao = 'capital' | 'interior'

/**
 * Distribuição por bairro.
 *
 * Só a capital tem bairro: no interior o município já é o recorte, e a base do
 * TRE-PI não traz bairro para lá. O seletor existe para dizer isso em vez de
 * deixar a pergunta no ar.
 */
export function BairroRanking({
  capital, bairros, cobertura, interior, semLocalizacao, loading = false,
}: Props) {
  const [regiao, setRegiao] = useState<Regiao>('capital')

  const totalCapital = cobertura?.total ?? 0
  const exibidos     = bairros.reduce((s, b) => s + b.total, 0)
  const comBairro    = cobertura?.com_bairro ?? 0
  const outros       = Math.max(0, comBairro - exibidos)
  const outrosBairros = Math.max(0, (cobertura?.bairros ?? 0) - bairros.length)
  const semBairro    = Math.max(0, totalCapital - comBairro)

  const maior = Math.max(1, ...bairros.map(b => b.total))
  const naCapital = regiao === 'capital'

  return (
    <article className="card span-7">
      <div className="card-head">
        <div>
          <h2 className="card-title">Distribuição por bairro</h2>
          <p className="card-sub">
            {naCapital
              ? `Top ${bairros.length} bairros de ${capitalizarLugar(capital)} por número de registros`
              : 'Bairros do interior por número de registros'}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Região">
          <button type="button" aria-pressed={naCapital} onClick={() => setRegiao('capital')}>
            {capitalizarLugar(capital)} <span className="num">{numero(totalCapital)}</span>
          </button>
          <button type="button" aria-pressed={!naCapital} onClick={() => setRegiao('interior')}>
            Interior <span className="num">{numero(interior)}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rows">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skel skel-line" />
          ))}
        </div>
      ) : !naCapital ? (
        <p className="card-sub">
          Sem bairro informado para o interior. Esses registros aparecem no ranking por município.
        </p>
      ) : bairros.length === 0 ? (
        <p className="card-sub">Nenhum bairro identificado ainda.</p>
      ) : (
        <div className="rows">
          {bairros.map((b, i) => (
            <div key={b.bairro} className={`bairro-row${i < 3 ? ' top' : ''}`}>
              <span className="rank">{pad2(i + 1)}</span>
              <span className="name ellipsis" title={capitalizarLugar(b.bairro)}>
                {capitalizarLugar(b.bairro)}
              </span>
              <div
                className="track"
                role="img"
                aria-label={`${capitalizarLugar(b.bairro)}: ${numero(b.total)} registros`}
              >
                <div
                  className={`fill${i < 3 ? '' : ' soft'}`}
                  style={{ width: `${(b.total / maior * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="num">{numero(b.total)}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && naCapital && (
        <div className="card-foot">
          {outros > 0 && (
            <span><strong>+{numero(outros)}</strong> registros em {numero(outrosBairros)} outros bairros</span>
          )}
          {semBairro > 0 && (
            <span><strong>{numero(semBairro)}</strong> sem bairro, porque a seção não consta na base oficial</span>
          )}
          <span><strong>{numero(semLocalizacao)}</strong> registros sem localização ficam fora desta visão</span>
        </div>
      )}
    </article>
  )
}

import { ArrowDown, ArrowUp, Building2, Map, Grid3x3 } from 'lucide-react'
import { ddmm, numero, pct } from './formato'
import type { Periodo } from './DashHeader'

export interface DiaSerie { dia: string; total: number }

interface Props {
  total:      number
  hoje:       number
  semana:     number
  /** Variação percentual de hoje contra ontem */
  variacao:   number
  cidades:    number
  zonas:      number
  secoes:     number
  /** Rótulo do município que concentra mais registros, para a dica do card */
  capital?:   { nome: string; pct: number }
  serie:      DiaSerie[]
  periodo:    Periodo
  /** A série já vem no intervalo do recorte: mostra inteira, sem cortar em `periodo` */
  serieCompleta?: boolean
  loading:    boolean
  serieLoading: boolean
}

/**
 * Faixa de indicadores: o hero escuro com o total e o gráfico diário embutido,
 * mais três cards de cobertura.
 *
 * O gráfico deixou de ser seção própria. Ele responde à mesma pergunta que o
 * total — quanto entrou e quando —, e separado obrigava a olhar dois blocos
 * para ler uma coisa só.
 */
export function IndicadoresHero({
  total, hoje, semana, variacao, cidades, zonas, secoes, capital,
  serie, periodo, serieCompleta = false, loading, serieLoading,
}: Props) {
  const subiu = variacao >= 0
  // A RPC já devolve a série sem buracos (generate_series), então não há dia
  // faltando para completar aqui.
  const dias  = serieCompleta ? serie : serie.slice(-periodo)
  const maior = Math.max(1, ...dias.map(d => d.total))
  const somaPeriodo = dias.reduce((s, d) => s + d.total, 0)

  const marcas = 5
  const passo  = dias.length > 1 ? (dias.length - 1) / (marcas - 1) : 0
  const eixo   = dias.length
    ? Array.from({ length: marcas }, (_, i) => dias[Math.round(i * passo)])
    : []

  return (
    <section className="grid-12" aria-label="Indicadores principais">
      <article className="hero span-6">
        <div className="hero-left">
          <div>
            <div className="hero-label">Registros no total</div>
            <div className="hero-value">{loading ? '—' : numero(total)}</div>
          </div>
          <div className="hero-rows">
            <div className="hero-row">
              <span>Hoje</span>
              <span className="num">{loading ? '—' : numero(hoje)}</span>
            </div>
            <div className="hero-row">
              <span>Últimos 7 dias</span>
              <span className="num">{loading ? '—' : numero(semana)}</span>
            </div>
            {!loading && (
              <span className={`delta${subiu ? '' : ' down'}`}>
                {subiu ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {Math.abs(Math.round(variacao))}% vs. ontem
              </span>
            )}
          </div>
        </div>

        <div className="hero-chart">
          <div className="hero-chart-head">
            <strong style={{ fontSize: 14, fontWeight: 600 }}>
              Registros por dia, {serieCompleta && dias.length
                ? `${ddmm(new Date(`${dias[0].dia}T12:00:00`))} a ${ddmm(new Date(`${dias[dias.length - 1].dia}T12:00:00`))}`
                : `${periodo} dias`}
            </strong>
            <small>{serieLoading ? 'carregando...' : `${numero(somaPeriodo)} no período`}</small>
          </div>

          <div
            className="bars"
            role="img"
            aria-label={`${numero(somaPeriodo)} registros em ${dias.length} dias`}
          >
            {dias.map(d => (
              <span
                key={d.dia}
                className={d.total ? 'has' : undefined}
                style={{ height: d.total ? `${(d.total / maior * 100).toFixed(1)}%` : '3px' }}
                title={`${ddmm(new Date(`${d.dia}T12:00:00`))}: ${numero(d.total)} registros`}
              />
            ))}
            <span className="peak num">{numero(maior)}</span>
          </div>

          <div className="axis">
            {eixo.map((d, i) => <span key={`${d.dia}-${i}`}>{ddmm(new Date(`${d.dia}T12:00:00`))}</span>)}
          </div>
        </div>
      </article>

      <KpiCard
        icone={<Building2 size={18} />}
        valor={cidades} rotulo="Cidades alcançadas" loading={loading}
        dica={capital ? `${capital.nome} concentra ${pct(capital.pct)}` : undefined}
      />
      <KpiCard icone={<Map size={18} />}     valor={zonas}  rotulo="Zonas cobertas"  loading={loading} />
      <KpiCard icone={<Grid3x3 size={18} />} valor={secoes} rotulo="Seções cobertas" loading={loading} />
    </section>
  )
}

function KpiCard({ icone, valor, rotulo, dica, loading }: {
  icone: React.ReactNode; valor: number; rotulo: string; dica?: string; loading: boolean
}) {
  return (
    <article className="kpi span-2">
      <span className="kpi-icon" aria-hidden="true">{icone}</span>
      <div>
        {loading
          ? <div className="skel" style={{ height: 34, width: 64 }} />
          : <div className="kpi-value">{numero(valor)}</div>}
        <div className="kpi-label">{rotulo}</div>
        {/* A linha de dica existe sempre, mesmo vazia: o bloco de texto é
            ancorado embaixo, e sem ela os cards sem dica subiriam uma linha
            em relação ao primeiro, desencontrando número com número. */}
        <div className="kpi-hint" aria-hidden={!dica || loading}>
          {!loading && dica ? dica : ' '}
        </div>
      </div>
    </article>
  )
}

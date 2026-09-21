import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Building2, Info, MapPinned } from 'lucide-react'
import { Card } from '@/components/ui'
import { ACCENT, AXIS, formatarNumero, tickStyle, tooltipStyle } from './viz'

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface Bairro    { bairro: string;    total: number; secoes: number }
export interface Municipio { municipio: string; total: number; secoes: number; validados: number }

export interface CoberturaGeografica {
  total:               number
  sem_localizacao:     number
  capital:             number
  interior:            number
  municipios:          number
  municipios_interior: number
}

interface Props {
  capital:    string
  bairros:    Bairro[]
  municipios: Municipio[]
  cobertura:  CoberturaGeografica | null
  loading?:   boolean
}

type Aba = 'capital' | 'interior'

const MAX_ROTULO = 18

// ── Componente ─────────────────────────────────────────────────────────────

export function GeografiaCard({
  capital, bairros, municipios, cobertura, loading = false,
}: Props) {
  const [aba, setAba] = useState<Aba>('capital')

  // Se a capital não tiver nada, abre direto no interior — não faz sentido
  // apresentar um gráfico vazio como primeira coisa.
  useEffect(() => {
    if (!loading && cobertura && cobertura.capital === 0 && cobertura.interior > 0) {
      setAba('interior')
    }
  }, [loading, cobertura])

  const dados = useMemo(() => {
    const bruto = aba === 'capital'
      ? bairros.map(b => ({ nome: b.bairro, total: b.total, detalhe: `${b.secoes} ${b.secoes === 1 ? 'seção' : 'seções'}` }))
      : municipios.map(m => ({ nome: m.municipio, total: m.total, detalhe: `${m.secoes} ${m.secoes === 1 ? 'seção' : 'seções'}` }))

    return bruto.map(d => ({
      ...d,
      rotulo: d.nome.length > MAX_ROTULO ? `${d.nome.slice(0, MAX_ROTULO - 1)}…` : d.nome,
    }))
  }, [aba, bairros, municipios])

  const altura = Math.max(240, dados.length * 28)

  // Quantos registros da aba atual ficaram de fora do gráfico
  const somaVisivel = dados.reduce((s, d) => s + d.total, 0)
  const totalDaAba  = aba === 'capital' ? (cobertura?.capital ?? 0) : (cobertura?.interior ?? 0)
  const foraDoGrafico = Math.max(totalDaAba - somaVisivel, 0)

  const abas: { key: Aba; label: string; icone: typeof Building2; contagem: number }[] = [
    { key: 'capital',  label: capital,   icone: Building2,  contagem: cobertura?.capital  ?? 0 },
    { key: 'interior', label: 'Interior', icone: MapPinned, contagem: cobertura?.interior ?? 0 },
  ]

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Distribuição geográfica
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {aba === 'capital'
              ? `Registros por bairro em ${capital}`
              : 'Registros por município, fora da capital'}
          </p>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-slate-100/70 dark:bg-white/5">
          {abas.map(({ key, label, icone: Icone, contagem }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                'transition-all duration-200',
                aba === key
                  ? 'bg-white dark:bg-white/10 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
              ].join(' ')}
            >
              <Icone size={13} />
              <span className="truncate max-w-[110px]">{label}</span>
              {!loading && (
                <span className="tabular-nums opacity-60">{formatarNumero(contagem)}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[280px] flex flex-col justify-center gap-2.5 animate-pulse">
          {[92, 78, 70, 61, 54, 47, 39, 31, 24].map((w, i) => (
            <div key={i} className="h-4 rounded bg-slate-100 dark:bg-white/10" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : dados.length === 0 ? (
        <div className="h-[280px] flex flex-col items-center justify-center gap-2 text-center px-6">
          <MapPinned size={26} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {aba === 'capital'
              ? `Nenhum registro de ${capital} com seção vinculada à base do TRE-PI.`
              : 'Nenhum registro fora da capital ainda.'}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={altura}>
          <BarChart
            data={dados}
            layout="vertical"
            margin={{ top: 0, right: 44, bottom: 0, left: 0 }}
            barCategoryGap={5}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="rotulo"
              width={132}
              tick={tickStyle}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: 'var(--viz-accent-soft)' }}
              formatter={(value, _n, item) => {
                const p = (item as { payload?: { nome?: string; detalhe?: string } }).payload
                return [
                  `${formatarNumero(Number(value ?? 0))} · ${p?.detalhe ?? ''}`,
                  p?.nome ?? '',
                ]
              }}
            />
            {/* Uma única matiz: a barra mede magnitude, não identidade */}
            <Bar dataKey="total" fill={ACCENT} radius={[0, 4, 4, 0]} maxBarSize={16}>
              <LabelList
                dataKey="total"
                position="right"
                offset={8}
                style={{ fontSize: 11, fill: AXIS, fontVariantNumeric: 'tabular-nums' }}
                formatter={(v) => formatarNumero(Number(v ?? 0))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* O que o gráfico não mostra — dito na cara, não escondido */}
      {!loading && cobertura && (
        <div className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed
                        text-slate-400 dark:text-slate-500">
          <Info size={12} className="mt-0.5 shrink-0" />
          <p>
            {foraDoGrafico > 0 && (
              <>
                {aba === 'capital'
                  ? `${formatarNumero(foraDoGrafico)} de ${capital} sem seção vinculada à base oficial — sem bairro conhecido. `
                  : `${formatarNumero(foraDoGrafico)} fora dos municípios listados. `}
              </>
            )}
            {cobertura.sem_localizacao > 0 && (
              <>
                {formatarNumero(cobertura.sem_localizacao)} de {formatarNumero(cobertura.total)} registros
                não têm cidade informada e não entram em nenhuma das visões.
              </>
            )}
          </p>
        </div>
      )}
    </Card>
  )
}

import { MapPin, ShieldCheck } from 'lucide-react'
import { formatarNumero } from './viz'
import { RankingBarras } from './RankingBarras'
import { capitalizarLugar } from '@/lib/texto'
import type { CoberturaGeografica, Municipio } from './GeografiaCard'

interface Props {
  data:      Municipio[]
  cobertura: CoberturaGeografica | null
  capital:   string
  loading?:  boolean
}

export function MunicipioRanking({ data, cobertura, capital, loading = false }: Props) {
  // Denominador é o que está localizado, não o total bruto: registro sem
  // cidade não pertence a município nenhum e inflaria o divisor.
  const baseLocalizada = data.reduce((s, d) => s + d.total, 0)

  const itens = data.map(m => {
    const validado = m.total > 0 ? Math.round((m.validados / m.total) * 100) : 0
    return {
      chave:    m.municipio,
      rotulo:   capitalizarLugar(m.municipio),
      total:    m.total,
      detalhe:  `${formatarNumero(m.secoes)} ${m.secoes === 1 ? 'seção' : 'seções'}`,
      destaque: m.municipio.toUpperCase() === capital.toUpperCase(),
      selo: validado === 100
        ? <ShieldCheck size={11} className="text-emerald-500 shrink-0" />
        : <span className="text-[11px] tabular-nums text-amber-500 shrink-0 w-8 text-right">
            {validado}%
          </span>,
    }
  })

  return (
    <RankingBarras
      titulo="Ranking por município"
      subtitulo="Onde a base está concentrada, capital incluída"
      resumo={cobertura && (
        <>
          <MapPin size={13} className="text-slate-400 dark:text-slate-500" />
          {formatarNumero(cobertura.municipios)} municípios ·{' '}
          {formatarNumero(baseLocalizada)} registros localizados
        </>
      )}
      itens={itens}
      base={baseLocalizada}
      loading={loading}
      vazio="Nenhum registro com município identificado."
      rodape={cobertura && cobertura.sem_localizacao > 0 && (
        <>
          Fora do ranking: {formatarNumero(cobertura.sem_localizacao)} registros sem
          cidade informada na planilha de origem. O escudo indica município com
          100% das seções conferidas na base do TRE-PI.
        </>
      )}
    />
  )
}

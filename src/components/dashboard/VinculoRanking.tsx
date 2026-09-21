import { Users } from 'lucide-react'
import { formatarNumero } from './viz'
import { RankingBarras } from './RankingBarras'

export interface Vinculo { vinculo: string; total: number }

interface Props {
  data:     Vinculo[]
  loading?: boolean
}

/**
 * Distribuição por vínculo.
 *
 * Era uma rosca com as 12 maiores lideranças e uma fatia "Outros". Com 38
 * vínculos, isso escondia dois terços da lista e impedia justamente a
 * comparação que o gráfico deveria permitir — quanto cada liderança pesa no
 * total. Agora aparecem todas, com o percentual ao lado do valor.
 */
export function VinculoRanking({ data, loading = false }: Props) {
  const total = data.reduce((s, d) => s + d.total, 0)
  const media = data.length > 0 ? total / data.length : 0

  const itens = data.map(v => ({
    chave:  v.vinculo,
    rotulo: v.vinculo,
    total:  v.total,
    // Referência rápida: quem puxa a média para cima
    detalhe: v.total >= media * 2 ? 'acima do dobro da média' : undefined,
  }))

  return (
    <RankingBarras
      titulo="Registros por vínculo"
      subtitulo="Todas as lideranças, do maior volume ao menor"
      resumo={
        <>
          <Users size={13} className="text-slate-400 dark:text-slate-500" />
          {formatarNumero(data.length)} vínculos · média de{' '}
          {media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por liderança
        </>
      }
      itens={itens}
      base={total}
      loading={loading}
      vazio="Nenhum vínculo registrado ainda."
      rodape={
        <>
          O percentual é sobre os {formatarNumero(total)} registros com vínculo
          informado. A grafia é livre no formulário, então variações do mesmo nome
          são agrupadas ignorando acento e caixa.
        </>
      }
    />
  )
}

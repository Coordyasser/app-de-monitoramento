import { situacaoEfetiva, type RegistroSituacao } from '@/lib/situacao'

const CORES: Record<string, string> = {
  OK:       'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  PENDENTE: 'bg-amber-100/70 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  CONFERIR: 'bg-sky-100/70 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
}

/**
 * Situação do registro já com a regra aplicada — nunca o valor cru da
 * planilha, para a lista e o detalhe não discordarem entre si.
 */
export function SituacaoBadge({ registro, tamanho = 'md' }: {
  registro: RegistroSituacao
  tamanho?: 'sm' | 'md'
}) {
  const situacao = situacaoEfetiva(registro)
  if (!situacao) return null

  const cor = CORES[situacao.toUpperCase()]
    ?? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
  const medida = tamanho === 'sm' ? 'px-2 py-0.5 gap-1' : 'px-2.5 py-1 gap-1.5'

  return (
    <span className={`inline-flex items-center rounded-full text-xs font-medium ${medida} ${cor}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      {situacao}
    </span>
  )
}

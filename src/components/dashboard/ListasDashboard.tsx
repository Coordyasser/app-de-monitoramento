import { type ReactNode } from 'react'
import { Card } from '@/components/ui'
import { formatarNumero } from './viz'
import { capitalizarLugar } from '@/lib/texto'

// ── Casca comum das três listas do dashboard ───────────────────────────────

interface ListaCardProps {
  titulo:   string
  subtitulo?: string
  vazio:    string
  loading:  boolean
  itens:    number
  children: ReactNode
  acao?:    ReactNode
}

function ListaCard({ titulo, subtitulo, vazio, loading, itens, children, acao }: ListaCardProps) {
  return (
    <Card padding="md" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{titulo}</h3>
          {subtitulo && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitulo}</p>
          )}
        </div>
        {acao}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded-lg bg-slate-100 dark:bg-white/10" />
          ))}
        </div>
      ) : itens === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
          {vazio}
        </div>
      ) : children}
    </Card>
  )
}

// ── Cobertura territorial ──────────────────────────────────────────────────

export interface ZonaCobertura {
  cidade: string
  zona:   string
  secoes: number
  total:  number
}

export function ZonaCoberturaCard({ data, loading }: { data: ZonaCobertura[]; loading: boolean }) {
  return (
    <ListaCard
      titulo="Cobertura por zona"
      subtitulo="Onde a equipe está alcançando"
      vazio="Nenhuma zona coberta ainda"
      loading={loading}
      itens={data.length}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <th className="pb-2 font-medium">Cidade / Zona</th>
            <th className="pb-2 font-medium text-right">Seções</th>
            <th className="pb-2 font-medium text-right">Registros</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/40 dark:divide-white/[0.06]">
          {data.map(z => (
            <tr key={`${z.cidade}-${z.zona}`}>
              <td className="py-2 pr-2">
                <span className="block truncate max-w-[180px] text-slate-700 dark:text-slate-200">
                  {capitalizarLugar(z.cidade)}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">Zona {z.zona}</span>
              </td>
              <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                {formatarNumero(z.secoes)}
              </td>
              <td className="py-2 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                {formatarNumero(z.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ListaCard>
  )
}

// ── Contatos repetidos ─────────────────────────────────────────────────────

export interface Duplicado {
  contato:    string
  repeticoes: number
  nomes:      string[]
  ultimo:     string
}

export function DuplicadosCard({ data, loading }: { data: Duplicado[]; loading: boolean }) {
  return (
    <ListaCard
      titulo="Contatos repetidos"
      subtitulo="Mesmo telefone ou e-mail em mais de um registro"
      vazio="Nenhuma repetição encontrada"
      loading={loading}
      itens={data.length}
    >
      <ul className="flex flex-col divide-y divide-white/40 dark:divide-white/[0.06]">
        {data.map(d => (
          <li key={d.contato} className="py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {d.contato}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                {d.nomes.join(' · ')}
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                             bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {formatarNumero(d.repeticoes)}×
            </span>
          </li>
        ))}
      </ul>
    </ListaCard>
  )
}

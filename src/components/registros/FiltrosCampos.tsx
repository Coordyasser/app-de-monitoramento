import { Search } from 'lucide-react'
import { ComboboxSelect, Input } from '@/components/ui'
import { capitalizarLugar, exibirTexto } from '@/lib/texto'
import { FILTROS_SITUACAO } from '@/lib/situacao'
import { FILTROS_EST } from '@/lib/est'
import type { Filtros } from './consulta'

interface Props {
  filtros:     Filtros
  onChange:    (patch: Partial<Filtros>) => void
  /** A tabela guarda o texto digitado à parte para aplicar com debounce */
  busca:       string
  onBusca:     (valor: string) => void
  cidadeOpts:  string[]
  vinculoOpts: string[]
  /** Nome de cada campo acima dele — no popup não há tabela para dar contexto */
  comRotulos?: boolean
  className?:  string
}

/** Os campos de filtro da lista de registros, usados na tabela e no export. */
export function FiltrosCampos({
  filtros, onChange, busca, onBusca, cidadeOpts, vinculoOpts, comRotulos = false,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3',
}: Props) {
  const rotulo = (texto: string) => comRotulos ? texto : undefined

  return (
    <div className={className}>
      <Input
        label={rotulo('Busca')}
        placeholder="Nome, título ou contato"
        icon={<Search size={15} />}
        value={busca}
        onChange={e => onBusca(e.target.value)}
      />
      <ComboboxSelect
        label={rotulo('Cidade')}
        options={cidadeOpts.map(c => ({ value: c, label: capitalizarLugar(c) }))}
        value={filtros.cidade}
        onChange={v => onChange({ cidade: v })}
        placeholder="Todas as cidades"
      />
      <ComboboxSelect
        label={rotulo('Vínculo')}
        options={vinculoOpts.map(v => ({ value: v, label: exibirTexto(v) }))}
        value={filtros.vinculo}
        onChange={v => onChange({ vinculo: v })}
        placeholder="Todos os vínculos"
      />
      <ComboboxSelect
        label={rotulo('Situação')}
        options={FILTROS_SITUACAO}
        value={filtros.situacao}
        onChange={v => onChange({ situacao: v })}
        placeholder="Todas as situações"
      />
      <ComboboxSelect
        label={rotulo('Est')}
        options={FILTROS_EST}
        value={filtros.est}
        onChange={v => onChange({ est: v })}
        placeholder="Todos os Est"
      />
      <Input
        type="date"
        label={rotulo('De')}
        aria-label="Data inicial"
        value={filtros.dataDe}
        onChange={e => onChange({ dataDe: e.target.value })}
      />
      <Input
        type="date"
        label={rotulo('Até')}
        aria-label="Data final"
        value={filtros.dataAte}
        onChange={e => onChange({ dataAte: e.target.value })}
      />
    </div>
  )
}

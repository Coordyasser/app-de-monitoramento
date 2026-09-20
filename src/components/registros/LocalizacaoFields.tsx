import { useEffect, useState } from 'react'
import { Keyboard, ListChecks, MapPin, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ComboboxSelect, Input } from '@/components/ui'

// ── Tipo ───────────────────────────────────────────────────────────────────

export interface LocalizacaoRegistro {
  cidade:        string
  zona:          string
  secao:         string
  /** Preenchido só quando os três níveis vieram da base do TRE-PI */
  secao_id:      string | null
  local_votacao: string | null
  /** true = agente optou por digitar à mão */
  manual:        boolean
}

export const LOCALIZACAO_VAZIA: LocalizacaoRegistro = {
  cidade: '', zona: '', secao: '', secao_id: null, local_votacao: null, manual: false,
}

export interface LocalizacaoErrors {
  cidade?: string
  zona?:   string
  secao?:  string
}

interface Props {
  value:    LocalizacaoRegistro
  onChange: (next: LocalizacaoRegistro) => void
  errors?:  LocalizacaoErrors
}

// ── Helpers ────────────────────────────────────────────────────────────────

const toOptions = (values: string[]) => values.map(v => ({ value: v, label: v }))

// ── Componente ─────────────────────────────────────────────────────────────

export function LocalizacaoFields({ value, onChange, errors = {} }: Props) {
  const [cidades, setCidades] = useState<string[]>([])
  const [zonas,   setZonas]   = useState<string[]>([])
  const [secoes,  setSecoes]  = useState<string[]>([])

  const [cidadesLoading, setCidadesLoading] = useState(true)
  const [zonasLoading,   setZonasLoading]   = useState(false)
  const [secoesLoading,  setSecoesLoading]  = useState(false)

  const { cidade, zona, secao, manual } = value

  // ── Nível 1: cidades ─────────────────────────────────────────────────

  useEffect(() => {
    if (manual) return
    let ativo = true
    setCidadesLoading(true)
    supabase.rpc('get_municipios_pi').then(({ data }) => {
      if (!ativo) return
      setCidades((data ?? []).map(r => r.municipio))
      setCidadesLoading(false)
    })
    return () => { ativo = false }
  }, [manual])

  // ── Nível 2: zonas da cidade ─────────────────────────────────────────

  useEffect(() => {
    if (manual || !cidade) { setZonas([]); return }
    let ativo = true
    setZonasLoading(true)
    supabase.rpc('get_zonas_pi', { p_municipio: cidade }).then(({ data }) => {
      if (!ativo) return
      setZonas((data ?? []).map(r => r.zona))
      setZonasLoading(false)
    })
    return () => { ativo = false }
  }, [cidade, manual])

  // ── Nível 3: seções da cidade + zona ─────────────────────────────────

  useEffect(() => {
    if (manual || !cidade || !zona) { setSecoes([]); return }
    let ativo = true
    setSecoesLoading(true)
    supabase
      .rpc('get_secoes_cidade_zona_pi', { p_municipio: cidade, p_zona: zona })
      .then(({ data }) => {
        if (!ativo) return
        setSecoes((data ?? []).map(r => r.secao))
        setSecoesLoading(false)
      })
    return () => { ativo = false }
  }, [cidade, zona, manual])

  // ── Resolve o vínculo com a base oficial ─────────────────────────────

  useEffect(() => {
    if (manual || !cidade || !zona || !secao) return
    let ativo = true
    supabase
      .rpc('get_secao_id_cidade_zona_pi', { p_municipio: cidade, p_zona: zona, p_secao: secao })
      .then(({ data }) => {
        if (!ativo) return
        const match = data?.[0]
        onChange({
          ...value,
          secao_id:      match?.id ?? null,
          local_votacao: match?.local_votacao ?? null,
        })
      })
    return () => { ativo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidade, zona, secao, manual])

  // ── Handlers ─────────────────────────────────────────────────────────

  function setCidade(v: string) {
    onChange({ ...value, cidade: v, zona: '', secao: '', secao_id: null, local_votacao: null })
  }

  function setZona(v: string) {
    onChange({ ...value, zona: v, secao: '', secao_id: null, local_votacao: null })
  }

  function setSecao(v: string) {
    onChange({ ...value, secao: v, secao_id: null, local_votacao: null })
  }

  function alternarModo() {
    onChange({ ...LOCALIZACAO_VAZIA, manual: !manual })
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <MapPin size={15} className="text-indigo-500" />
          Localização
        </span>
        <button
          type="button"
          onClick={alternarModo}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400
                     hover:underline"
        >
          {manual
            ? <><ListChecks size={13} /> Escolher da base oficial</>
            : <><Keyboard   size={13} /> Não encontrei — digitar manualmente</>
          }
        </button>
      </div>

      {manual ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Cidade"
            placeholder="Ex.: Teresina"
            value={cidade}
            error={errors.cidade}
            onChange={e => onChange({ ...value, cidade: e.target.value })}
          />
          <Input
            label="Zona"
            placeholder="Ex.: 001"
            value={zona}
            error={errors.zona}
            onChange={e => onChange({ ...value, zona: e.target.value })}
          />
          <Input
            label="Seção"
            placeholder="Ex.: 0185"
            value={secao}
            error={errors.secao}
            onChange={e => onChange({ ...value, secao: e.target.value })}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ComboboxSelect
            label="Cidade"
            options={toOptions(cidades)}
            value={cidade}
            onChange={setCidade}
            loading={cidadesLoading}
            error={errors.cidade}
            placeholder="Buscar cidade..."
          />
          <ComboboxSelect
            label="Zona"
            options={toOptions(zonas)}
            value={zona}
            onChange={setZona}
            loading={zonasLoading}
            disabled={!cidade}
            error={errors.zona}
            placeholder={cidade ? 'Buscar zona...' : 'Escolha a cidade'}
          />
          <ComboboxSelect
            label="Seção"
            options={toOptions(secoes)}
            value={secao}
            onChange={setSecao}
            loading={secoesLoading}
            disabled={!zona}
            error={errors.secao}
            placeholder={zona ? 'Buscar seção...' : 'Escolha a zona'}
          />
        </div>
      )}

      {/* Confirmação de que a seção casou com a base do TRE-PI */}
      {!manual && value.secao_id && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <ShieldCheck size={13} className="shrink-0" />
          Seção confirmada na base do TRE-PI
          {value.local_votacao ? ` — ${value.local_votacao}` : ''}
        </p>
      )}

      {manual && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Localização digitada à mão: não será conferida com a base oficial.
        </p>
      )}
    </div>
  )
}

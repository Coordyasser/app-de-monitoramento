import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface CascadeSelection {
  municipio:     string
  zona:          string
  local_votacao: string
  secao:         string
  urna:          string
  secao_id:      string
}

interface LevelState {
  options:  string[]
  loading:  boolean
  error:    string | null
}

const EMPTY: LevelState = { options: [], loading: false, error: null }

// ── Hook principal ─────────────────────────────────────────────────────────

export function useCascadeLocation() {
  const [municipio,     setMunicipioRaw]    = useState('')
  const [zona,          setZonaRaw]         = useState('')
  const [local_votacao, setLocalVotacaoRaw] = useState('')
  const [secao,         setSecaoRaw]        = useState('')
  const [urna,          setUrnaRaw]         = useState('')
  const [secao_id,      setSecaoId]         = useState('')

  const [municipios, setMunicipios] = useState<LevelState>({ options: [], loading: true, error: null })
  const [zonas,      setZonas]      = useState<LevelState>(EMPTY)
  const [locais,     setLocais]     = useState<LevelState>(EMPTY)
  const [secoes,     setSecoes]     = useState<LevelState>(EMPTY)

  // ── Nível 1: Municípios (RPC — retorna DISTINCT sem limite de 1000 linhas) ─
  useEffect(() => {
    const controller = new AbortController()
    setMunicipios({ options: [], loading: true, error: null })

    supabase
      .rpc('get_municipios_pi')
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return
        if (error) { setMunicipios({ options: [], loading: false, error: error.message }); return }
        const opts = (data ?? []).map((r: { municipio: string }) => r.municipio)
        setMunicipios({ options: opts, loading: false, error: null })
      })

    return () => controller.abort()
  }, [])

  // ── Nível 2: Zonas ────────────────────────────────────────────────────
  useEffect(() => {
    setZonaRaw(''); setLocalVotacaoRaw(''); setSecaoRaw(''); setUrnaRaw(''); setSecaoId('')

    if (!municipio) { setZonas(EMPTY); return }

    const controller = new AbortController()
    setZonas({ options: [], loading: true, error: null })

    supabase
      .rpc('get_zonas_pi', { p_municipio: municipio })
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return
        if (error) { setZonas({ options: [], loading: false, error: error.message }); return }
        const opts = (data ?? []).map((r: { zona: string }) => r.zona)
        setZonas({ options: opts, loading: false, error: null })
      })

    return () => controller.abort()
  }, [municipio])

  // ── Nível 3: Locais ────────────────────────────────────────────────────
  useEffect(() => {
    setLocalVotacaoRaw(''); setSecaoRaw(''); setUrnaRaw(''); setSecaoId('')

    if (!municipio || !zona) { setLocais(EMPTY); return }

    const controller = new AbortController()
    setLocais({ options: [], loading: true, error: null })

    supabase
      .rpc('get_locais_pi', { p_municipio: municipio, p_zona: zona })
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return
        if (error) { setLocais({ options: [], loading: false, error: error.message }); return }
        const opts = (data ?? []).map((r: { local_votacao: string }) => r.local_votacao)
        setLocais({ options: opts, loading: false, error: null })
      })

    return () => controller.abort()
  }, [municipio, zona])

  // ── Nível 4: Seções ────────────────────────────────────────────────────
  useEffect(() => {
    setSecaoRaw(''); setUrnaRaw(''); setSecaoId('')

    if (!municipio || !zona || !local_votacao) { setSecoes(EMPTY); return }

    const controller = new AbortController()
    setSecoes({ options: [], loading: true, error: null })

    supabase
      .rpc('get_secoes_pi', {
        p_municipio:     municipio,
        p_zona:          zona,
        p_local_votacao: local_votacao,
      })
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return
        if (error) { setSecoes({ options: [], loading: false, error: error.message }); return }
        const opts = (data ?? []).map((r: { secao: string }) => r.secao)
        setSecoes({ options: opts, loading: false, error: null })
      })

    return () => controller.abort()
  }, [municipio, zona, local_votacao])

  // ── Resolve secao_id quando seção é selecionada ───────────────────────
  useEffect(() => {
    setUrnaRaw(''); setSecaoId('')

    if (!municipio || !zona || !local_votacao || !secao) return

    const controller = new AbortController()

    supabase
      .rpc('get_secao_id_pi', {
        p_municipio:     municipio,
        p_zona:          zona,
        p_local_votacao: local_votacao,
        p_secao:         secao,
      })
      .abortSignal(controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted) return
        const row = (data ?? [])[0] as { id: string; urna: string } | undefined
        if (row) {
          setSecaoId(row.id)
          setUrnaRaw(row.urna)
        }
      })

    return () => controller.abort()
  }, [municipio, zona, local_votacao, secao])

  // ── Setters públicos ───────────────────────────────────────────────────
  const setMunicipio = (v: string) => setMunicipioRaw(v)
  const setZona      = (v: string) => setZonaRaw(v)
  const setLocal     = (v: string) => setLocalVotacaoRaw(v)
  const setSecao     = (v: string) => setSecaoRaw(v)

  // urna auto-selecionado via get_secao_id_pi (não há seletor de urna na UI)
  const isComplete = !!(municipio && zona && local_votacao && secao && secao_id)

  const selection: CascadeSelection | null = isComplete
    ? { municipio, zona, local_votacao, secao, urna, secao_id }
    : null

  return {
    municipio, zona, local_votacao, secao, urna, secao_id,
    setMunicipio, setZona, setLocal, setSecao,
    municipios, zonas, locais, secoes,
    isComplete, selection,
  }
}

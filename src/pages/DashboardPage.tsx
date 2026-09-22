import { useCallback, useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { supabase }     from '@/lib/supabase'
import { useAuth }      from '@/contexts/AuthContext'
import { AppShell }     from '@/components/layout/AppShell'
import { AgentesTable } from '@/components/admin/AgentesTable'
import { DashHeader, type Aba, type Periodo } from '@/components/dashboard/DashHeader'
import { IndicadoresHero, type DiaSerie } from '@/components/dashboard/IndicadoresHero'
import { QualidadeCard }  from '@/components/dashboard/QualidadeCard'
import { EstCard, type EstContagem } from '@/components/dashboard/EstCard'
import { BairroRanking }  from '@/components/dashboard/BairroRanking'
import { MunicipioRanking } from '@/components/dashboard/MunicipioRanking'
import { VinculoRanking, type Vinculo } from '@/components/dashboard/VinculoRanking'
import {
  DuplicadosCard, ZonaCoberturaCard,
  type Duplicado, type ZonaCobertura,
} from '@/components/dashboard/ListasDashboard'
import { UltimosRegistros } from '@/components/dashboard/UltimosRegistros'
import type {
  Bairro, CoberturaBairro, CoberturaGeografica, Municipio,
} from '@/components/dashboard/tipos'
import type { RegistrosMetrics } from '@/types/database.types'
import '@/components/dashboard/dash.css'

/**
 * Capital do estado. É a única cidade grande o bastante para que a visão por
 * município não diga nada: são 5 zonas para 1.928 seções, então lá o recorte
 * útil é o bairro. No interior, o município já é o próprio recorte.
 */
const CAPITAL = 'TERESINA'

/**
 * Contagem de um valor de Est.
 *
 * Est não tem RPC própria: são três contagens diretas na view, que já respeita
 * o RLS — admin conta a base toda, agente conta a sua. `head` traz só o número
 * no cabeçalho, sem nenhuma linha no corpo da resposta.
 */
function contarEst(valor: string | null) {
  const q = supabase
    .from('vw_registros_detalhados')
    .select('id', { count: 'exact', head: true })
  return valor === null ? q.is('est', null) : q.eq('est', valor)
}

export function DashboardPage() {
  const { profile } = useAuth()
  const ehAdmin = profile?.role === 'admin'

  const [aba, setAba] = useState<Aba>('visao')

  const [metrics, setMetrics] = useState<RegistrosMetrics | null>(null)
  const [serie,   setSerie]   = useState<DiaSerie[]>([])
  const [vinculos,      setVinculos]      = useState<Vinculo[]>([])
  const [zonas,         setZonas]         = useState<ZonaCobertura[]>([])
  const [duplicados,    setDuplicados]    = useState<Duplicado[]>([])
  const [bairros,       setBairros]       = useState<Bairro[]>([])
  const [municipios,    setMunicipios]    = useState<Municipio[]>([])
  const [cobertura,     setCobertura]     = useState<CoberturaGeografica | null>(null)
  const [cobBairro,     setCobBairro]     = useState<CoberturaBairro | null>(null)
  const [est,           setEst]           = useState<EstContagem | null>(null)

  const [periodo,      setPeriodo]      = useState<Periodo>(30)
  const [loading,      setLoading]      = useState(true)
  const [serieLoading, setSerieLoading] = useState(true)
  const [erro,         setErro]         = useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)

  // ── Carga dos painéis ────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)

    const [m, v, z, d, b, mun, cob, cb, estAna, estGil, estBranco] = await Promise.all([
      supabase.rpc('get_registros_metrics'),
      // Todos os vínculos: o gráfico existe para dar a dimensão do conjunto,
      // e cortar na 12ª liderança escondia dois terços da lista.
      supabase.rpc('get_registros_por_vinculo',   { p_limit: 200 }),
      supabase.rpc('get_registros_por_zona',      { p_limit: 8  }),
      supabase.rpc('get_registros_duplicados',    { p_limit: 8  }),
      // 70 bairros da capital têm registro. Mostrar todos deixaria o cartão
      // com quase dois mil pixels de altura; 25 cobre a maior parte e o
      // rodapé declara o resto.
      supabase.rpc('get_registros_por_bairro',    { p_municipio: CAPITAL, p_limit: 25 }),
      // O ranking inclui a capital, que aparece em bloco destacado.
      supabase.rpc('get_registros_por_municipio', { p_limit: 60 }),
      supabase.rpc('get_cobertura_geografica',    { p_capital: CAPITAL }),
      supabase.rpc('get_cobertura_bairro',        { p_municipio: CAPITAL }),
      contarEst('Ana'),
      contarEst('Gil'),
      contarEst(null),
    ])

    const falha = [m, v, z, d, b, mun, cob, cb, estAna, estGil, estBranco].find(r => r.error)
    if (falha?.error) setErro(falha.error.message)

    if (m.data)   setMetrics(m.data as unknown as RegistrosMetrics)
    if (v.data)   setVinculos(v.data)
    if (z.data)   setZonas(z.data)
    if (d.data)   setDuplicados(d.data as Duplicado[])
    if (b.data)   setBairros(b.data as Bairro[])
    if (mun.data) setMunicipios(mun.data as Municipio[])
    if (cob.data) setCobertura(cob.data as unknown as CoberturaGeografica)
    // RETURNS TABLE devolve array; aqui é sempre uma linha só
    if (cb.data)  setCobBairro((cb.data as CoberturaBairro[])[0] ?? null)

    setEst({
      ana:    estAna.count    ?? 0,
      gil:    estGil.count    ?? 0,
      branco: estBranco.count ?? 0,
    })

    setAtualizadoEm(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Série temporal recarrega sozinha ao trocar o período. O seletor governa
  // só este gráfico, que é o escopo que ele tinha antes do redesenho.
  useEffect(() => {
    let ativo = true
    setSerieLoading(true)
    supabase.rpc('get_registros_por_dia', { p_dias: periodo }).then(({ data }) => {
      if (!ativo) return
      setSerie(data ?? [])
      setSerieLoading(false)
    })
    return () => { ativo = false }
  }, [periodo])

  // ── Derivados ────────────────────────────────────────────────────────

  function variacao(atual: number, anterior: number): number {
    if (anterior === 0) return atual > 0 ? 100 : 0
    return ((atual - anterior) / anterior) * 100
  }

  const localizados = cobertura ? cobertura.total - cobertura.sem_localizacao : 0
  const ehCapital = (m: Municipio) =>
    m.municipio.trim().toLocaleUpperCase('pt-BR') === CAPITAL
  const capitalMun = municipios.find(ehCapital)
  const interior   = municipios.filter(m => !ehCapital(m)).reduce((s, m) => s + m.total, 0)

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="dash dash-page">
        <DashHeader
          atualizadoEm={atualizadoEm}
          periodo={periodo}
          onPeriodo={setPeriodo}
          aba={aba}
          onAba={setAba}
          mostrarEquipe={ehAdmin}
        />

        {erro && (
          <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, color: 'var(--danger-ink)' }}>
            <AlertCircle size={16} />
            {erro}
          </div>
        )}

        {aba === 'visao' ? (
          <>
            <IndicadoresHero
              total={metrics?.total ?? 0}
              hoje={metrics?.hoje ?? 0}
              semana={metrics?.semana ?? 0}
              variacao={variacao(metrics?.hoje ?? 0, metrics?.ontem ?? 0)}
              cidades={metrics?.cidades ?? 0}
              zonas={metrics?.zonas ?? 0}
              secoes={metrics?.secoes ?? 0}
              capital={capitalMun && localizados > 0
                ? { nome: 'Teresina', pct: capitalMun.total / localizados * 100 }
                : undefined}
              serie={serie}
              periodo={periodo}
              loading={loading}
              serieLoading={serieLoading}
            />

            <section className="grid-12">
              <QualidadeCard cobertura={cobertura} loading={loading} />
              <EstCard data={est} loading={loading} />
            </section>

            <section className="grid-12">
              <BairroRanking
                capital={CAPITAL}
                bairros={bairros}
                cobertura={cobBairro}
                interior={interior}
                semLocalizacao={cobertura?.sem_localizacao ?? 0}
                loading={loading}
              />
              <MunicipioRanking
                capital={CAPITAL}
                municipios={municipios}
                localizados={localizados}
                semCidade={cobertura?.sem_localizacao ?? 0}
                loading={loading}
              />
            </section>

            <section className="grid-12">
              <VinculoRanking data={vinculos} loading={loading} />
            </section>

            <section className="grid-12">
              <ZonaCoberturaCard data={zonas}      loading={loading} />
              <DuplicadosCard    data={duplicados} loading={loading} />
            </section>

            <section className="grid-12">
              <UltimosRegistros duplicados={duplicados} />
            </section>
          </>
        ) : (
          ehAdmin && <AgentesTable />
        )}
      </div>
    </AppShell>
  )
}

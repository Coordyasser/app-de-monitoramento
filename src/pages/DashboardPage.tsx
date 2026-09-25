import { useCallback, useEffect, useRef, useState } from 'react'
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
import { VinculoRanking, type Vinculo, type VinculosPorEst } from '@/components/dashboard/VinculoRanking'
import {
  DuplicadosCard, ZonaCoberturaCard,
  type Duplicado, type ZonaCobertura,
} from '@/components/dashboard/ListasDashboard'
import { UltimosRegistros } from '@/components/dashboard/UltimosRegistros'
import { exportarDashboardPDF } from '@/components/dashboard/exportarPdf'
import { ExportarDashModal } from '@/components/dashboard/ExportarDashModal'
import {
  FILTRO_VAZIO, descreverFiltro, filtrarView, paramsFiltro, temFiltro, type FiltroDash,
} from '@/components/dashboard/filtro'
import type {
  Bairro, CoberturaBairro, CoberturaGeografica, Municipio,
} from '@/components/dashboard/tipos'
import type { RegistrosMetrics } from '@/types/database.types'
import { SEM_EST } from '@/lib/est'
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
function contarEst(valor: string | null, filtro: FiltroDash) {
  const q = filtrarView(
    supabase.from('vw_registros_detalhados').select('id', { count: 'exact', head: true }),
    filtro,
  )
  return valor === null ? q.is('est', null) : q.eq('est', valor)
}

export function DashboardPage() {
  const { profile } = useAuth()
  const ehAdmin = profile?.role === 'admin'

  const [aba, setAba] = useState<Aba>('visao')

  const [metrics, setMetrics] = useState<RegistrosMetrics | null>(null)
  const [serie,   setSerie]   = useState<DiaSerie[]>([])
  const [vinculos,      setVinculos]      = useState<Vinculo[]>([])
  const [vinculosEst,   setVinculosEst]   = useState<VinculosPorEst | null>(null)
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

  // ── Exportação em PDF ────────────────────────────────────────────────
  //
  // O recorte escolhido no popup é aplicado ao próprio dashboard, que é
  // fotografado assim que todos os painéis tiverem chegado com ele, e depois
  // volta ao geral. Cada carga anota com qual filtro terminou: comparar o
  // objeto é o que garante que a foto não sai com dados do recorte anterior.
  const paginaRef = useRef<HTMLDivElement>(null)
  const [filtro,         setFiltro]         = useState<FiltroDash>(FILTRO_VAZIO)
  const [modalAberto,    setModalAberto]    = useState(false)
  const [exportando,     setExportando]     = useState(false)
  const [erroExportacao, setErroExportacao] = useState<string | null>(null)
  const [painelCom,  setPainelCom]  = useState<FiltroDash | null>(null)
  const [serieCom,   setSerieCom]   = useState<FiltroDash | null>(null)
  const [ultimosCom, setUltimosCom] = useState<FiltroDash | null>(null)
  const [falhouCom,  setFalhouCom]  = useState<FiltroDash | null>(null)

  async function gerarPDF(f: FiltroDash) {
    setModalAberto(false)
    setErroExportacao(null)
    setExportando(true)

    // Sem recorte, o que está na tela já é o que vai para o PDF: foto direta,
    // sem recarregar nada.
    if (!temFiltro(f)) {
      try {
        if (paginaRef.current) await exportarDashboardPDF(paginaRef.current)
      } catch (e) {
        setErroExportacao(`Não foi possível gerar o PDF: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setExportando(false)
      }
      return
    }
    setFiltro({ ...f })
  }

  useEffect(() => {
    if (!exportando || !temFiltro(filtro)) return
    if (falhouCom === filtro) {
      setErroExportacao(`Não foi possível aplicar o recorte: ${erro ?? 'erro ao carregar'}`)
      setExportando(false)
      setFiltro(FILTRO_VAZIO)
      return
    }
    if (painelCom !== filtro || serieCom !== filtro || ultimosCom !== filtro) return
    const raiz = paginaRef.current
    if (!raiz) return

    let ativo = true
    // Um quadro para o React pintar os números novos antes da foto.
    const quadro = requestAnimationFrame(async () => {
      try {
        await exportarDashboardPDF(raiz)
      } catch (e) {
        if (ativo) setErroExportacao(`Não foi possível gerar o PDF: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        if (ativo) {
          setExportando(false)
          setFiltro(FILTRO_VAZIO)
        }
      }
    })
    return () => { ativo = false; cancelAnimationFrame(quadro) }
  }, [exportando, filtro, painelCom, serieCom, ultimosCom, falhouCom, erro])

  // ── Carga dos painéis ────────────────────────────────────────────────

  const carregar = useCallback(async (f: FiltroDash) => {
    setLoading(true)
    setErro(null)

    const pf = paramsFiltro(f)
    // Vínculos separados por Est, com o mesmo recorte de datas. Se o recorte
    // já fixa um Est, a lista geral é a própria separação.
    const vinculosDoEst = (est: string) =>
      supabase.rpc('get_registros_por_vinculo', { p_limit: 200, ...paramsFiltro({ ...f, est }) })
    const [[m, v, z, d, b, mun, cob, cb, estAna, estGil, estBranco], vEst] = await Promise.all([Promise.all([
      supabase.rpc('get_registros_metrics', pf),
      // Todos os vínculos: o gráfico existe para dar a dimensão do conjunto,
      // e cortar na 12ª liderança escondia dois terços da lista.
      supabase.rpc('get_registros_por_vinculo',   { p_limit: 200, ...pf }),
      supabase.rpc('get_registros_por_zona',      { p_limit: 8, ...pf }),
      supabase.rpc('get_registros_duplicados',    { p_limit: 8, ...pf }),
      // 70 bairros da capital têm registro. Mostrar todos deixaria o cartão
      // com quase dois mil pixels de altura; 25 cobre a maior parte e o
      // rodapé declara o resto.
      supabase.rpc('get_registros_por_bairro',    { p_municipio: CAPITAL, p_limit: 25, ...pf }),
      // O ranking inclui a capital, que aparece em bloco destacado.
      supabase.rpc('get_registros_por_municipio', { p_limit: 60, ...pf }),
      supabase.rpc('get_cobertura_geografica',    { p_capital: CAPITAL, ...pf }),
      supabase.rpc('get_cobertura_bairro',        { p_municipio: CAPITAL, ...pf }),
      contarEst('Ana', f),
      contarEst('Gil', f),
      contarEst(null, f),
    ]), f.est
      ? Promise.resolve(null)
      : Promise.all([vinculosDoEst('Gil'), vinculosDoEst('Ana'), vinculosDoEst(SEM_EST)])])

    const falha = [m, v, z, d, b, mun, cob, cb, estAna, estGil, estBranco, ...(vEst ?? [])].find(r => r.error)
    if (falha?.error) {
      setErro(falha.error.message)
      setFalhouCom(f)
    }

    if (m.data)   setMetrics(m.data as unknown as RegistrosMetrics)
    if (v.data)   setVinculos(v.data)
    const [vGil, vAna, vSem] = vEst ?? []
    setVinculosEst(vGil?.data && vAna?.data && vSem?.data
      ? { Gil: vGil.data, Ana: vAna.data, SEM: vSem.data }
      : null)
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
    setPainelCom(f)
  }, [])

  useEffect(() => { carregar(filtro) }, [carregar, filtro])

  // Série temporal recarrega sozinha ao trocar o período. O seletor governa
  // só este gráfico, que é o escopo que ele tinha antes do redesenho.
  useEffect(() => {
    let ativo = true
    setSerieLoading(true)
    supabase.rpc('get_registros_por_dia', { p_dias: periodo, ...paramsFiltro(filtro) }).then(({ data, error }) => {
      if (!ativo) return
      if (error) { setErro(error.message); setFalhouCom(filtro) }
      setSerie(data ?? [])
      setSerieLoading(false)
      setSerieCom(filtro)
    })
    return () => { ativo = false }
  }, [periodo, filtro])

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

  // Esqueleto só na primeira carga. As recargas da exportação (com o recorte
  // e de volta ao geral) trocam os números no lugar, sem a tela piscar.
  const esqueleto      = loading && !atualizadoEm
  const esqueletoSerie = serieLoading && serie.length === 0

  const recorte = descreverFiltro(filtro)
  // Com datas no recorte, o gráfico diário mostra o intervalo inteiro.
  const serieNoIntervalo = Boolean(filtro.de || filtro.ate)

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="dash dash-page" ref={paginaRef}>
        <DashHeader
          atualizadoEm={atualizadoEm}
          periodo={periodo}
          onPeriodo={setPeriodo}
          aba={aba}
          onAba={setAba}
          mostrarEquipe={ehAdmin}
          onExportar={() => setModalAberto(true)}
          exportando={exportando || loading}
          recorte={recorte}
        />

        {erroExportacao && (
          <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, color: 'var(--danger-ink)' }}>
            <AlertCircle size={16} />
            {erroExportacao}
          </div>
        )}

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
              serieCompleta={serieNoIntervalo}
              loading={esqueleto}
              serieLoading={esqueletoSerie}
            />

            <section className="grid-12">
              <QualidadeCard cobertura={cobertura} loading={esqueleto} />
              <EstCard data={est} loading={esqueleto} />
            </section>

            <section className="grid-12">
              <BairroRanking
                capital={CAPITAL}
                bairros={bairros}
                cobertura={cobBairro}
                interior={interior}
                semLocalizacao={cobertura?.sem_localizacao ?? 0}
                loading={esqueleto}
              />
              <MunicipioRanking
                capital={CAPITAL}
                municipios={municipios}
                localizados={localizados}
                semCidade={cobertura?.sem_localizacao ?? 0}
                loading={esqueleto}
              />
            </section>

            <section className="grid-12">
              <VinculoRanking data={vinculos} porEst={vinculosEst} loading={esqueleto} />
            </section>

            <section className="grid-12">
              <ZonaCoberturaCard data={zonas}      loading={esqueleto} />
              <DuplicadosCard    data={duplicados} loading={esqueleto} />
            </section>

            <section className="grid-12">
              <UltimosRegistros duplicados={duplicados} filtro={filtro} onPronto={setUltimosCom} />
            </section>
          </>
        ) : (
          ehAdmin && <AgentesTable />
        )}
      </div>

      <ExportarDashModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onGerar={gerarPDF}
      />
    </AppShell>
  )
}

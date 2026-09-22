import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronRight, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { capitalizarLugar, ehNaoConsta } from '@/lib/texto'
import { situacaoEfetiva } from '@/lib/situacao'
import { formatarTitulo } from '@/lib/titulo'
import { dataHora, digitos, iniciais, nomeProprio, paletaPara } from './formato'
import type { Duplicado } from './ListasDashboard'
import type { RegistroDetalhado } from '@/types/database.types'

// A mesma view e as mesmas colunas da lista de registros: só muda a forma.
const COLUNAS = 'id,nome,contato,titulo,vinculo,cidade,zona,secao,created_at,situacao,est'
const LIMITE  = 8

interface Props {
  /** Já carregados no dashboard — a marca "repetido" sai daqui, sem nova consulta */
  duplicados: Duplicado[]
}

const ESTILO_SITUACAO: Record<string, [string, string]> = {
  OK:       ['status-ok',      'OK'],
  PENDENTE: ['status-pending', 'Pendente'],
  CONFERIR: ['status-error',   'Conferir'],
}

const COR_EST: Record<string, string> = {
  Ana: 'var(--est-a)',
  Gil: 'var(--est-b)',
}

export function UltimosRegistros({ duplicados }: Props) {
  const navigate = useNavigate()
  const [linhas,  setLinhas]  = useState<RegistroDetalhado[]>([])
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    supabase
      .from('vw_registros_detalhados')
      .select(COLUNAS)
      .order('created_at', { ascending: false })
      .limit(LIMITE)
      .then(({ data, error }) => {
        if (!ativo) return
        setLoading(false)
        if (error) { setErro(error.message); return }
        setLinhas((data as RegistroDetalhado[]) ?? [])
      })
    return () => { ativo = false }
  }, [])

  // Telefone repetido: comparação por dígitos, porque a planilha grava
  // "(86) 98140-4098" e "86981404098" para o mesmo número.
  const repetidos = new Set(duplicados.map(d => digitos(d.contato)).filter(Boolean))

  return (
    <article className="card span-12">
      <div className="card-head">
        <div>
          <h2 className="card-title">Últimos registros</h2>
          <p className="card-sub">Os {LIMITE} mais recentes da equipe</p>
        </div>
        <Link to="/registros">Ver todos</Link>
      </div>

      {erro ? (
        <p className="card-sub" style={{ color: 'var(--danger-ink)' }}>{erro}</p>
      ) : loading ? (
        <div className="rows">
          {Array.from({ length: LIMITE }).map((_, i) => (
            <div key={i} className="skel skel-line" style={{ height: 44, margin: '6px 0' }} />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <p className="card-sub">Nenhum registro ainda.</p>
      ) : (
        <div className="table-wrap">
          <table className="records">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Título</th>
                <th>Vínculo</th>
                <th>Situação</th>
                <th>Est</th>
                <th>Localização</th>
                <th>Data</th>
                <th><span className="sr-only">Abrir</span></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(r => (
                <Linha key={r.id} r={r} repetidos={repetidos} onAbrir={() => navigate(`/registros/${r.id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}

function Linha({ r, repetidos, onAbrir }: {
  r: RegistroDetalhado
  repetidos: Set<string>
  onAbrir: () => void
}) {
  const nome = nomeProprio(r.nome ?? '')
  const [fundo, tinta] = paletaPara(r.nome ?? '')

  const temContato = !!r.contato && !ehNaoConsta(r.contato)
  const eRepetido  = temContato && repetidos.has(digitos(r.contato))

  const vinculo = r.vinculo && !ehNaoConsta(r.vinculo) ? nomeProprio(r.vinculo) : null
  const [vFundo, vTinta] = paletaPara(r.vinculo ?? '')

  const situacao = situacaoEfetiva(r)
  const [classe, rotulo] = ESTILO_SITUACAO[String(situacao).toUpperCase()] ?? ['status-pending', situacao ?? '—']

  const temCidade = !!r.cidade && !ehNaoConsta(r.cidade)
  const temZona   = !!r.zona   && !ehNaoConsta(r.zona)
  const temSecao  = !!r.secao  && !ehNaoConsta(r.secao)

  return (
    <tr onClick={onAbrir}>
      <td>
        <div className="person-cell">
          <span className="avatar" style={{ background: fundo, color: tinta }} aria-hidden="true">
            {iniciais(r.nome ?? '')}
          </span>
          <div className="person-cell-text">
            <span className="person-cell-name" title={nome}>{nome}</span>
            <span className="person-cell-phone">
              {temContato
                ? <>
                    {r.contato}
                    {eRepetido && (
                      <span className="mini-badge" title="Contato presente em mais de um registro">
                        repetido
                      </span>
                    )}
                  </>
                : <span className="muted-missing">Sem telefone</span>}
            </span>
          </div>
        </div>
      </td>

      <td>
        {r.titulo && !ehNaoConsta(r.titulo)
          ? <span className="mono">{formatarTitulo(r.titulo)}</span>
          : <span className="muted-missing">Não informado</span>}
      </td>

      <td>
        {vinculo
          ? <span className="pill" style={{ background: vFundo, color: vTinta }} title={vinculo}>{vinculo}</span>
          : <span className="muted-missing">Sem vínculo</span>}
      </td>

      <td>
        {situacao
          ? <span className={`status-pill ${classe}`}><i aria-hidden="true" />{rotulo}</span>
          : <span className="muted-missing">—</span>}
      </td>

      <td>
        {r.est
          ? <span className="est-tag">
              <i style={{ background: COR_EST[r.est] ?? 'var(--ink-3)' }} aria-hidden="true" />
              {r.est}
            </span>
          : <span className="muted-missing">Em branco</span>}
      </td>

      <td>
        {/* Nunca o texto cru: "ZNÃO CO..." cortado não informa nada. */}
        {temCidade && temZona ? (
          <span className="loc">
            <MapPin size={13} style={{ color: 'var(--ok)' }} aria-hidden="true" />
            {capitalizarLugar(r.cidade)}, Zona {r.zona}{temSecao ? `, Seção ${r.secao}` : ''}
          </span>
        ) : temZona ? (
          <span className="loc-partial">
            <AlertCircle size={12} aria-hidden="true" />
            Zona {r.zona}{temSecao ? `, Seção ${r.secao}` : ''}, sem cidade
          </span>
        ) : (
          <span className="loc-missing">
            <AlertCircle size={12} aria-hidden="true" />
            Sem zona e seção
          </span>
        )}
      </td>

      <td className="date-cell">{dataHora(r.created_at)}</td>

      <td>
        <button
          type="button"
          className="row-btn"
          aria-label={`Abrir registro de ${nome}`}
          onClick={e => { e.stopPropagation(); onAbrir() }}
        >
          <ChevronRight size={16} />
        </button>
      </td>
    </tr>
  )
}

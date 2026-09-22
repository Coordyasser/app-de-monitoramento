import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

export type Periodo = 7 | 30 | 90
export type Aba     = 'visao' | 'equipe'

const PERIODOS: Periodo[] = [7, 30, 90]

interface Props {
  atualizadoEm: Date | null
  periodo:      Periodo
  onPeriodo:    (p: Periodo) => void
  aba:          Aba
  onAba:        (a: Aba) => void
  mostrarEquipe: boolean
}

/**
 * Cabeçalho da aba.
 *
 * O seletor de período governa só o gráfico diário, que é o escopo que ele já
 * tinha antes do redesenho — ampliar para a tela inteira exigiria período em
 * todas as RPCs, o que é mudança de backend.
 */
export function DashHeader({
  atualizadoEm, periodo, onPeriodo, aba, onAba, mostrarEquipe,
}: Props) {
  return (
    <>
      <header className="pagehead">
        <div>
          <div className="status">
            <span className="status-dot" aria-hidden="true" />
            <span>
              {atualizadoEm
                ? `Atualizado em ${atualizadoEm.toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}. Base conferida com o TRE-PI`
                : 'Carregando os números...'}
            </span>
          </div>
          <h1 className="page-title">Dashboard</h1>
          <p className="card-sub">Consolidação dos registros de toda a equipe</p>
        </div>

        <div className="pagehead-actions">
          <div className="segmented" role="group" aria-label="Período do gráfico diário">
            {PERIODOS.map(p => (
              <button
                key={p}
                type="button"
                aria-pressed={p === periodo}
                onClick={() => onPeriodo(p)}
              >
                {p} dias
              </button>
            ))}
          </div>
          <Link to="/registros/novo" className="btn btn-primary">
            <Plus size={16} />
            Novo registro
          </Link>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Visões do dashboard">
        <button
          type="button" role="tab"
          aria-selected={aba === 'visao'}
          onClick={() => onAba('visao')}
        >
          Visão geral
        </button>
        {mostrarEquipe && (
          <button
            type="button" role="tab"
            aria-selected={aba === 'equipe'}
            onClick={() => onAba('equipe')}
          >
            Equipe
          </button>
        )}
      </div>
    </>
  )
}

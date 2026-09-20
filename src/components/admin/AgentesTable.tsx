import { useEffect, useState, useCallback } from 'react'
import { Loader2, AlertCircle, ShieldAlert, ShieldOff, ShieldCheck, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, Modal, Button } from '@/components/ui'

interface AgentRow {
  id:                   string
  full_name:            string
  phone:                string | null
  role:                 string
  lgpd_consent:         boolean
  deletion_requested_at: string | null
  created_at:           string
}

// ── Estado do consentimento ────────────────────────────────────────────────
// `lgpd_consent = false` cobre duas situações juridicamente distintas, e a
// diferença entre elas está em `deletion_requested_at`:
//   • com data  → o titular pediu exclusão e retirou o consentimento
//   • sem data  → nunca houve consentimento registrado (conta criada fora
//                 do /register, onde o aceite é obrigatório)
type EstadoLgpd = 'consentido' | 'retirado' | 'ausente'

function estadoLgpd(agent: AgentRow): EstadoLgpd {
  if (agent.lgpd_consent) return 'consentido'
  return agent.deletion_requested_at ? 'retirado' : 'ausente'
}

const LGPD_UI: Record<EstadoLgpd, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  consentido: {
    label: 'Consentido',
    cls:   'text-emerald-600 dark:text-emerald-400',
    Icon:  ShieldCheck,
  },
  retirado: {
    label: 'Consentimento retirado',
    cls:   'text-rose-500 dark:text-rose-400',
    Icon:  ShieldOff,
  },
  ausente: {
    label: 'Sem registro',
    cls:   'text-amber-600 dark:text-amber-400',
    Icon:  ShieldAlert,
  },
}

/** Ações disponíveis no modal de confirmação */
type Acao = 'revogar' | 'restaurar' | 'consentimento'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  agent:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  revoked: 'bg-rose-100   text-rose-700   dark:bg-rose-900/40   dark:text-rose-300',
}

export function AgentesTable() {
  const [agents,       setAgents]       = useState<AgentRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [alvo,         setAlvo]         = useState<{ agent: AgentRow; acao: Acao } | null>(null)
  const [acting,       setActing]       = useState(false)

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id,full_name,phone,role,lgpd_consent,deletion_requested_at,created_at')
      .order('created_at', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }
    setAgents((data as AgentRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  async function confirmar() {
    if (!alvo) return
    const { agent, acao } = alvo
    setActing(true)
    setError(null)

    // 'agent' → 'revoked' ou 'revoked' → 'agent'
    // Ambos os valores são válidos após migration 006 (CHECK atualizado)
    const patch = acao === 'consentimento'
      ? { lgpd_consent: true }
      : { role: agent.role === 'agent' ? 'revoked' : 'agent' }

    const { error: err } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', agent.id)

    if (err) {
      setError(err.message)
    } else {
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, ...patch } : a))
    }

    setActing(false)
    setAlvo(null)
  }

  return (
    <>
      <Card padding="none" className="overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/20 dark:border-white/10">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Gestão de Agentes
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {agents.length} perfil{agents.length !== 1 ? 's' : ''} registrado{agents.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center gap-2 px-6 py-4 text-rose-600 dark:text-rose-400 text-sm">
            <AlertCircle size={16} />{error}
          </div>
        )}
        {!loading && !error && agents.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-500">
            Nenhum agente cadastrado ainda.
          </div>
        )}

        {!loading && agents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 dark:border-white/5">
                  {['Agente', 'Telefone', 'Role', 'LGPD', 'Exclusão solicitada', 'Cadastro', 'Ação'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => (
                  <tr
                    key={agent.id}
                    className={[
                      'border-b border-white/10 dark:border-white/5 transition-colors',
                      i % 2 === 0 ? '' : 'bg-white/20 dark:bg-white/3',
                      'hover:bg-slate-50/40 dark:hover:bg-white/5',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                          <User size={13} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                          {agent.full_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {agent.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[agent.role] ?? ROLE_BADGE.revoked}`}>
                        {agent.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const { label, cls, Icon } = LGPD_UI[estadoLgpd(agent)]
                        return (
                          <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${cls}`}>
                            <Icon size={13} className="shrink-0" /> {label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {agent.deletion_requested_at
                        ? <span className="text-rose-500">{formatDate(agent.deletion_requested_at)}</span>
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(agent.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Admins não podem ser revogados por esta interface */}
                        {agent.role !== 'admin' && (
                          <button
                            onClick={() => setAlvo({ agent, acao: agent.role === 'agent' ? 'revogar' : 'restaurar' })}
                            className={[
                              'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
                              agent.role === 'agent'
                                ? 'text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/20'
                                : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/20',
                            ].join(' ')}
                          >
                            {agent.role === 'agent' ? 'Revogar' : 'Restaurar'}
                          </button>
                        )}

                        {/* Só para quem nunca teve consentimento registrado.
                            Quem retirou o consentimento não reaparece aqui:
                            um novo aceite tem que partir do próprio titular. */}
                        {estadoLgpd(agent) === 'ausente' && (
                          <button
                            onClick={() => setAlvo({ agent, acao: 'consentimento' })}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all whitespace-nowrap
                                       text-amber-700 border-amber-200 hover:bg-amber-50
                                       dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20"
                          >
                            Registrar consentimento
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de confirmação */}
      <Modal
        open={!!alvo}
        onClose={() => !acting && setAlvo(null)}
        title={
          alvo?.acao === 'revogar'       ? 'Revogar credenciais'
          : alvo?.acao === 'restaurar'   ? 'Restaurar acesso'
          : alvo?.acao === 'consentimento' ? 'Registrar consentimento LGPD'
          : ''
        }
        maxWidth="sm"
      >
        {alvo && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {alvo.acao === 'revogar' && (
                <>Tem certeza que deseja revogar as credenciais de <strong>{alvo.agent.full_name}</strong>? O agente perderá o acesso imediatamente.</>
              )}
              {alvo.acao === 'restaurar' && (
                <>Restaurar o acesso de <strong>{alvo.agent.full_name}</strong> à plataforma?</>
              )}
              {alvo.acao === 'consentimento' && (
                <>Registrar que <strong>{alvo.agent.full_name}</strong> forneceu consentimento para o tratamento dos dados pessoais.</>
              )}
            </p>

            {alvo.acao === 'consentimento' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6
                            rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                Use apenas quando o aceite tiver sido obtido de fato — em contas criadas
                pela coordenação, o formulário de cadastro não passou pelo titular. Este
                registro vale como declaração de quem administra.
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setAlvo(null)} disabled={acting}>
                Cancelar
              </Button>
              <Button
                variant={alvo.acao === 'revogar' ? 'danger' : 'primary'}
                loading={acting}
                onClick={confirmar}
              >
                {alvo.acao === 'revogar'        ? 'Confirmar revogação'
                 : alvo.acao === 'restaurar'    ? 'Restaurar acesso'
                 : 'Confirmar consentimento'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { Loader2, AlertCircle, ShieldOff, ShieldCheck, User } from 'lucide-react'
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
  const [actionTarget, setActionTarget] = useState<AgentRow | null>(null)
  const [acting,       setActing]       = useState(false)

  const isRevoke  = actionTarget?.role === 'agent'
  const isRestore = actionTarget?.role === 'revoked'

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

  async function handleRoleChange() {
    if (!actionTarget) return
    setActing(true)

    // 'agent' → 'revoked' ou 'revoked' → 'agent'
    // Ambos os valores são válidos após migration 006 (CHECK atualizado)
    const newRole = actionTarget.role === 'agent' ? 'revoked' : 'agent'

    const { error: err } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', actionTarget.id)

    if (!err) {
      setAgents(prev =>
        prev.map(a => a.id === actionTarget.id ? { ...a, role: newRole } : a)
      )
    }

    setActing(false)
    setActionTarget(null)
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
                      {agent.lgpd_consent ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck size={13} /> Consentido
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-rose-500 dark:text-rose-400">
                          <ShieldOff size={13} /> Revogado
                        </span>
                      )}
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
                      {/* Admins não podem ser revogados por esta interface */}
                      {agent.role !== 'admin' && (
                        <button
                          onClick={() => setActionTarget(agent)}
                          className={[
                            'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                            agent.role === 'agent'
                              ? 'text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/20'
                              : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/20',
                          ].join(' ')}
                        >
                          {agent.role === 'agent' ? 'Revogar' : 'Restaurar'}
                        </button>
                      )}
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
        open={!!actionTarget}
        onClose={() => !acting && setActionTarget(null)}
        title={isRevoke ? 'Revogar credenciais' : isRestore ? 'Restaurar acesso' : ''}
        maxWidth="sm"
      >
        {actionTarget && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              {isRevoke
                ? <>Tem certeza que deseja revogar as credenciais de <strong>{actionTarget.full_name}</strong>? O agente perderá o acesso imediatamente.</>
                : <>Restaurar o acesso de <strong>{actionTarget.full_name}</strong> à plataforma?</>
              }
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setActionTarget(null)} disabled={acting}>
                Cancelar
              </Button>
              <Button
                variant={isRevoke ? 'danger' : 'primary'}
                loading={acting}
                onClick={handleRoleChange}
              >
                {isRevoke ? 'Confirmar revogação' : 'Restaurar acesso'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

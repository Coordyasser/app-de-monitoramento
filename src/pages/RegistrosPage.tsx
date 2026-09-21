import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, Plus } from 'lucide-react'
import { useAuth }        from '@/contexts/AuthContext'
import { AppShell }       from '@/components/layout/AppShell'
import { Button, PageHeader } from '@/components/ui'
import { RegistrosTable } from '@/components/registros/RegistrosTable'

export function RegistrosPage() {
  const { profile } = useAuth()
  const location    = useLocation()
  const estado      = location.state as { criado?: boolean; excluido?: boolean } | null

  // A página de detalhes redireciona para cá depois de excluir
  const [aviso, setAviso] = useState<'criado' | 'excluido' | null>(
    estado?.criado ? 'criado' : estado?.excluido ? 'excluido' : null
  )

  // O aviso some sozinho — e não reaparece ao recarregar
  useEffect(() => {
    if (!aviso) return
    window.history.replaceState({}, '')
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  const ehAdmin = profile?.role === 'admin'

  return (
    <AppShell>
      <PageHeader
        title="Registros"
        subtitle={ehAdmin
          ? 'Todos os registros consolidados pela equipe'
          : 'Os registros que você consolidou'}
        actions={
          <Link to="/registros/novo">
            <Button icon={<Plus size={17} />}>Novo registro</Button>
          </Link>
        }
      />

      {aviso && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl
                        bg-emerald-50 dark:bg-emerald-900/20
                        text-emerald-700 dark:text-emerald-300 text-sm animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          {aviso === 'criado' ? 'Registro salvo com sucesso.' : 'Registro excluído.'}
        </div>
      )}

      <RegistrosTable />
    </AppShell>
  )
}

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
  const [sucesso, setSucesso] = useState(
    (location.state as { criado?: boolean } | null)?.criado ?? false
  )

  // O aviso de sucesso some sozinho — e não reaparece ao recarregar
  useEffect(() => {
    if (!sucesso) return
    window.history.replaceState({}, '')
    const t = setTimeout(() => setSucesso(false), 5000)
    return () => clearTimeout(t)
  }, [sucesso])

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

      {sucesso && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl
                        bg-emerald-50 dark:bg-emerald-900/20
                        text-emerald-700 dark:text-emerald-300 text-sm animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          Registro salvo com sucesso.
        </div>
      )}

      <RegistrosTable />
    </AppShell>
  )
}

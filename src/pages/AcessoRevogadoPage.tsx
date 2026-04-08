import { ShieldOff, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Card, Button } from '@/components/ui'

export function AcessoRevogadoPage() {
  const { signOut } = useAuth()
  const navigate    = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4
                    bg-gradient-to-br from-rose-50 via-white to-slate-100
                    dark:from-slate-950 dark:via-rose-950/20 dark:to-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-slate-400/10 rounded-full blur-3xl" />
      </div>

      <Card padding="lg" className="w-full max-w-md text-center relative z-10 animate-slide-up">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl
                        bg-rose-100 dark:bg-rose-900/40 mx-auto mb-6">
          <ShieldOff size={32} className="text-rose-600 dark:text-rose-400" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Acesso revogado
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
          Suas credenciais foram revogadas por um administrador.
          Entre em contato com a coordenação do EleitoWatch para mais informações.
        </p>

        <Button
          variant="danger"
          size="lg"
          icon={<LogOut size={18} />}
          onClick={handleSignOut}
          className="w-full"
        >
          Sair da conta
        </Button>
      </Card>
    </div>
  )
}

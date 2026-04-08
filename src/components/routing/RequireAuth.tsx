import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface RequireAuthProps {
  children:   ReactNode
  adminOnly?: boolean
}

export function RequireAuth({ children, adminOnly = false }: RequireAuthProps) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    )
  }

  // Sem sessão: redireciona para login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Conta revogada: redireciona para home sem acesso a rotas protegidas
  if (profile?.role === 'revoked') {
    return <Navigate to="/acesso-revogado" replace />
  }

  // Rota exclusiva para admin
  if (adminOnly && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

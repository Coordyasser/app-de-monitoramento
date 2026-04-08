import { type ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12
                    bg-gradient-to-br from-indigo-100 via-white to-purple-100
                    dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900">
      {/* Orbs de fundo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 mb-8 group">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl
                        bg-gradient-to-br from-indigo-600 to-purple-600
                        shadow-lg shadow-indigo-500/40
                        group-hover:shadow-indigo-500/60 transition-shadow">
          <ShieldCheck size={22} className="text-white" />
        </div>
        <span className="text-2xl font-bold text-gradient">EleitoWatch</span>
      </Link>

      {/* Card container */}
      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  )
}

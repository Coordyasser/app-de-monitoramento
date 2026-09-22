import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, LayoutDashboard, FileText, PlusCircle, Settings, LogOut, Menu, Moon, Sun, X,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTema } from '@/hooks/useTema'

const navItems = [
  { to: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard, public: false },
  { to: '/registros/novo', label: 'Novo registro', icon: PlusCircle,      public: false },
  { to: '/registros',      label: 'Registros',     icon: FileText,        public: false },
  { to: '/settings',       label: 'Configurações', icon: Settings,        public: false },
]

export function Topbar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { tema, alternar } = useTema()
  const escuro = tema === 'escuro'

  const visibleItems = navItems.filter(item => item.public || !!profile)

  // Comparação exata: /registros não pode acender junto com /registros/novo
  const isActive = (to: string) => location.pathname === to

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass border-b border-white/30 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/30">
                <ShieldCheck size={18} className="text-white" />
              </div>
              <span className="font-bold text-lg text-gradient hidden sm:block">
                Concept Plan
              </span>
            </Link>

            {/* Nav desktop */}
            <nav className="hidden md:flex items-center gap-1">
              {visibleItems.map(({ to, label, icon: Icon }) => {
                const active = isActive(to)
                return (
                  <Link
                    key={to}
                    to={to}
                    className={[
                      'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                      active
                        ? 'bg-indigo-600/15 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10',
                    ].join(' ')}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                )
              })}
            </nav>

            {/* Ações direita */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={alternar}
                title={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                aria-label={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                aria-pressed={escuro}
                className="p-2 rounded-xl text-slate-500 dark:text-slate-300
                           hover:bg-white/40 dark:hover:bg-white/10 transition-colors duration-200"
              >
                {escuro ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {profile ? (
                <>
                  <span className="hidden sm:block text-sm text-slate-500 dark:text-slate-400">
                    {profile.full_name.split(' ')[0]}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-500
                               hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20
                               transition-colors duration-200"
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:block">Sair</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl text-sm font-medium
                             bg-gradient-to-r from-indigo-600 to-purple-600 text-white
                             hover:from-indigo-500 hover:to-purple-500 transition-all duration-200
                             shadow-lg shadow-indigo-500/25"
                >
                  Entrar
                </Link>
              )}

              {/* Menu mobile */}
              <button
                className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-white/40 dark:hover:bg-white/10 transition-colors"
                onClick={() => setMobileOpen(v => !v)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Nav mobile */}
      {mobileOpen && (
        <div className="md:hidden glass border-b border-white/20 dark:border-white/10 animate-slide-up">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {visibleItems.map(({ to, label, icon: Icon }) => {
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={[
                    'flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                    active
                      ? 'bg-indigo-600/15 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/10',
                  ].join(' ')}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </header>
  )
}

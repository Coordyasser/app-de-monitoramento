import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck, LayoutDashboard, Search, FileText, Settings, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const navItems = [
  { to: '/buscar-secao',  label: 'Registrar',     icon: Search,          public: true  },
  { to: '/ocorrencias',   label: 'Ocorrências',    icon: FileText,        public: false },
  { to: '/admin',         label: 'Dashboard',      icon: LayoutDashboard, admin: true   },
  { to: '/settings',      label: 'Configurações',  icon: Settings,        public: false },
]

export function Topbar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleItems = navItems.filter(item => {
    if (item.admin) return profile?.role === 'admin'
    if (!item.public) return !!profile
    return true
  })

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
                EleitoWatch
              </span>
            </Link>

            {/* Nav desktop */}
            <nav className="hidden md:flex items-center gap-1">
              {visibleItems.map(({ to, label, icon: Icon }) => {
                const active = location.pathname.startsWith(to)
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
              const active = location.pathname.startsWith(to)
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

import { Link } from 'react-router-dom'
import { ShieldCheck, Search, FileText, BarChart3, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { Card, Button } from '@/components/ui'

const features = [
  {
    icon:  Search,
    title: 'Localização Precisa',
    desc:  'Encontre sua seção eleitoral em 5 níveis: Município, Zona, Local, Seção e Urna.',
    color: 'indigo',
  },
  {
    icon:  FileText,
    title: 'Registro de Ocorrências',
    desc:  'Registre incidentes com foto, localização GPS e categoria em tempo real.',
    color: 'purple',
  },
  {
    icon:  BarChart3,
    title: 'Monitoramento em Tempo Real',
    desc:  'Coordenadores acompanham todas as ocorrências do Piauí em um painel centralizado.',
    color: 'violet',
  },
]

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400',
  purple: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
  violet: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
}

export function HomePage() {
  const { profile } = useAuth()

  return (
    <AppShell>
      {/* Hero */}
      <section className="text-center py-16 md:py-24">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-6">
          <ShieldCheck size={16} />
          Piauí — Monitoramento Eleitoral Oficial
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-4 leading-tight">
          Elei<span className="text-gradient">toWatch</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto mb-8">
          Plataforma de registro e monitoramento de ocorrências eleitorais integrada com
          os dados oficiais do TRE-PI.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/buscar-secao">
            <Button size="lg" icon={<Search size={18} />}>
              Registrar ocorrência
            </Button>
          </Link>
          {!profile && (
            <Link to="/register">
              <Button size="lg" variant="secondary" icon={<ArrowRight size={18} />}>
                Criar conta de agente
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-6 pb-16">
        {features.map(({ icon: Icon, title, desc, color }) => (
          <Card key={title} hover padding="lg">
            <div className={`inline-flex p-3 rounded-xl mb-4 ${colorMap[color]}`}>
              <Icon size={22} />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
          </Card>
        ))}
      </section>
    </AppShell>
  )
}

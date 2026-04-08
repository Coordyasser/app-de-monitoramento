import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title:     string
  subtitle?: string
  back?:     string | true   // true = navigate(-1), string = rota específica
  actions?:  ReactNode
}

export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  const navigate = useNavigate()

  function handleBack() {
    if (!back) return
    if (back === true) navigate(-1)
    else navigate(back)
  }

  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div className="flex items-start gap-3">
        {back && (
          <button
            onClick={handleBack}
            aria-label="Voltar"
            className="mt-0.5 p-2 rounded-xl text-slate-400 hover:text-slate-700
                       hover:bg-white/50 dark:hover:text-slate-200 dark:hover:bg-white/10
                       transition-all duration-200 shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="shrink-0 mt-0.5">
          {actions}
        </div>
      )}
    </div>
  )
}

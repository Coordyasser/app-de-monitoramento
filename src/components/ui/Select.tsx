import { forwardRef, type SelectHTMLAttributes } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?:    string
  error?:    string
  options:   SelectOption[]
  loading?:  boolean
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, loading = false, placeholder, className = '', id, disabled, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled || loading}
            className={[
              'w-full h-11 rounded-xl px-4 pr-10 text-sm appearance-none',
              'bg-white/50 dark:bg-white/5',
              'border border-white/60 dark:border-white/10',
              'backdrop-blur-sm',
              'text-slate-900 dark:text-slate-100',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400',
              'dark:focus:ring-indigo-400/40 dark:focus:border-indigo-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error ? 'border-rose-400 focus:ring-rose-500/40' : '',
              className,
            ].join(' ')}
            {...props}
          >
            <option value="" disabled>
              {loading ? 'Carregando...' : placeholder ?? 'Selecione...'}
            </option>
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Ícone direito: spinner ou chevron */}
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : <ChevronDown size={16} />
            }
          </span>
        </div>

        {error && (
          <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'

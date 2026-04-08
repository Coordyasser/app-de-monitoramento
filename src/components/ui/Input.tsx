import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string
  error?:   string
  icon?:    ReactNode
  hint?:    string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, hint, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full h-11 rounded-xl px-4 text-sm',
              'bg-white/50 dark:bg-white/5',
              'border border-white/60 dark:border-white/10',
              'backdrop-blur-sm',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'text-slate-900 dark:text-slate-100',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400',
              'dark:focus:ring-indigo-400/40 dark:focus:border-indigo-500',
              error
                ? 'border-rose-400 focus:ring-rose-500/40 focus:border-rose-400'
                : '',
              icon ? 'pl-10' : '',
              className,
            ].join(' ')}
            {...props}
          />
        </div>
        {hint && !error && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

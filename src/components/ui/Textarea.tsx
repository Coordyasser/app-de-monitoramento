import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:   string
  error?:   string
  hint?:    string
  counter?: { current: number; max: number }
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, counter, className = '', id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={textareaId}
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {label}
            </label>
            {counter && (
              <span className={[
                'text-xs tabular-nums',
                counter.current > counter.max * 0.9
                  ? 'text-amber-500'
                  : 'text-slate-400 dark:text-slate-500',
              ].join(' ')}>
                {counter.current}/{counter.max}
              </span>
            )}
          </div>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={[
            'w-full rounded-xl px-4 py-3 text-sm resize-none',
            'bg-white/50 dark:bg-white/5',
            'border border-white/60 dark:border-white/10',
            'backdrop-blur-sm',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'text-slate-900 dark:text-slate-100',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400',
            'dark:focus:ring-indigo-400/40 dark:focus:border-indigo-500',
            error ? 'border-rose-400 focus:ring-rose-500/40 focus:border-rose-400' : '',
            className,
          ].join(' ')}
          {...props}
        />
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
Textarea.displayName = 'Textarea'

import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  loading?:  boolean
  icon?:     ReactNode
  children:  ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 ' +
    'hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/40 ' +
    'active:scale-[0.98] disabled:from-indigo-400 disabled:to-purple-400 disabled:shadow-none',
  secondary:
    'glass text-slate-700 dark:text-slate-200 ' +
    'hover:bg-white/80 dark:hover:bg-white/15 active:scale-[0.98]',
  ghost:
    'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.98]',
  danger:
    'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-500/25 ' +
    'hover:from-rose-500 hover:to-red-500 hover:shadow-rose-500/40 ' +
    'active:scale-[0.98] disabled:opacity-50 disabled:shadow-none',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8  px-3 text-sm  rounded-lg  gap-1.5',
  md: 'h-10 px-4 text-sm  rounded-xl  gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2.5',
}

export function Button({
  variant = 'primary',
  size    = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center font-medium',
        'transition-all duration-200 cursor-pointer',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}

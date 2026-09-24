import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open:       boolean
  onClose:    () => void
  title?:     string
  children:   ReactNode
  maxWidth?:  'sm' | 'md' | 'lg' | 'xl'
  /** Fundo quase opaco no lugar do vidro, para formulários com muitos campos */
  solido?:    boolean
}

const widthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, maxWidth = 'md', solido = false }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className={[
          'relative w-full rounded-2xl p-6 shadow-2xl animate-slide-up',
          solido
            ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/10'
            : 'glass',
          'max-h-[90vh] overflow-y-auto',
          widthClasses[maxWidth],
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100
                         dark:hover:text-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  )
}

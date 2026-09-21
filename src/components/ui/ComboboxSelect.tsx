import {
  useState, useEffect, useLayoutEffect, useRef, useId,
  type KeyboardEvent, type ChangeEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, Loader2 } from 'lucide-react'

export interface ComboboxSelectProps {
  label?:       string
  options:      { value: string; label: string }[]
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  disabled?:    boolean
  loading?:     boolean
  error?:       string
}

// ── Posicionamento ─────────────────────────────────────────────────────────
// O dropdown é renderizado num portal no <body>, não dentro do componente.
// Motivo: os Cards usam `.glass` (backdrop-blur), e backdrop-filter cria um
// contexto de empilhamento — qualquer z-index de um filho fica confinado ali,
// e o Card seguinte no DOM pinta por cima. Com o portal + position:fixed o
// dropdown escapa de todos esses contextos.

interface Posicao {
  left:      number
  width:     number
  top?:      number
  bottom?:   number
  maxHeight: number
}

const ALTURA_MAX      = 240
const ALTURA_MIN_ABRE = 160
const FOLGA           = 4

export function ComboboxSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  disabled = false,
  loading  = false,
  error,
}: ComboboxSelectProps) {
  const id          = useId()
  const [open,        setOpen]        = useState(false)
  const [query,       setQuery]       = useState('')
  const [highlighted, setHighlighted] = useState(-1)
  const [posicao,     setPosicao]     = useState<Posicao | null>(null)

  const containerRef  = useRef<HTMLDivElement>(null)
  const fieldRef      = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLInputElement>(null)
  const listRef       = useRef<HTMLUListElement>(null)

  // Sincroniza o texto do input com o valor externo
  useEffect(() => {
    const selected = options.find(o => o.value === value)
    setQuery(selected ? selected.label : '')
  }, [value, options])

  // Fecha dropdown ao clicar fora — o portal fica fora do container,
  // então a lista precisa entrar na checagem junto
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const alvo = e.target as Node
      if (containerRef.current?.contains(alvo)) return
      if (listRef.current?.contains(alvo)) return
      setOpen(false)
      // Restaura texto da opção selecionada se o usuário saiu sem confirmar
      const selected = options.find(o => o.value === value)
      setQuery(selected ? selected.label : '')
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [options, value])

  // ── Calcula onde o dropdown cabe ────────────────────────────────────

  useLayoutEffect(() => {
    if (!open) { setPosicao(null); return }

    function medir() {
      const campo = fieldRef.current
      if (!campo) return
      const r = campo.getBoundingClientRect()

      const espacoAbaixo = window.innerHeight - r.bottom - FOLGA * 2
      const espacoAcima  = r.top - FOLGA * 2
      // Só sobe se realmente não couber embaixo e houver mais espaço em cima
      const abrirAcima   = espacoAbaixo < ALTURA_MIN_ABRE && espacoAcima > espacoAbaixo

      setPosicao({
        left:  r.left,
        width: r.width,
        ...(abrirAcima
          ? { bottom: window.innerHeight - r.top + FOLGA }
          : { top: r.bottom + FOLGA }),
        maxHeight: Math.max(120, Math.min(ALTURA_MAX, abrirAcima ? espacoAcima : espacoAbaixo)),
      })
    }

    medir()
    // `true` na captura pega o scroll de qualquer contêiner ancestral,
    // não só o da janela
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)
    return () => {
      window.removeEventListener('scroll', medir, true)
      window.removeEventListener('resize', medir)
    }
  }, [open])

  // ── Filtro ───────────────────────────────────────────────────────────

  const normalizar = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const filtered = query.trim()
    ? options.filter(o => normalizar(o.label).includes(normalizar(query)))
    : options

  // Scroll para item destacado
  useEffect(() => {
    if (highlighted < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll('[role="option"]')
    items[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setOpen(true)
    setHighlighted(0)
    // Limpa seleção ao digitar
    if (value) onChange('')
  }

  function handleSelect(opt: { value: string; label: string }) {
    onChange(opt.value)
    setQuery(opt.label)
    setOpen(false)
    setHighlighted(-1)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      setHighlighted(0)
      return
    }
    if (e.key === 'Escape') {
      if (open) e.stopPropagation()   // não deixa fechar o modal junto
      setOpen(false)
      const selected = options.find(o => o.value === value)
      setQuery(selected ? selected.label : '')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(i => Math.min(i + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' && highlighted >= 0 && filtered[highlighted]) {
      e.preventDefault()
      handleSelect(filtered[highlighted])
      return
    }
  }

  const isDisabled = disabled || loading

  // ── Dropdown (vai para o portal) ─────────────────────────────────────

  const dropdown = open && !isDisabled && posicao ? (
    <ul
      ref={listRef}
      role="listbox"
      style={{
        position:  'fixed',
        left:      posicao.left,
        width:     posicao.width,
        top:       posicao.top,
        bottom:    posicao.bottom,
        maxHeight: posicao.maxHeight,
        zIndex:    60,   // acima do Modal (z-50)
      }}
      className={[
        'rounded-xl overflow-y-auto',
        'border border-slate-200/80 dark:border-white/10',
        'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl',
        'shadow-xl shadow-slate-900/10 dark:shadow-slate-900/50',
      ].join(' ')}
    >
      {filtered.length === 0 ? (
        <li className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">
          Nenhum resultado para "{query}"
        </li>
      ) : (
        filtered.map((opt, i) => (
          <li
            key={opt.value}
            role="option"
            aria-selected={opt.value === value}
            onMouseDown={e => { e.preventDefault(); handleSelect(opt) }}
            onMouseEnter={() => setHighlighted(i)}
            className={[
              'px-4 py-2.5 text-sm cursor-pointer transition-colors duration-100 select-none',
              opt.value === value
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium'
                : i === highlighted
                  ? 'bg-slate-100/80 dark:bg-white/10 text-slate-800 dark:text-slate-100'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
            ].join(' ')}
          >
            {opt.label}
          </li>
        ))
      )}
    </ul>
  ) : null

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}

      {/* Input */}
      <div
        ref={fieldRef}
        className={[
          'relative flex items-center rounded-xl border transition-all duration-200',
          'bg-white/60 dark:bg-white/5 backdrop-blur-sm',
          isDisabled
            ? 'opacity-50 cursor-not-allowed border-slate-200/60 dark:border-white/10'
            : open
              ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200/40 dark:ring-indigo-500/20'
              // Mesmo contorno dos demais campos, para o formulário não ficar
              // com uns com borda e outros sem.
              : 'border-slate-300/80 dark:border-white/15 shadow-sm shadow-slate-900/[0.03] dark:shadow-none hover:border-slate-400/80 dark:hover:border-white/25',
          error ? 'border-rose-400 dark:border-rose-500' : '',
        ].join(' ')}
      >
        <Search size={15} className="absolute left-3 shrink-0 text-slate-400 dark:text-slate-500" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          placeholder={loading ? 'Carregando...' : placeholder}
          disabled={isDisabled}
          className={[
            'w-full pl-9 pr-9 py-2.5 text-sm bg-transparent outline-none',
            'text-slate-800 dark:text-slate-100',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            isDisabled ? 'cursor-not-allowed' : 'cursor-text',
          ].join(' ')}
          onChange={handleInputChange}
          onFocus={() => { if (!isDisabled) setOpen(true) }}
          onKeyDown={handleKeyDown}
        />
        {loading ? (
          <Loader2 size={15} className="absolute right-3 shrink-0 text-slate-400 animate-spin" />
        ) : (
          <ChevronDown
            size={15}
            onClick={() => !isDisabled && setOpen(o => !o)}
            className={[
              'absolute right-3 shrink-0 text-slate-400 transition-transform duration-200 cursor-pointer',
              open ? 'rotate-180' : '',
            ].join(' ')}
          />
        )}
      </div>

      {dropdown && createPortal(dropdown, document.body)}

      {error && (
        <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>
      )}
    </div>
  )
}

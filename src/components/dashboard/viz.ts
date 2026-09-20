// Tokens compartilhados pelos gráficos do dashboard.
// As cores vivem em CSS custom properties (src/index.css) para que o
// modo escuro troque a paleta inteira em um lugar só.

/** Slots categóricos, na ordem fixa validada. Nunca embaralhar nem ciclar. */
export const SERIES = [
  'var(--viz-1)',
  'var(--viz-2)',
  'var(--viz-3)',
  'var(--viz-4)',
  'var(--viz-5)',
  'var(--viz-6)',
] as const

/** Cor reservada para a fatia "Outros" — recessiva de propósito. */
export const OUTROS = 'var(--viz-other)'

/** Quantas categorias mostram cor própria antes de virar "Outros". */
export const MAX_CATEGORIAS = SERIES.length

export const ACCENT      = 'var(--viz-accent)'
export const ACCENT_SOFT = 'var(--viz-accent-soft)'
export const GRID        = 'var(--viz-grid)'
export const AXIS        = 'var(--viz-axis)'

export const tooltipStyle: React.CSSProperties = {
  background:     'var(--viz-surface)',
  backdropFilter: 'blur(8px)',
  border:         '1px solid var(--viz-surface-line)',
  borderRadius:   '12px',
  fontSize:       '12px',
  boxShadow:      '0 8px 24px rgba(0,0,0,0.10)',
  color:          'inherit',
}

export const tickStyle = { fontSize: 11, fill: AXIS }

export function formatarNumero(n: number) {
  return n.toLocaleString('pt-BR')
}

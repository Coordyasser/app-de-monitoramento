// Formatação do dashboard, portada do protótipo.
//
// Tudo em pt-BR e com vírgula decimal: o "84,8%" da referência não é detalhe
// estético, é o que a equipe lê o dia inteiro.

const NF = new Intl.NumberFormat('pt-BR')

export const numero = (n: number) => NF.format(n)

/** Uma casa decimal, sempre: "84,8%" e também "3,0%". */
export const pct = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'

export const pad2 = (n: number) => String(n).padStart(2, '0')

/** "24/09" — eixo do gráfico diário. */
export const ddmm = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`

/** "22/09/26, 14:23" — mesma forma do protótipo. */
export function dataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Nomes ──────────────────────────────────────────────────────────────────
//
// A planilha grava tudo em caixa alta. Na tela isso vira grito, e a
// capitalização precisa respeitar as partículas: "Maria das Graças", não
// "Maria Das Graças".

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

export function nomeProprio(bruto: string): string {
  const titulado = bruto
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toLocaleUpperCase('pt-BR'))

  return titulado
    .split(' ')
    .map((palavra, i) =>
      i > 0 && PARTICULAS.has(palavra.toLocaleLowerCase('pt-BR'))
        ? palavra.toLocaleLowerCase('pt-BR')
        : palavra,
    )
    .join(' ')
}

/** Primeira e última inicial, ignorando partículas e reticências de corte. */
export function iniciais(bruto: string): string {
  const partes = nomeProprio(bruto)
    .replace(/…/g, '')
    .split(/\s+/)
    .filter(p => p && !PARTICULAS.has(p.toLocaleLowerCase('pt-BR')))
  const primeira = (partes[0] ?? '?')[0]
  const ultima   = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toLocaleUpperCase('pt-BR')
}

// ── Cor do avatar ──────────────────────────────────────────────────────────
//
// Derivada do nome por hash: a mesma pessoa mantém a mesma cor entre telas e
// entre sessões, sem precisar guardar nada. São pares [fundo, tinta] já
// contrastados; a tinta é escura o bastante para texto pequeno.

const PALETAS: [string, string][] = [
  ['#EEEDFB', '#3730A3'],
  ['#E6F4F1', '#0F5F58'],
  ['#FDF1E3', '#8A4B08'],
  ['#F3EAF8', '#6B2F8A'],
  ['#E8F0FC', '#1E4E9C'],
]

export function paletaPara(chave: string): [string, string] {
  let h = 0
  for (const c of String(chave)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETAS[h % PALETAS.length]
}

/** Só dígitos — para casar um contato com a lista de repetidos. */
export const digitos = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '')

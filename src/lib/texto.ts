// Apresentação de nomes de lugar.
//
// A base do TRE-PI e a planilha de origem guardam tudo em caixa alta
// ("NOSSA SENHORA DOS REMÉDIOS"). Os valores continuam assim no banco — são
// chave de sincronização com o CSV do TRE e mudá-los recriaria as seções
// duplicadas na próxima carga. A capitalização é só de exibição.

/** Minúsculas no meio do nome; nunca na primeira palavra. */
const CONECTIVOS = new Set([
  'a', 'as', 'o', 'os', 'e',
  'de', 'da', 'do', 'das', 'dos',
  'em', 'no', 'na', 'nos', 'nas',
  'com', 'para', 'sob', 'sobre',
])

/**
 * Numerais romanos, que aparecem em município ("Pedro II") e em bairro
 * ("Morada Nova I", "Parque Brasil III"). Precisam continuar em caixa alta.
 * Não colide com o artigo "o", que não é numeral.
 */
const ROMANO = /^(?:i{1,3}|iv|vi{0,3}|ix|xi{0,3}|x)$/

const SENTINELA = /^n[ãa]o\s*consta$/i

// ── Sentinela de dado não coletado ─────────────────────────────────────────
//
// O banco exige nome, contato, título, vínculo, cidade, zona e seção — e as
// RPCs de cobertura contam o que falta procurando por 'nao consta', não por
// NULL. Foi a importação da planilha que fixou essa convenção, e o registro
// criado com dados parciais no app entra pela mesma porta: o campo em branco
// vira a sentinela, aparece como "Não consta" e é completado depois.

/** Literal gravado quando o dado ainda não foi coletado. */
export const NAO_CONSTA = 'NÃO CONSTA'

export function ehNaoConsta(valor: string | null | undefined): boolean {
  return SENTINELA.test(String(valor ?? '').trim())
}

/** Vazio? Grava a sentinela. Preenchido? Grava o que foi digitado, sem sobras. */
export function ouNaoConsta(valor: string | null | undefined): string {
  const v = String(valor ?? '').replace(/\s+/g, ' ').trim()
  return v ? v : NAO_CONSTA
}

/**
 * Texto para editar: a sentinela vira campo vazio. Ninguém deveria precisar
 * apagar "NÃO CONSTA" à mão para digitar o dado que finalmente chegou.
 */
export function semSentinela(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim()
  return ehNaoConsta(v) ? '' : v
}

/**
 * Texto para exibir. A sentinela sai da caixa alta do banco e lê como frase,
 * igual ao que `capitalizarLugar` já faz com cidade e bairro.
 */
export function exibirTexto(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim()
  if (!v) return '—'
  return ehNaoConsta(v) ? 'Não consta' : v
}

/**
 * Capitaliza a palavra e também a letra após apóstrofo ou hífen, que é o que
 * "Pau D'Arco" e "Olho D'Água" exigem.
 */
function capitalizarPalavra(palavra: string): string {
  return palavra.replace(
    /(^|['’-])(\p{L})/gu,
    (_, separador: string, letra: string) => separador + letra.toLocaleUpperCase('pt-BR'),
  )
}

/**
 * "NOSSA SENHORA DOS REMÉDIOS" -> "Nossa Senhora dos Remédios"
 * "PAU D'ARCO DO PIAUÍ"        -> "Pau D'Arco do Piauí"
 * "PEDRO II"                   -> "Pedro II"
 * "VAMOS VER O SOL"            -> "Vamos Ver o Sol"
 */
export function capitalizarLugar(texto: string | null | undefined): string {
  const bruto = String(texto ?? '').trim().replace(/\s+/g, ' ')
  if (!bruto) return ''
  // A sentinela é um estado, não um nome próprio: lê melhor em frase.
  if (SENTINELA.test(bruto)) return 'Não consta'

  return bruto
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((palavra, i) => {
      if (ROMANO.test(palavra)) return palavra.toLocaleUpperCase('pt-BR')
      if (i > 0 && CONECTIVOS.has(palavra)) return palavra
      return capitalizarPalavra(palavra)
    })
    .join(' ')
}

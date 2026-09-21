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

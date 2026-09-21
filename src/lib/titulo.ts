// Validação do título de eleitor.
//
// São 12 dígitos: 8 sequenciais + 2 de UF + 2 verificadores. Como os dois
// últimos são calculáveis, dá para apontar erro de digitação na hora, sem
// consultar nada — foi assim que se descobriu que dezenas de títulos da
// planilha de origem estavam errados apesar de marcados como conferidos.
//
// O mesmo algoritmo existe em `scripts/lib/normalizar.mjs`, usado pela
// sincronização da planilha. São dois ambientes (navegador e Node), por isso
// a repetição; se mexer aqui, mexa lá também.

const UF_TSE: Record<string, string> = {
  '01': 'SP', '02': 'MG', '03': 'RJ', '04': 'RS', '05': 'BA', '06': 'PR', '07': 'CE',
  '08': 'PE', '09': 'SC', '10': 'GO', '11': 'MA', '12': 'PB', '13': 'PA', '14': 'ES',
  '15': 'PI', '16': 'RN', '17': 'AL', '18': 'MT', '19': 'MS', '20': 'DF', '21': 'SE',
  '22': 'AM', '23': 'RO', '24': 'AC', '25': 'AP', '26': 'RR', '27': 'TO', '28': 'ZZ',
}

/** UF de origem dos registros deste produto. */
export const UF_PADRAO = 'PI'

function digitosVerificadores(doze: string): string {
  const d = doze.split('').map(Number)
  const uf = doze.slice(8, 10)
  const excecao = uf === '01' || uf === '02'   // SP e MG usam 1 no lugar do 0

  let s1 = 0
  for (let i = 0; i < 8; i++) s1 += d[i] * (i + 2)
  const r1 = s1 % 11
  const dv1 = r1 === 10 ? 0 : r1 === 0 ? (excecao ? 1 : 0) : r1

  const s2 = Number(uf[0]) * 7 + Number(uf[1]) * 8 + dv1 * 9
  const r2 = s2 % 11
  const dv2 = r2 === 10 ? 0 : r2 === 0 ? (excecao ? 1 : 0) : r2

  return `${dv1}${dv2}`
}

export type SituacaoTitulo = 'valido' | 'invalido' | 'ausente' | 'outra-uf'

export interface ConferenciaTitulo {
  situacao: SituacaoTitulo
  /** Sigla da UF quando o código existe na tabela do TSE */
  uf?: string
  /** Texto curto para mostrar ao lado do campo */
  mensagem: string
}

/**
 * Confere o título. Não bloqueia o salvamento: título de outra UF é legítimo
 * para quem transferiu o domicílio eleitoral, e o campo é texto livre porque
 * a planilha de origem também traz o literal "NÃO CONSTA".
 */
export function conferirTitulo(bruto: string | null | undefined): ConferenciaTitulo {
  const v = (bruto ?? '').trim()
  if (!v || /^n[ãa]o\s*consta$/i.test(v)) {
    return { situacao: 'ausente', mensagem: 'sem título informado' }
  }

  const digitos = v.replace(/\D/g, '')
  if (digitos.length !== 12) {
    return { situacao: 'invalido', mensagem: `${digitos.length} dígitos, esperado 12` }
  }
  if (digitosVerificadores(digitos) !== digitos.slice(10)) {
    return { situacao: 'invalido', mensagem: 'dígito verificador não confere' }
  }

  const uf = UF_TSE[digitos.slice(8, 10)]
  if (!uf) {
    return { situacao: 'invalido', mensagem: `UF ${digitos.slice(8, 10)} não existe` }
  }
  if (uf !== UF_PADRAO) {
    return { situacao: 'outra-uf', uf, mensagem: `válido, emitido em ${uf}` }
  }
  return { situacao: 'valido', uf, mensagem: `válido ${uf}` }
}

/** "042905031597" -> "0429 0503 1597" */
export function formatarTitulo(bruto: string | null | undefined): string {
  const v = (bruto ?? '').trim()
  const d = v.replace(/\D/g, '')
  if (d.length !== 12) return v
  return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}`
}

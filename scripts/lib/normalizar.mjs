// Normalização dos campos da lista nominal.
//
// A planilha é editada no Excel, que trata título, zona, seção e telefone
// como NÚMERO. Isso causa dois estragos que precisam ser desfeitos aqui:
//   1. zeros à esquerda somem  — "012345678900" vira 12345678900
//   2. valores grandes viram notação científica — "8.69E10"
// Ambos são reversíveis: o título de eleitor tem 12 dígitos fixos, e o
// telefone brasileiro tem tamanho conhecido.

export const NAO_CONSTA = 'NÃO CONSTA';

export const ehNaoConsta = v => /^n[ãa]o\s*consta$/i.test(String(v).trim());

const limpar = v => String(v ?? '').replace(/\s+/g, ' ').trim();

// Planilha digitada à mão traz traços tipográficos (‐ ‑ – — −) no lugar do
// hífen comum. Sem isso um telefone válido cai no ramo "formato estranho".
const hifenSimples = v => v.replace(/[‐-―−]/g, '-');

/** "8.69E10" -> "86900000000". Devolve null se não for notação científica. */
function deNotacaoCientifica(v) {
  if (!/^\d(?:\.\d+)?[eE][+]?\d+$/.test(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n > Number.MAX_SAFE_INTEGER) return null;
  return String(Math.round(n));
}

/** Dígitos de um texto já sabidamente numérico, tolerando o ".0" do Excel. */
const digitos = v => v.replace(/\.0+$/, '').replace(/\D/g, '');

/**
 * Título de eleitor: 12 dígitos fixos.
 * Um valor com menos de 12 perdeu zeros à esquerda — o padding restaura.
 */
export function normalizarTitulo(bruto) {
  const v = limpar(bruto);
  if (!v || ehNaoConsta(v)) return { valor: NAO_CONSTA, aviso: null };

  const cientifico = deNotacaoCientifica(v);
  const crus = cientifico ?? digitos(v);
  if (!crus) return { valor: NAO_CONSTA, aviso: `título ilegível: ${JSON.stringify(v)}` };

  if (crus.length > 12) {
    return { valor: crus, aviso: `título com ${crus.length} dígitos (esperado 12)` };
  }
  const valor = crus.padStart(12, '0');
  // Em notação científica a perda de zeros é esperada e o padding resolve.
  // Fora dela, um título curto é erro de digitação e merece conferência.
  const aviso = !cientifico && crus.length !== 12
    ? `título tinha ${crus.length} dígitos, completado para 12`
    : null;
  return { valor, aviso };
}

/** Zona e seção: inteiros sem zero à esquerda, igual à base do TRE-PI. */
export function normalizarNumero(bruto) {
  const v = limpar(bruto);
  if (!v || ehNaoConsta(v)) return NAO_CONSTA;
  const crus = deNotacaoCientifica(v) ?? digitos(v);
  const semZeros = crus.replace(/^0+(?=\d)/, '');
  return semZeros || NAO_CONSTA;
}

/** Formata pelos tamanhos usuais no Brasil; devolve os dígitos crus se não encaixar. */
function formatarTelefone(d) {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 9)  return `${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length === 8)  return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d;
}

/**
 * Telefone. O CHECK do banco exige de 8 a 60 caracteres, então um valor
 * curto demais vira NÃO CONSTA em vez de derrubar a linha inteira.
 */
export function normalizarContato(bruto) {
  const v = hifenSimples(limpar(bruto));
  if (!v || ehNaoConsta(v)) return { valor: NAO_CONSTA, aviso: null };

  const cientifico = deNotacaoCientifica(v);
  if (cientifico) {
    const aviso = [8, 9, 10, 11].includes(cientifico.length)
      ? null
      : `telefone com ${cientifico.length} dígitos: ${cientifico}`;
    const valor = formatarTelefone(cientifico);
    return valor.length >= 8
      ? { valor, aviso }
      : { valor: NAO_CONSTA, aviso: `telefone curto demais, descartado: ${JSON.stringify(v)}` };
  }

  const d = v.replace(/\D/g, '');
  // Texto simples com um único número reconhecível: padroniza o formato.
  if (d.length >= 8 && d.length <= 11 && /^[\d\s()+\-.]+$/.test(v)) {
    return { valor: formatarTelefone(d), aviso: null };
  }
  // Qualquer outra coisa (dois números na mesma célula, anotação livre):
  // preserva o texto da planilha e sinaliza para conferência.
  if (v.length >= 8) {
    return { valor: v.slice(0, 60), aviso: `telefone em formato não reconhecido: ${JSON.stringify(v)}` };
  }
  return { valor: NAO_CONSTA, aviso: `telefone curto demais, descartado: ${JSON.stringify(v)}` };
}

export const normalizarTexto = limpar;

// ── Validação do título de eleitor ───────────────────────────
// 12 dígitos: 8 sequenciais + 2 de UF + 2 verificadores.
// DV1 sai dos 8 primeiros (pesos 2..9); DV2 sai da UF + DV1 (pesos 7,8,9).
// Resto 0 vale 0, exceto em SP/MG onde vale 1; resto 10 vale 0.

const UF_TSE = {
  '01': 'SP', '02': 'MG', '03': 'RJ', '04': 'RS', '05': 'BA', '06': 'PR', '07': 'CE',
  '08': 'PE', '09': 'SC', '10': 'GO', '11': 'MA', '12': 'PB', '13': 'PA', '14': 'ES',
  '15': 'PI', '16': 'RN', '17': 'AL', '18': 'MT', '19': 'MS', '20': 'DF', '21': 'SE',
  '22': 'AM', '23': 'RO', '24': 'AC', '25': 'AP', '26': 'RR', '27': 'TO', '28': 'ZZ',
};

function digitosVerificadores(doze) {
  const d = doze.split('').map(Number);
  const uf = doze.slice(8, 10);
  const excecao = uf === '01' || uf === '02';   // SP e MG usam 1 no lugar do 0

  let s1 = 0;
  for (let i = 0; i < 8; i++) s1 += d[i] * (i + 2);
  const r1 = s1 % 11;
  const dv1 = r1 === 10 ? 0 : r1 === 0 ? (excecao ? 1 : 0) : r1;

  const s2 = Number(uf[0]) * 7 + Number(uf[1]) * 8 + dv1 * 9;
  const r2 = s2 % 11;
  const dv2 = r2 === 10 ? 0 : r2 === 0 ? (excecao ? 1 : 0) : r2;

  return `${dv1}${dv2}`;
}

/**
 * Confere um título já normalizado.
 * `ufEsperada` (ex.: 'PI') só gera observação, não invalida: eleitor
 * transferido de outro estado tem título legítimo de lá.
 */
export function validarTitulo(titulo, ufEsperada = null) {
  if (titulo === NAO_CONSTA) return { ok: true, ausente: true, aviso: null };
  if (!/^\d{12}$/.test(titulo)) {
    return { ok: false, ausente: false, aviso: `título com ${titulo.replace(/\D/g, '').length} dígitos (esperado 12)` };
  }
  const esperados = digitosVerificadores(titulo);
  if (esperados !== titulo.slice(10)) {
    return { ok: false, ausente: false, aviso: `título inválido: dígito verificador é ${esperados}, não ${titulo.slice(10)}` };
  }
  const codigo = titulo.slice(8, 10);
  const uf = UF_TSE[codigo];
  if (!uf) {
    return { ok: false, ausente: false, aviso: `título com código de UF ${codigo}, que não existe na tabela do TSE` };
  }
  if (ufEsperada && uf !== ufEsperada) {
    return { ok: true, ausente: false, aviso: `título emitido em ${uf}, não em ${ufEsperada} — conferir` };
  }
  return { ok: true, ausente: false, aviso: null };
}

/** Chave de comparação de nomes: maiúsculas, sem acento, espaços colapsados. */
export function chaveNome(nome) {
  return String(nome ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

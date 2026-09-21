// Leitor mínimo de .xlsx — só o necessário para extrair o grid de uma aba.
// Sem dependências: um .xlsx é um ZIP com XML dentro, e o Node já traz inflate.
import { inflateRawSync } from 'node:zlib';

/** Lê o diretório central do ZIP e devolve { nome -> Buffer }. */
function lerZip(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  // O comentário final tem no máximo 64 KB; varre de trás para frente.
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Não parece um .xlsx (fim do ZIP não encontrado)');

  const totalEntradas = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const arquivos = {};

  for (let n = 0; n < totalEntradas; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metodo   = buf.readUInt16LE(p + 10);
    const tamComp  = buf.readUInt32LE(p + 20);
    const tamNome  = buf.readUInt16LE(p + 28);
    const tamExtra = buf.readUInt16LE(p + 30);
    const tamCom   = buf.readUInt16LE(p + 32);
    const offLocal = buf.readUInt32LE(p + 42);
    const nome     = buf.toString('utf8', p + 46, p + 46 + tamNome);

    // O cabeçalho local repete nome/extra com tamanhos próprios.
    const nomeLocal  = buf.readUInt16LE(offLocal + 26);
    const extraLocal = buf.readUInt16LE(offLocal + 28);
    const inicio     = offLocal + 30 + nomeLocal + extraLocal;
    const bruto      = buf.subarray(inicio, inicio + tamComp);

    arquivos[nome] = metodo === 0 ? bruto : inflateRawSync(bruto);
    p += 46 + tamNome + tamExtra + tamCom;
  }
  return arquivos;
}

const decodar = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, '&');   // por último, senão desfaz as entidades acima

const textoDe = xml =>
  (xml.match(/<t[^>]*>[\s\S]*?<\/t>/g) ?? [])
    .map(t => decodar(t.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, '')))
    .join('');

/** "BC12" -> 54 (índice de coluna, base 0) */
function indiceColuna(ref) {
  const letras = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Extrai a primeira aba como matriz de strings.
 * Células numéricas vêm como o Excel gravou — inclusive em notação
 * científica, que é justamente o que a importação precisa corrigir.
 */
export function lerPlanilha(caminho, fs) {
  const arquivos = lerZip(fs.readFileSync(caminho));

  const ssXml = arquivos['xl/sharedStrings.xml']?.toString('utf8') ?? '';
  const compartilhadas = (ssXml.match(/<si>[\s\S]*?<\/si>/g) ?? []).map(textoDe);

  const nomeAba = Object.keys(arquivos)
    .filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0];
  if (!nomeAba) throw new Error('Nenhuma aba encontrada no arquivo');
  const aba = arquivos[nomeAba].toString('utf8');

  const linhas = [];
  let largura = 0;
  for (const linha of aba.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const nLinha = +linha.match(/\br="(\d+)"/)[1];
    const celulas = [];
    for (const c of linha.match(/<c[^>]*\/>|<c[^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = c.match(/\br="([A-Z]+\d+)"/)?.[1];
      if (!ref) continue;
      const tipo = c.match(/\bt="([^"]+)"/)?.[1];
      let valor;
      if (tipo === 'inlineStr') {
        valor = textoDe(c);
      } else {
        const bruto = c.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        valor = bruto == null ? '' : tipo === 's' ? (compartilhadas[+bruto] ?? '') : decodar(bruto);
      }
      const j = indiceColuna(ref);
      celulas[j] = valor;
      if (j + 1 > largura) largura = j + 1;
    }
    linhas[nLinha - 1] = celulas;
  }

  return Array.from({ length: linhas.length }, (_, i) =>
    Array.from({ length: largura }, (_, j) => linhas[i]?.[j] ?? '')
  );
}

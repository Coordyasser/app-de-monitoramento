// Leitor de CSV tolerante ao que o Excel brasileiro produz.
//
// Três armadilhas que este leitor cobre:
//   1. separador — o Excel em pt-BR grava com ";", não com ","
//   2. codificação — "CSV" salva em Windows-1252; só "CSV UTF-8" salva em UTF-8
//   3. BOM no início do arquivo, que gruda na primeira célula do cabeçalho

/** Decide a codificação pelo BOM; sem BOM, testa UTF-8 e cai para Windows-1252. */
function decodificar(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8');
  }
  const comoUtf8 = buf.toString('utf8');
  // U+FFFD só aparece quando a sequência de bytes não era UTF-8 válida.
  if (!comoUtf8.includes('�')) return comoUtf8;
  return new TextDecoder('windows-1252').decode(buf);
}

/** Conta separadores fora de aspas para escolher entre ";" "," e tabulação. */
function detectarSeparador(texto) {
  const amostra = texto.split(/\r?\n/).slice(0, 20).join('\n');
  let melhor = ',', maior = -1;
  for (const sep of [';', ',', '\t']) {
    let n = 0, aspas = false;
    for (const ch of amostra) {
      if (ch === '"') aspas = !aspas;
      else if (ch === sep && !aspas) n++;
    }
    if (n > maior) { maior = n; melhor = sep; }
  }
  return melhor;
}

/** Devolve o CSV como matriz de strings, no mesmo formato que `lerPlanilha`. */
export function lerCsv(caminho, fs) {
  const texto = decodificar(fs.readFileSync(caminho));
  const sep = detectarSeparador(texto);

  const linhas = [];
  let campo = '', linha = [], aspas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];

    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }   // "" escapa uma aspa
        else aspas = false;
      } else campo += ch;
      continue;
    }

    if (ch === '"') { aspas = true; continue; }
    if (ch === sep) { linha.push(campo); campo = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue; }
    campo += ch;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }

  const largura = linhas.reduce((m, l) => Math.max(m, l.length), 0);
  return linhas.map(l => Array.from({ length: largura }, (_, j) => l[j] ?? ''));
}

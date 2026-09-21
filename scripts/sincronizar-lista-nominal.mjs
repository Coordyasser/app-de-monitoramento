#!/usr/bin/env node
// =============================================================
// Sincroniza a LISTA NOMINAL (.xlsx) com a tabela `registros`.
//
// A planilha é a fonte de verdade e vive na máquina do coordenador.
// A reconciliação é feita pela coluna ID da planilha (ID001, ID002…),
// gravada em `registros.origem_id`:
//
//   ID novo na planilha       -> INSERT
//   ID existente, com mudança -> UPDATE (só os campos que mudaram)
//   ID existente, sem mudança -> ignorado
//   ID sumiu da planilha      -> apenas reportado, nunca apagado
//
// Uso:
//   node scripts/sincronizar-lista-nominal.mjs --arquivo "C:/.../LISTA NOMINAL.xlsx"
//   node scripts/sincronizar-lista-nominal.mjs --arquivo "..." --dry-run
// =============================================================

import fs from 'node:fs';
import path from 'node:path';
import { lerPlanilha } from './lib/xlsx.mjs';
import { lerCsv } from './lib/csv.mjs';
import {
  NAO_CONSTA,
  normalizarTitulo, normalizarNumero, normalizarContato, normalizarTexto,
  validarTitulo, chaveNome,
} from './lib/normalizar.mjs';

// ── argumentos ───────────────────────────────────────────────
const args = process.argv.slice(2);
const opcao = (nome, padrao = null) => {
  const i = args.indexOf(nome);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};
const dryRun  = args.includes('--dry-run');
const arquivo = opcao('--arquivo');
if (!arquivo) {
  console.error('Faltou --arquivo "caminho/para/LISTA NOMINAL.xlsx"');
  process.exit(2);
}
if (!fs.existsSync(arquivo)) {
  console.error(`Arquivo não encontrado: ${arquivo}`);
  process.exit(2);
}

// ── credenciais ──────────────────────────────────────────────
const raizProjeto = path.resolve(import.meta.dirname, '..');
const env = {};
for (const nomeEnv of ['.env.local', '.env']) {
  const caminho = path.join(raizProjeto, nomeEnv);
  if (!fs.existsSync(caminho)) continue;
  for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}
const URL_SUPABASE = env.VITE_SUPABASE_URL;
const CHAVE        = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SUPABASE || !CHAVE) {
  console.error('Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(2);
}

const api = async (caminho, init = {}) => {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: CHAVE,
      Authorization: `Bearer ${CHAVE}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${caminho} :: ${texto.slice(0, 400)}`);
  return texto ? JSON.parse(texto) : null;
};

/** Busca todas as páginas de um recurso (PostgREST devolve no máximo 1000 por vez). */
async function buscarTudo(recurso, colunas) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const pagina = await api(`${recurso}?select=${colunas}&order=id&offset=${offset}&limit=1000`);
    out.push(...pagina);
    if (pagina.length < 1000) return out;
  }
}

// ── 1. planilha ──────────────────────────────────────────────
console.log(`\nLendo ${path.basename(arquivo)}…`);
const ehCsv = /\.(csv|txt|tsv)$/i.test(arquivo);
const grade = ehCsv ? lerCsv(arquivo, fs) : lerPlanilha(arquivo, fs);
if (ehCsv) {
  console.log('  formato CSV: só chega o texto exibido pelo Excel, sem o valor de');
  console.log('  precisão total que o .xlsx guarda. Prefira .xlsx quando puder.');
}

const cabecalho = (grade[0] ?? []).map(h => normalizarTexto(h).toUpperCase());
const acharCol = (...nomes) => {
  for (const n of nomes) {
    const i = cabecalho.findIndex(h => h === n);
    if (i >= 0) return i;
  }
  return -1;
};
const COL = {
  id:          acharCol('ID'),
  vinculo:     acharCol('VÍNCULO', 'VINCULO'),
  nome:        acharCol('NOME'),
  titulo:      acharCol('TÍTULO', 'TITULO'),
  zona:        acharCol('ZONA'),
  secao:       acharCol('SEÇÃO', 'SECAO'),
  contato:     acharCol('TELEFONE / CELULAR', 'TELEFONE', 'CONTATO'),
  situacao:    acharCol('SITUAÇÃO', 'SITUACAO'),
  observacoes: acharCol('OBSERVAÇÕES', 'OBSERVACOES'),
};
const faltando = Object.entries(COL).filter(([, i]) => i < 0).map(([k]) => k);
if (faltando.length) {
  console.error(`Colunas não encontradas no cabeçalho: ${faltando.join(', ')}`);
  console.error(`Cabeçalho lido: ${cabecalho.filter(Boolean).join(' | ')}`);
  process.exit(2);
}

const linhas = grade.slice(1).filter(r => r.some(c => normalizarTexto(c) !== ''));
console.log(`  ${linhas.length} linhas com conteúdo`);

// ── 2. base do TRE-PI, para deduzir cidade e validar a seção ─
console.log('Carregando seções do TRE-PI…');
const secoes = await buscarTudo('secoes_eleitorais_pi', 'id,municipio,zona,secao,local_votacao');
console.log(`  ${secoes.length} seções`);

// A planilha não tem coluna de cidade. O par zona+seção quase sempre
// identifica um município só — quando identifica, a cidade vem daí e o
// registro ainda ganha o secao_id oficial.
const porParZonaSecao = new Map();
const semZeros = v => String(v).replace(/^0+(?=\d)/, '');
for (const s of secoes) {
  const chave = `${semZeros(s.zona)}|${semZeros(s.secao)}`;
  if (!porParZonaSecao.has(chave)) porParZonaSecao.set(chave, []);
  porParZonaSecao.get(chave).push(s);
}

// ── 3. transformação ─────────────────────────────────────────
const avisos = [];
const daPlanilha = new Map();

linhas.forEach((linha, i) => {
  const nLinha = i + 2; // 1 = cabeçalho
  const pega = j => normalizarTexto(linha[j]);
  const avisar = (origemId, aviso) => avisos.push({ linha: nLinha, origem_id: origemId, aviso });

  const origemId = pega(COL.id);
  if (!origemId) return avisar('', 'linha sem ID na planilha — ignorada');
  if (daPlanilha.has(origemId)) return avisar(origemId, 'ID repetido na planilha — mantida a primeira ocorrência');

  const titulo  = normalizarTitulo(linha[COL.titulo]);
  const contato = normalizarContato(linha[COL.contato]);
  const zona    = normalizarNumero(linha[COL.zona]);
  const secao   = normalizarNumero(linha[COL.secao]);
  if (titulo.aviso)  avisar(origemId, titulo.aviso);
  if (contato.aviso) avisar(origemId, contato.aviso);

  // Confere os dígitos verificadores. Não descarta a linha: a planilha é a
  // fonte de verdade e a correção é humana — aqui só apontamos.
  const conferencia = validarTitulo(titulo.valor, 'PI');
  if (conferencia.aviso) avisar(origemId, conferencia.aviso);

  // Cidade e seção oficial, quando o par zona+seção for inequívoco.
  let cidade = NAO_CONSTA;
  let secaoId = null;
  if (zona !== NAO_CONSTA && secao !== NAO_CONSTA) {
    const candidatas = porParZonaSecao.get(`${zona}|${secao}`);
    if (!candidatas) {
      avisar(origemId, `zona ${zona} / seção ${secao} não existe na base do TRE-PI`);
    } else {
      const municipios = [...new Set(candidatas.map(c => c.municipio))];
      if (municipios.length === 1) {
        cidade = municipios[0];
        // Mesmo critério da RPC get_secao_id_cidade_zona_pi: menor local_votacao.
        secaoId = [...candidatas].sort((a, b) => a.local_votacao.localeCompare(b.local_votacao))[0].id;
      } else {
        avisar(origemId, `zona ${zona} / seção ${secao} existe em ${municipios.length} municípios — cidade não deduzida`);
      }
    }
  }

  const nome    = pega(COL.nome);
  const vinculo = pega(COL.vinculo);
  if (nome.length < 3)    return avisar(origemId, `nome inválido: ${JSON.stringify(nome)} — linha ignorada`);
  if (vinculo.length < 2) return avisar(origemId, `vínculo inválido: ${JSON.stringify(vinculo)} — linha ignorada`);

  const observacoes = pega(COL.observacoes);
  const situacao    = pega(COL.situacao);

  daPlanilha.set(origemId, {
    origem_id:   origemId,
    nome:        nome.slice(0, 120),
    contato:     contato.valor,
    titulo:      titulo.valor,
    vinculo:     vinculo.slice(0, 80),
    cidade:      cidade.slice(0, 80),
    zona:        zona.slice(0, 20),
    secao:       secao.slice(0, 20),
    secao_id:    secaoId,
    observacoes: observacoes ? observacoes.slice(0, 2000) : null,
    situacao:    situacao ? situacao.slice(0, 40) : null,
  });
});

console.log(`  ${daPlanilha.size} registros válidos, ${avisos.length} avisos`);

// ── 3b. duplicidade: título e nome ───────────────────────────
//
// O título é identificador nacional único por eleitor, então repetição ali
// é duplicata de fato. Nome repetido é só indício — homônimo é comum — e
// por isso entra separado, como suspeita a conferir.
const duplicidades = [];
const agrupar = (chaveDe, rotulo, criterio) => {
  const grupos = new Map();
  for (const [origemId, r] of daPlanilha) {
    const k = chaveDe(r);
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push({ origemId, r });
  }
  for (const [k, itens] of grupos) {
    if (itens.length < 2) continue;
    duplicidades.push({
      criterio,
      chave: k,
      quantidade: itens.length,
      ids: itens.map(i => i.origemId).join(' | '),
      nomes: [...new Set(itens.map(i => i.r.nome))].join(' | '),
      vinculos: [...new Set(itens.map(i => i.r.vinculo))].join(' | '),
      rotulo,
    });
  }
};
agrupar(r => (r.titulo !== NAO_CONSTA && /^\d{12}$/.test(r.titulo) ? r.titulo : null), 'título', 'titulo');
agrupar(r => chaveNome(r.nome) || null, 'nome', 'nome');

const dupTitulo = duplicidades.filter(d => d.criterio === 'titulo');
const dupNome   = duplicidades.filter(d => d.criterio === 'nome');
console.log(`  duplicidade por título: ${dupTitulo.length} grupo(s)` +
  ` | por nome: ${dupNome.length} grupo(s)`);

// ── 4. diff contra o banco ───────────────────────────────────
//
// A coluna ID da planilha NÃO serve de chave: ela é um contador de linha e
// renumera quando alguém apaga uma linha — já aconteceu, deslocando 533
// pessoas de uma vez. Reconciliamos pela identidade da pessoa:
//   1ª passada  título (identificador nacional único, acompanha a pessoa)
//   2ª passada  nome + vínculo, para quem ainda não tem título
// O origem_id continua gravado, mas como dado de rastreio, não como chave.
console.log('Comparando com o banco…');
const CAMPOS = ['nome', 'contato', 'titulo', 'vinculo', 'cidade', 'zona', 'secao', 'secao_id', 'observacoes', 'situacao', 'origem_id'];
const existentes = await buscarTudo('registros', ['id', ...CAMPOS].join(','));

const temTitulo = r => /^\d{12}$/.test(r.titulo ?? '');
const chaveNV   = r => chaveNome(r.nome) + '|' + chaveNome(r.vinculo);

// Índices do lado do banco. Chave repetida vira lista para não casar às cegas.
const indexar = (linhas, chaveDe) => {
  const m = new Map();
  for (const r of linhas) {
    const k = chaveDe(r);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};
const porTitulo = indexar(existentes.filter(temTitulo), r => r.titulo);
const porNomeVinculo = indexar(existentes, chaveNV);

const usados = new Set();
const casar = (novo) => {
  if (temTitulo(novo)) {
    const c = porTitulo.get(novo.titulo)?.filter(r => !usados.has(r.id)) ?? [];
    if (c.length === 1) return c[0];
    if (c.length > 1) {
      // Título repetido na origem (duplicata ou erro de digitação). Desempata
      // pelo nome dentro do próprio grupo — sem sair procurando na base toda,
      // que é como se casaria a pessoa errada.
      const exato = c.filter(r => chaveNV(r) === chaveNV(novo));
      return exato.length === 1 ? exato[0] : null;
    }
  }
  const c = porNomeVinculo.get(chaveNV(novo))?.filter(r => !usados.has(r.id)) ?? [];
  return c.length === 1 ? c[0] : null;
};

// A planilha manda nos valores reais, mas não rebaixa um dado já preenchido
// para NÃO CONSTA — foi assim que um título digitado no app quase se perdeu.
const LOCALIZACAO = ['cidade', 'zona', 'secao', 'secao_id'];
const novos = [], alterados = [];

for (const [origemId, novo] of daPlanilha) {
  const atual = casar(novo);
  if (!atual) { novos.push(novo); continue; }
  usados.add(atual.id);

  const preservar = new Set();
  for (const c of CAMPOS) {
    if (novo[c] === NAO_CONSTA && atual[c] && atual[c] !== NAO_CONSTA) preservar.add(c);
  }
  // Localização é um conjunto: se a zona/seção volta a ser desconhecida na
  // planilha, cidade e secao_id da base oficial vão junto, senão sobra
  // cidade sem zona, que não faz sentido.
  if (preservar.has('zona') || preservar.has('secao')) LOCALIZACAO.forEach(c => preservar.add(c));
  for (const c of preservar) {
    avisos.push({ linha: '', origem_id: origemId,
      aviso: `${c}: planilha diz NÃO CONSTA, banco tem ${JSON.stringify(atual[c])} — mantido o do banco` });
  }

  const mudou = CAMPOS.filter(c => !preservar.has(c) && (atual[c] ?? null) !== (novo[c] ?? null));
  if (mudou.length) {
    alterados.push({
      id: atual.id,
      origem_id: origemId,
      campos: mudou,
      dados: Object.fromEntries(mudou.map(c => [c, novo[c]])),
    });
  }
}
const sumiram = existentes.filter(r => !usados.has(r.id)).map(r => r.origem_id ?? r.id);

console.log(`\n  novos:        ${novos.length}`);
console.log(`  atualizados:  ${alterados.length}`);
if (alterados.length) {
  // Detalhamento por campo: se uma coluna que deveria ser estável (nome,
  // título) aparecer mudando em massa, é sinal de que o casamento errou.
  const porCampo = {};
  for (const a of alterados) for (const c of a.campos) porCampo[c] = (porCampo[c] ?? 0) + 1;
  console.log('    por campo: ' + Object.entries(porCampo).sort((x, y) => y[1] - x[1])
    .map(([c, n]) => `${c}=${n}`).join('  '));
}
console.log(`  sem mudança:  ${daPlanilha.size - novos.length - alterados.length}`);
console.log(`  no banco mas fora da planilha: ${sumiram.length}` +
  (sumiram.length ? ` (${sumiram.slice(0, 10).join(', ')}${sumiram.length > 10 ? '…' : ''}) — preservados` : ''));

// ── 5. relatório de avisos ───────────────────────────────────
const escapa = v => `"${String(v).replace(/"/g, '""')}"`;
const gravarCsv = (nome, colunas, itens) => {
  const destino = path.join(raizProjeto, 'scripts', nome);
  fs.writeFileSync(destino,
    '﻿' + colunas.join(',') + '\n' +                 // BOM: Excel abre em UTF-8
    itens.map(o => colunas.map(c => escapa(o[c] ?? '')).join(',')).join('\n'),
    'utf8');
  console.log(`  ${itens.length} linha(s) em scripts/${nome}`);
};

console.log();
if (avisos.length) {
  gravarCsv('avisos-lista-nominal.csv', ['linha', 'origem_id', 'aviso'], avisos);
}
if (duplicidades.length) {
  gravarCsv('duplicidades.csv',
    ['criterio', 'chave', 'quantidade', 'ids', 'nomes', 'vinculos'], duplicidades);
}

if (dryRun) {
  console.log('\n--dry-run: nada foi gravado.\n');
  process.exit(0);
}

// ── 6. gravação ──────────────────────────────────────────────
//
// `origem_id` tem índice único, e a renumeração da planilha faz um mesmo ID
// migrar de uma pessoa para outra. Gravar direto esbarraria no índice no meio
// do caminho e deixaria a sincronização pela metade, então liberamos antes
// todos os IDs que vão trocar de dono — inclusive os reivindicados pelos
// registros novos.
const idsReivindicados = new Set(daPlanilha.keys());
const liberar = [
  ...alterados.filter(a => a.campos.includes('origem_id')).map(a => a.id),
  // Quem saiu da planilha mas segura um ID que agora é de outra pessoa.
  ...existentes.filter(r => !usados.has(r.id) && r.origem_id && idsReivindicados.has(r.origem_id))
               .map(r => r.id),
];
if (liberar.length) {
  console.log(`\nLiberando ${liberar.length} origem_id antes de regravar…`);
  for (let i = 0; i < liberar.length; i += 100) {
    const lote = liberar.slice(i, i + 100);
    await api(`registros?id=in.(${lote.join(',')})`, {
      method: 'PATCH',
      body: JSON.stringify({ origem_id: null }),
      headers: { Prefer: 'return=minimal' },
    });
  }
}

if (novos.length) {
  console.log('\nInserindo novos…');
  for (let i = 0; i < novos.length; i += 200) {
    const lote = novos.slice(i, i + 200);
    await api('registros', {
      method: 'POST',
      body: JSON.stringify(lote),
      headers: { Prefer: 'return=minimal' },
    });
    console.log(`  ${Math.min(i + lote.length, novos.length)}/${novos.length}`);
  }
}
if (alterados.length) {
  console.log('\nAtualizando alterados…');
  for (const a of alterados) {
    await api(`registros?id=eq.${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify(a.dados),
      headers: { Prefer: 'return=minimal' },
    });
    console.log(`  ${a.origem_id}: ${a.campos.join(', ')}`);
  }
}

const total = await fetch(`${URL_SUPABASE}/rest/v1/registros?select=id&limit=1`, {
  headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, Prefer: 'count=exact' },
});
console.log(`\nPronto. Total em registros: ${total.headers.get('content-range')?.split('/')[1] ?? '?'}\n`);

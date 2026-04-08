// =============================================================
// EleitoWatch | Edge Function — sync-tre-pi-ckan
// Baixa o CSV oficial do TRE-PI (Portal de Dados Abertos) e
// sincroniza a tabela `secoes_eleitorais_pi` via upsert idempotente.
//
// Deploy: supabase functions deploy sync-tre-pi-ckan
// Invocação manual: POST /functions/v1/sync-tre-pi-ckan
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CSV com locais de votação do Piauí — eleições 2026 (marco/2026)
const CSV_URL =
  "https://dadosabertos.tre-pi.jus.br/dataset/0b4ef207-10a9-4562-a144-d689817e784f" +
  "/resource/6a06f14a-ad1b-420e-9d99-aa785ee2386b/download/locais-de-votacao.csv";

const BATCH_SIZE  = 500;
const MAX_RETRIES = 3;

// ── Tipos ──────────────────────────────────────────────────────────────────

interface SecaoUpsert {
  municipio:     string;
  zona:          string;
  local_votacao: string;
  secao:         string;
  urna:          string;
  last_synced:   string;
}

// ── Utilitários ───────────────────────────────────────────────────────────

function normalizeText(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

/**
 * Extrai os números de seção do campo empacotado.
 * Exemplos:
 *   "(s: 185, apt: 253)"           → ["185"]
 *   "(s: 185, apt: 253),(s: 186, apt: 253)"  → ["185", "186"]
 *   "185"                          → ["185"]  (fallback: valor simples)
 */
function parseSecoes(packed: string): string[] {
  // Formato empacotado: "(s: 185, apt: 253), (s: 186, apt: 253)"
  const matches = [...packed.matchAll(/s:\s*(\d+)/gi)];
  if (matches.length > 0) return matches.map(m => m[1]);
  // Sem matches — campo não está no formato esperado; não usar como fallback
  return [];
}

/**
 * Parser CSV mínimo que suporta campos com aspas e detecta separador
 * automaticamente (`;` ou `,`).
 */
function parseCSVLine(line: string, sep: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Aspas duplas escapadas
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Fetch com retry exponencial */
async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res;
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const delay = 1000 * attempt;
    console.warn(`[sync] Tentativa ${attempt} falhou. Retry em ${delay}ms…`);
    await new Promise(r => setTimeout(r, delay));
    return fetchWithRetry(url, attempt + 1);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const syncedAt     = new Date().toISOString();
  let   totalSync    = 0;
  let   totalSkipped = 0;

  console.log("[sync] Baixando CSV do TRE-PI…", CSV_URL);

  try {
    // ── 0. Limpar dados anteriores (evita resíduos de syncs com mapeamento errado)
    console.log("[sync] Removendo dados anteriores…");
    const { error: deleteError } = await supabase
      .from("secoes_eleitorais_pi")
      .delete()
      .gte("last_synced", "1900-01-01T00:00:00Z"); // matches all rows (last_synced nunca nulo)
    if (deleteError) {
      console.warn("[sync] Aviso ao limpar tabela:", deleteError.message);
    }

    // ── 1. Download ────────────────────────────────────────────────────
    const csvRes  = await fetchWithRetry(CSV_URL);
    let   csvText = await csvRes.text();

    // Remove BOM UTF-8 se presente
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

    const rawLines = csvText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter(l => l.trim());

    if (rawLines.length < 2) throw new Error("CSV vazio ou sem linhas de dados.");

    // ── 2. Detectar separador ──────────────────────────────────────────
    const firstLine = rawLines[0];
    const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
    console.log(`[sync] Separador detectado: '${sep}'. Total de linhas CSV: ${rawLines.length - 1}`);

    // ── 3. Mapear colunas pelo cabeçalho ──────────────────────────────
    // Normaliza removendo aspas, espaços extras e convertendo para maiúsculas
    const headers = parseCSVLine(rawLines[0], sep).map(h =>
      h.toUpperCase().trim().replace(/\s+/g, "_")
    );
    console.log("[sync] Headers:", headers.join(" | "));

    // Usa indexOf com nome exato para evitar falsos positivos em colunas como
    // COD_LOCALIDADE_TSE_ZONA (que também contém "LOCALIDADE")
    const col = {
      uf:            headers.indexOf("UF"),
      municipio:     headers.indexOf("LOCALIDADE"),
      zona:          headers.indexOf("ZONA"),
      local_votacao: headers.indexOf("LOCAL_VOTACAO"),
      secoes:        headers.indexOf("SECOES"),
    };

    // Fallback para variações com acento (ç, ã, etc.)
    if (col.municipio     < 0) col.municipio     = headers.findIndex(h => /^LOCALIDADE$/.test(h));
    if (col.local_votacao < 0) col.local_votacao = headers.findIndex(h => /LOCAL.VOTA/.test(h) && !h.startsWith("TIPO") && !h.startsWith("SITUACAO"));
    if (col.secoes        < 0) col.secoes        = headers.findIndex(h => /^SECOES?$/.test(h) || /^SEÇÕES?$/.test(h));

    const missing = (Object.entries(col) as [string, number][])
      .filter(([key, idx]) => key !== "uf" && idx < 0) // uf é opcional
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `Colunas não mapeadas: ${missing.join(", ")}. Headers encontrados: ${headers.join(", ")}`
      );
    }

    console.log(`[sync] Colunas: municipio[${col.municipio}]=${headers[col.municipio]}, zona[${col.zona}]=${headers[col.zona]}, local[${col.local_votacao}]=${headers[col.local_votacao]}, secoes[${col.secoes}]=${headers[col.secoes]}`);

    // ── 4. Processar linhas e upsert em lotes ─────────────────────────
    // Usa Map para deduplicar por chave composta antes de enviar ao Postgres
    const seen  = new Map<string, SecaoUpsert>();
    const batch: SecaoUpsert[] = [];

    async function flushBatch() {
      if (batch.length === 0) return;
      // Deduplicar o lote atual antes de enviar
      const deduped = [...new Map(batch.map(r => [
        `${r.municipio}|${r.zona}|${r.local_votacao}|${r.secao}|${r.urna}`,
        r,
      ])).values()];
      const { error, count } = await supabase
        .from("secoes_eleitorais_pi")
        .upsert(deduped, {
          onConflict: "municipio,zona,local_votacao,secao,urna",
          count:      "exact",
        });
      if (error) throw new Error(`Upsert error: ${error.message}`);
      totalSync += count ?? deduped.length;
      batch.length = 0;
    }

    for (let i = 1; i < rawLines.length; i++) {
      const fields = parseCSVLine(rawLines[i], sep);

      // Filtra apenas registros do Piauí
      if (col.uf >= 0) {
        const uf = fields[col.uf]?.trim().toUpperCase();
        if (uf && uf !== "PI") { totalSkipped++; continue; }
      }

      const municipio     = normalizeText(fields[col.municipio]     ?? "");
      const zona          = normalizeText(fields[col.zona]          ?? "");
      const local_votacao = normalizeText(fields[col.local_votacao] ?? "");
      const secoesRaw     =               fields[col.secoes]        ?? "";

      if (!municipio || !zona || !local_votacao || !secoesRaw.trim()) {
        totalSkipped++;
        continue;
      }

      const secoes = parseSecoes(secoesRaw);

      if (secoes.length === 0) {
        console.warn(`[sync] Linha ${i + 1}: não foi possível extrair seções de "${secoesRaw}"`);
        totalSkipped++;
        continue;
      }

      for (const secao of secoes) {
        const key = `${municipio}|${zona}|${local_votacao}|${secao}|-`;
        if (seen.has(key)) continue;
        seen.set(key, { municipio, zona, local_votacao, secao, urna: "-", last_synced: syncedAt });
        batch.push(seen.get(key)!);
      }

      if (batch.length >= BATCH_SIZE) await flushBatch();
    }

    await flushBatch();

    // ── 5. Resposta ────────────────────────────────────────────────────
    const summary = {
      success:       true,
      total_synced:  totalSync,
      total_skipped: totalSkipped,
      synced_at:     syncedAt,
    };
    console.log("[sync] Concluído:", summary);

    return new Response(JSON.stringify(summary), {
      status:  200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync] ERRO:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

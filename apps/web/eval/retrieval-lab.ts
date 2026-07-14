/**
 * Block 2.2c — Retrieval Lab v2 ablation harness.
 *
 * Runs the golden corpus (F-122-ABLATION + F-123 + F-144 — the reproducible
 * 3-doc benchmark built in 2.2a/2.2b/2.2c, NOT the frozen live F-122 doc)
 * across retrieval configs, measuring real accuracy, latency, and token
 * cost per query. Never touches match_chunks, lib/qa/pipeline.ts, or any
 * live/frozen document — dense retrieval always goes through the real
 * match_chunks_multi RPC (the same function production calls); only the
 * BM25 index and RRF fusion are harness-local, computed in-memory from a
 * plain content select.
 *
 * Configs:
 *   dense  — match_chunks_multi only, top-K. Faithful reproduction of the
 *            live single-retriever path (frozen QA_TOP_K, frozen threshold).
 *   hybrid — dense top-N + BM25 top-N candidate pools, fused via Reciprocal
 *            Rank Fusion (k=60), cut to top-K. Refusal gate still uses the
 *            dense pool's top-1 similarity (REFUSAL_SIMILARITY_THRESHOLD is
 *            calibrated on that signal specifically — changing the gate
 *            metric is out of scope for a retrieval-ranking ablation).
 *
 * Env vars:
 *   LAB_CONFIGS   comma list of configs to run, default "dense,hybrid"
 *   LAB_DOCS      comma list of form keys to include, default all 3
 *   LAB_SAMPLE    if set, round-robins a fixed-size question sample across
 *                 docs instead of running the full corpus (for cheap
 *                 harness-proof runs)
 *   LAB_TOPK      final passage count per query, default QA_TOP_K (6)
 *   LAB_POOL      candidate pool size per signal for hybrid fusion, default 20
 *   LAB_OUT       results markdown path, default eval/retrieval-lab-results.md
 *                 (set per-run when sweeping multiple knob combos so runs
 *                 don't overwrite each other)
 *
 * Run (proof-of-harness, 5 questions, 2 configs):
 *   LAB_SAMPLE=5 LAB_CONFIGS=dense,hybrid pnpm exec tsx eval/retrieval-lab.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvLocal, requireEnv } from "./env";
import {
  buildValidSectionSet,
  scoreQuestion,
  type EvalStatus,
  type GoldenFile,
  type GoldenQuestion,
} from "./scoring";
import { REFUSAL_MESSAGE, normalizeRefusalAnswer } from "../lib/qa/constants";
import {
  QA_TOP_K,
  REFUSAL_SIMILARITY_THRESHOLD,
} from "../lib/retrieval-config";
import {
  ANTHROPIC_MODEL,
  POLICY_QA_SYSTEM_PROMPT,
  formatPassagesForPrompt,
  type PolicyPassage,
} from "../lib/anthropic";
import { BM25Index, reciprocalRankFusion } from "./bm25";

loadEnvLocal();

// claude-sonnet-4-6 / text-embedding-3-small pricing, per ADR 001. Real
// per-query cost below replaces ADR 001's estimate with measured usage.
const SONNET_INPUT_PER_MTOK = 3.0;
const SONNET_OUTPUT_PER_MTOK = 15.0;
const EMBEDDING_PER_MTOK = 0.02;

const DELAY_MS = 500;

type ConfigName = "dense" | "hybrid";
const ALL_CONFIGS: ConfigName[] = ["dense", "hybrid"];

const configsArg = (process.env.LAB_CONFIGS ?? "dense,hybrid")
  .split(",")
  .map((s) => s.trim())
  .filter((s): s is ConfigName => ALL_CONFIGS.includes(s as ConfigName));
const docsArg = process.env.LAB_DOCS
  ? process.env.LAB_DOCS.split(",").map((s) => s.trim())
  : null;
const sampleArg = process.env.LAB_SAMPLE
  ? parseInt(process.env.LAB_SAMPLE, 10)
  : null;
const topK = process.env.LAB_TOPK ? parseInt(process.env.LAB_TOPK, 10) : QA_TOP_K;
const poolSize = process.env.LAB_POOL ? parseInt(process.env.LAB_POOL, 10) : 20;

interface DocTarget {
  form: string;
  goldenFile: string;
}

const DOC_TARGETS: DocTarget[] = [
  { form: "F-122-ABLATION", goldenFile: "golden-f122-ablation.json" },
  { form: "F-123", goldenFile: "golden-f123.json" },
  { form: "F-144", goldenFile: "golden-f144.json" },
  // Chunking-knob leg: MIN_CHUNK_CONTENT_CHARS=0 variants, ingested by
  // scripts/ingest-minchunk0.ts under new document rows. Same golden files —
  // the questions target document content, not chunk boundaries.
  { form: "F-122-ABLATION-MC0", goldenFile: "golden-f122-ablation.json" },
  { form: "F-123-MC0", goldenFile: "golden-f123.json" },
  { form: "F-144-MC0", goldenFile: "golden-f144.json" },
].filter((t) => !docsArg || docsArg.includes(t.form));

interface ChunkRow {
  id: number;
  section_label: string | null;
  page_start: number | null;
  page_end: number | null;
  content: string;
}

interface DocCache {
  form: string;
  documentId: string;
  golden: GoldenFile;
  validSections: Set<string>;
  chunkById: Map<number, ChunkRow>;
  bm25: BM25Index;
}

interface Citation {
  id: number;
  sectionLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
  similarity: number;
}

interface RetrievalResult {
  citations: Citation[];
  topSimilarity: number | null;
  retrievalMs: number;
}

interface ResultRow {
  form: string;
  config: ConfigName;
  id: number;
  difficulty: string;
  status: EvalStatus;
  notes: string;
  topSimilarity: number | null;
  retrievalMs: number;
  generationMs: number;
  totalMs: number;
  embeddingTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  return openai;
}

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropic) anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  return anthropic;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedQueryMeasured(text: string): Promise<{
  vectorLiteral: string;
  tokens: number;
  ms: number;
}> {
  const client = getOpenAI();
  const t0 = Date.now();
  const resp = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: [text],
  });
  const ms = Date.now() - t0;
  const vector = resp.data[0]!.embedding;
  const tokens = resp.usage?.total_tokens ?? Math.ceil(text.length / 4);
  return { vectorLiteral: `[${vector.join(",")}]`, tokens, ms };
}

async function generateMeasured(
  question: string,
  passages: PolicyPassage[]
): Promise<{ answer: string; ms: number; inputTokens: number; outputTokens: number }> {
  const client = getAnthropic();
  const userContent = `Policy passages:\n\n${formatPassagesForPrompt(passages)}\n\nQuestion: ${question}`;
  const t0 = Date.now();
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: POLICY_QA_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });
  const ms = Date.now() - t0;
  const block = message.content.find((b) => b.type === "text");
  const answer = block && block.type === "text" ? normalizeRefusalAnswer(block.text) : "";
  return {
    answer,
    ms,
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
  };
}

async function denseRetrieve(
  supabase: SupabaseClient,
  documentId: string,
  vectorLiteral: string,
  matchCount: number
): Promise<Citation[]> {
  const { data, error } = await supabase.rpc("match_chunks_multi", {
    query_embedding: vectorLiteral,
    doc_ids: [documentId],
    match_count: matchCount,
    min_similarity: 0,
  });
  if (error) throw new Error(`match_chunks_multi failed: ${error.message}`);
  return ((data ?? []) as {
    id: number;
    section_label: string | null;
    page_start: number | null;
    page_end: number | null;
    content: string;
    similarity: number;
  }[]).map((c) => ({
    id: c.id,
    sectionLabel: c.section_label ?? "Section",
    pageStart: c.page_start,
    pageEnd: c.page_end,
    content: c.content,
    similarity: c.similarity,
  }));
}

async function runDense(
  supabase: SupabaseClient,
  documentId: string,
  vectorLiteral: string
): Promise<RetrievalResult> {
  const t0 = Date.now();
  const citations = await denseRetrieve(supabase, documentId, vectorLiteral, topK);
  return {
    citations,
    topSimilarity: citations[0]?.similarity ?? null,
    retrievalMs: Date.now() - t0,
  };
}

async function runHybrid(
  supabase: SupabaseClient,
  doc: DocCache,
  question: string,
  vectorLiteral: string
): Promise<RetrievalResult> {
  const t0 = Date.now();
  const dense = await denseRetrieve(supabase, doc.documentId, vectorLiteral, poolSize);
  const bm25Results = doc.bm25.search(question, poolSize);
  const fused = reciprocalRankFusion([
    dense.map((c) => ({ id: c.id })),
    bm25Results.map((r) => ({ id: r.id })),
  ]);
  const denseById = new Map(dense.map((c) => [c.id, c]));
  const citations: Citation[] = fused.slice(0, topK).map(({ id }) => {
    const d = denseById.get(id);
    if (d) return d;
    const c = doc.chunkById.get(id)!;
    return {
      id: c.id,
      sectionLabel: c.section_label ?? "Section",
      pageStart: c.page_start,
      pageEnd: c.page_end,
      content: c.content,
      similarity: 0,
    };
  });
  return {
    citations,
    topSimilarity: dense[0]?.similarity ?? null,
    retrievalMs: Date.now() - t0,
  };
}

function costUsd(inputTokens: number, outputTokens: number, embeddingTokens: number): number {
  return (
    (inputTokens / 1_000_000) * SONNET_INPUT_PER_MTOK +
    (outputTokens / 1_000_000) * SONNET_OUTPUT_PER_MTOK +
    (embeddingTokens / 1_000_000) * EMBEDDING_PER_MTOK
  );
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requireEnv("EVAL_USER_EMAIL");
  const password = requireEnv("EVAL_USER_PASSWORD");

  const supabase = createClient(url, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`Sign-in failed: ${authError.message}`);

  const documentsMapPath = resolve(process.cwd(), "eval/documents.json");
  if (!existsSync(documentsMapPath)) {
    throw new Error("eval/documents.json not found — run the ingest scripts first.");
  }
  const documentsMap = JSON.parse(readFileSync(documentsMapPath, "utf-8")) as Record<string, string>;

  console.log(
    `Retrieval Lab v2 — configs=[${configsArg.join(",")}] docs=[${DOC_TARGETS.map((d) => d.form).join(",")}] topK=${topK} pool=${poolSize}${sampleArg ? ` sample=${sampleArg}` : ""}\n`
  );

  const docCaches: DocCache[] = [];
  for (const target of DOC_TARGETS) {
    const documentId = documentsMap[target.form];
    if (!documentId) throw new Error(`No document_id for ${target.form} in eval/documents.json`);

    const goldenPath = resolve(process.cwd(), `eval/${target.goldenFile}`);
    const golden = JSON.parse(readFileSync(goldenPath, "utf-8")) as GoldenFile;

    const { data: chunkRows, error: chunkErr } = await supabase
      .from("chunks")
      .select("id, section_label, page_start, page_end, content")
      .eq("document_id", documentId);
    if (chunkErr) throw new Error(`Failed to load chunks for ${target.form}: ${chunkErr.message}`);
    const chunks = (chunkRows ?? []) as ChunkRow[];

    const validSections = buildValidSectionSet(chunks.map((c) => c.section_label));
    const bm25 = new BM25Index(chunks.map((c) => ({ id: c.id, content: c.content })));

    console.log(`${target.form}: ${documentId} — ${chunks.length} chunks, ${golden.questions.length} golden Qs`);

    docCaches.push({
      form: target.form,
      documentId,
      golden,
      validSections,
      chunkById: new Map(chunks.map((c) => [c.id, c])),
      bm25,
    });
  }

  // Build the question worklist: full corpus, or a round-robin sample across
  // docs (for cheap harness-proof runs) capped at LAB_SAMPLE total.
  interface WorkItem {
    doc: DocCache;
    q: GoldenQuestion;
  }
  const worklist: WorkItem[] = [];
  if (sampleArg) {
    let round = 0;
    outer: while (worklist.length < sampleArg) {
      let addedAny = false;
      for (const doc of docCaches) {
        if (round >= doc.golden.questions.length) continue;
        worklist.push({ doc, q: doc.golden.questions[round]! });
        addedAny = true;
        if (worklist.length >= sampleArg) break outer;
      }
      if (!addedAny) break;
      round++;
    }
  } else {
    for (const doc of docCaches) {
      for (const q of doc.golden.questions) worklist.push({ doc, q });
    }
  }

  console.log(`\nWorklist: ${worklist.length} questions x ${configsArg.length} configs = ${worklist.length * configsArg.length} QA runs\n`);

  const rows: ResultRow[] = [];
  let runIdx = 0;
  const totalRuns = worklist.length * configsArg.length;

  for (const { doc, q } of worklist) {
    // Embed once per question, reuse across configs — a real router would
    // embed the query once regardless of which retriever it dispatches to.
    const embedded = await embedQueryMeasured(q.question);

    for (const config of configsArg) {
      runIdx++;
      const t0 = Date.now();
      const retrieval =
        config === "dense"
          ? await runDense(supabase, doc.documentId, embedded.vectorLiteral)
          : await runHybrid(supabase, doc, q.question, embedded.vectorLiteral);

      const refused =
        retrieval.citations.length === 0 ||
        (retrieval.topSimilarity ?? 0) < REFUSAL_SIMILARITY_THRESHOLD;

      let answer: string;
      let generationMs = 0;
      let inputTokens = 0;
      let outputTokens = 0;

      if (refused) {
        answer = REFUSAL_MESSAGE;
      } else {
        const passages: PolicyPassage[] = retrieval.citations.map((c, i) => ({
          index: i + 1,
          sectionLabel: c.sectionLabel,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          content: c.content,
        }));
        const gen = await generateMeasured(q.question, passages);
        answer = gen.answer;
        generationMs = gen.ms;
        inputTokens = gen.inputTokens;
        outputTokens = gen.outputTokens;
      }

      const totalMs = Date.now() - t0;
      const { status, notes } = scoreQuestion(q, answer, doc.validSections);

      rows.push({
        form: doc.form,
        config,
        id: q.id,
        difficulty: q.difficulty,
        status,
        notes,
        topSimilarity: retrieval.topSimilarity,
        retrievalMs: retrieval.retrievalMs,
        generationMs,
        totalMs,
        embeddingTokens: embedded.tokens,
        inputTokens,
        outputTokens,
        costUsd: costUsd(inputTokens, outputTokens, embedded.tokens),
      });

      console.log(
        `[${runIdx}/${totalRuns}] ${doc.form} Q${q.id} (${config}) -> ${status} | top_sim=${retrieval.topSimilarity?.toFixed(3) ?? "-"} | ${totalMs}ms | $${costUsd(inputTokens, outputTokens, embedded.tokens).toFixed(5)}`
      );

      if (runIdx < totalRuns) await sleep(DELAY_MS);
    }
  }

  // ---- Leaderboard ----
  function summarize(rowSet: ResultRow[]) {
    const pass = rowSet.filter((r) => r.status === "PASS").length;
    const fail = rowSet.filter((r) => r.status === "FAIL").length;
    const severe = rowSet.filter((r) => r.status === "SEVERE").length;
    const totalMs = rowSet.map((r) => r.totalMs);
    const retrievalMs = rowSet.map((r) => r.retrievalMs);
    const totalCost = rowSet.reduce((s, r) => s + r.costUsd, 0);
    return {
      n: rowSet.length,
      pass,
      fail,
      severe,
      p50Ms: percentile(totalMs, 50),
      p95Ms: percentile(totalMs, 95),
      p50RetrievalMs: percentile(retrievalMs, 50),
      avgCost: rowSet.length ? totalCost / rowSet.length : 0,
      totalCost,
    };
  }

  let md = `# Retrieval Lab v2 — Ablation Results\n\n`;
  md += `Run: ${new Date().toISOString()}\n\n`;
  md += `Configs: \`${configsArg.join(", ")}\` | Docs: \`${DOC_TARGETS.map((d) => d.form).join(", ")}\` | topK=${topK} pool=${poolSize}${sampleArg ? ` | SAMPLE MODE (n=${sampleArg}, not the full corpus)` : ""}\n\n`;

  md += `## Leaderboard (all docs combined)\n\n`;
  md += `| config | n | PASS | FAIL | SEVERE | p50 latency (ms) | p95 latency (ms) | p50 retrieval (ms) | avg cost/query | total cost |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|\n`;
  console.log(`\n=== Leaderboard (all docs combined) ===`);
  console.log(
    ["config", "n", "PASS", "FAIL", "SEVERE", "p50ms", "p95ms", "p50_retr_ms", "avg_cost", "total_cost"].join("\t")
  );
  for (const config of configsArg) {
    const s = summarize(rows.filter((r) => r.config === config));
    md += `| ${config} | ${s.n} | ${s.pass} | ${s.fail} | ${s.severe} | ${s.p50Ms} | ${s.p95Ms} | ${s.p50RetrievalMs} | $${s.avgCost.toFixed(5)} | $${s.totalCost.toFixed(5)} |\n`;
    console.log(
      [config, s.n, s.pass, s.fail, s.severe, s.p50Ms, s.p95Ms, s.p50RetrievalMs, `$${s.avgCost.toFixed(5)}`, `$${s.totalCost.toFixed(5)}`].join("\t")
    );
  }

  md += `\n## By document x config\n\n`;
  md += `| doc | config | n | PASS | FAIL | SEVERE | p50 latency (ms) | avg cost/query |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;
  for (const doc of docCaches) {
    for (const config of configsArg) {
      const s = summarize(rows.filter((r) => r.form === doc.form && r.config === config));
      if (s.n === 0) continue;
      md += `| ${doc.form} | ${config} | ${s.n} | ${s.pass} | ${s.fail} | ${s.severe} | ${s.p50Ms} | $${s.avgCost.toFixed(5)} |\n`;
    }
  }

  md += `\n## All rows\n\n`;
  md += `| doc | config | id | difficulty | status | top_sim | retrieval_ms | gen_ms | total_ms | in_tok | out_tok | cost | notes |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    md += `| ${r.form} | ${r.config} | ${r.id} | ${r.difficulty} | ${r.status} | ${r.topSimilarity?.toFixed(3) ?? "-"} | ${r.retrievalMs} | ${r.generationMs} | ${r.totalMs} | ${r.inputTokens} | ${r.outputTokens} | $${r.costUsd.toFixed(5)} | ${r.notes.replace(/\|/g, "\\|")} |\n`;
  }

  const outPath = resolve(
    process.cwd(),
    process.env.LAB_OUT ?? "eval/retrieval-lab-results.md"
  );
  writeFileSync(outPath, md, "utf-8");
  console.log(`\nWrote ${outPath}`);

  const grandTotalCost = rows.reduce((s, r) => s + r.costUsd, 0);
  const avgCostPerRun = rows.length ? grandTotalCost / rows.length : 0;
  console.log(`\nThis run: ${rows.length} QA runs, real total cost $${grandTotalCost.toFixed(5)}, avg $${avgCostPerRun.toFixed(5)}/run.`);

  if (sampleArg) {
    const fullCorpusQuestions = docCaches.reduce((s, d) => s + d.golden.questions.length, 0);
    const fullSweepRuns = fullCorpusQuestions * configsArg.length;
    console.log(
      `Projected cost for full sweep of these ${configsArg.length} config(s) across all ${fullCorpusQuestions} golden questions: ${fullSweepRuns} runs x $${avgCostPerRun.toFixed(5)}/run ~= $${(fullSweepRuns * avgCostPerRun).toFixed(4)}.`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

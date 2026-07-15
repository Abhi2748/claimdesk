/**
 * ADR 007 validation: exercise the actual live "Ask the matter" code path
 * (apps/ai's POST /qa/matter — hybrid dense+BM25 retrieval, topK=10, per
 * ADR 004/007) over HTTP, not the TS retrieval-lab harness's approximation
 * of it. Reuses the same golden question files and scoring logic as the
 * frozen eval (eval/scoring.ts) so results are directly comparable to
 * eval/sweep-d-mc0-topk10-refusalfix.md (the TS harness's measurement of
 * the same config).
 *
 * Each question is sent as a single-document "matter" (document_ids: [id])
 * against the existing MC0 ablation document rows, so this validates the
 * shipped Python hybrid-retrieval code against the exact corpus ADR 004
 * measured — not a new, unvalidated document set.
 *
 * Env:
 *   AI_BASE_URL   base URL of the running apps/ai service, default
 *                 http://localhost:8000 (point at the Render URL once
 *                 deployed to re-measure against the real deployment)
 *
 * Run: pnpm exec tsx eval/live-matter-eval.ts
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvLocal, requireEnv } from "./env";
import { fetchValidSections, scoreQuestion, type EvalStatus, type GoldenFile } from "./scoring";
import { median } from "./scoring";

loadEnvLocal();

const AI_BASE_URL = process.env.AI_BASE_URL ?? "http://localhost:8000";
const DELAY_MS = 500;

interface DocTarget {
  form: string;
  goldenFile: string;
}

const DOC_TARGETS: DocTarget[] = [
  { form: "F-122-ABLATION-MC0", goldenFile: "golden-f122-ablation.json" },
  { form: "F-123-MC0", goldenFile: "golden-f123.json" },
  { form: "F-144-MC0", goldenFile: "golden-f144.json" },
];

interface ResultRow {
  form: string;
  id: number;
  difficulty: string;
  status: EvalStatus;
  notes: string;
  topSimilarity: number | null;
  totalMs: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requireEnv("EVAL_USER_EMAIL");
  const password = requireEnv("EVAL_USER_PASSWORD");

  const supabase = createClient(url, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`Sign-in failed: ${authError.message}`);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("No session available.");
  const accessToken = session.access_token;

  const documentsMapPath = resolve(process.cwd(), "eval/documents.json");
  if (!existsSync(documentsMapPath)) {
    throw new Error("eval/documents.json not found.");
  }
  const documentsMap = JSON.parse(readFileSync(documentsMapPath, "utf-8")) as Record<string, string>;

  console.log(`Live matter-QA eval — target: ${AI_BASE_URL}/qa/matter\n`);

  const rows: ResultRow[] = [];
  let runIdx = 0;
  let totalRuns = 0;
  const perDoc: { target: DocTarget; documentId: string; golden: GoldenFile; validSections: Set<string> }[] = [];

  for (const target of DOC_TARGETS) {
    const documentId = documentsMap[target.form];
    if (!documentId) throw new Error(`No document_id for ${target.form}`);
    const goldenPath = resolve(process.cwd(), `eval/${target.goldenFile}`);
    const golden = JSON.parse(readFileSync(goldenPath, "utf-8")) as GoldenFile;
    const validSections = await fetchValidSections(supabase, documentId);
    perDoc.push({ target, documentId, golden, validSections });
    totalRuns += golden.questions.length;
  }

  for (const { target, documentId, golden, validSections } of perDoc) {
    for (const q of golden.questions) {
      runIdx++;
      const t0 = Date.now();
      let answer = "";
      let topSimilarity: number | null = null;
      try {
        const resp = await fetch(`${AI_BASE_URL}/qa/matter`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            document_ids: [documentId],
            question: q.question,
          }),
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        }
        const data = (await resp.json()) as { answer: string; top_similarity: number | null };
        answer = data.answer;
        topSimilarity = data.top_similarity;
      } catch (err) {
        const totalMs = Date.now() - t0;
        rows.push({
          form: target.form,
          id: q.id,
          difficulty: q.difficulty,
          status: "FAIL",
          notes: err instanceof Error ? err.message : "Unknown error",
          topSimilarity: null,
          totalMs,
        });
        console.log(`[${runIdx}/${totalRuns}] ${target.form} Q${q.id} -> ERROR`);
        if (runIdx < totalRuns) await sleep(DELAY_MS);
        continue;
      }
      const totalMs = Date.now() - t0;
      const { status, notes } = scoreQuestion(q, answer, validSections);
      rows.push({ form: target.form, id: q.id, difficulty: q.difficulty, status, notes, topSimilarity, totalMs });
      console.log(
        `[${runIdx}/${totalRuns}] ${target.form} Q${q.id} -> ${status} | top_sim=${topSimilarity?.toFixed(3) ?? "-"} | ${totalMs}ms`
      );
      if (runIdx < totalRuns) await sleep(DELAY_MS);
    }
  }

  const pass = rows.filter((r) => r.status === "PASS").length;
  const fail = rows.filter((r) => r.status === "FAIL").length;
  const severe = rows.filter((r) => r.status === "SEVERE").length;
  const totalMsValues = rows.map((r) => r.totalMs);
  const p50 = percentile(totalMsValues, 50);
  const p95 = percentile(totalMsValues, 95);

  console.log(`\n=== Live /qa/matter results (${AI_BASE_URL}) ===`);
  console.log(`PASS=${pass}/${rows.length} FAIL=${fail} SEVERE=${severe}`);
  console.log(`p50=${p50}ms p95=${p95}ms median=${median(totalMsValues)}ms`);

  let md = `# Live /qa/matter eval (ADR 007)\n\n`;
  md += `Run: ${new Date().toISOString()}\n\n`;
  md += `Target: \`${AI_BASE_URL}/qa/matter\` (hybrid dense+BM25, MATTER_QA_TOP_K=10, MATTER_QA_POOL=20)\n\n`;
  md += `## Summary\n\n`;
  md += `- **PASS:** ${pass} / ${rows.length}\n`;
  md += `- **FAIL:** ${fail} / ${rows.length}\n`;
  md += `- **SEVERE:** ${severe} / ${rows.length}\n`;
  md += `- **p50 latency:** ${p50}ms\n`;
  md += `- **p95 latency:** ${p95}ms\n\n`;
  md += `## All rows\n\n`;
  md += `| doc | id | difficulty | status | top_sim | total_ms | notes |\n`;
  md += `|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    md += `| ${r.form} | ${r.id} | ${r.difficulty} | ${r.status} | ${r.topSimilarity?.toFixed(3) ?? "-"} | ${r.totalMs} | ${r.notes.replace(/\|/g, "\\|")} |\n`;
  }

  const outPath = resolve(process.cwd(), "eval/live-matter-results.md");
  writeFileSync(outPath, md, "utf-8");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

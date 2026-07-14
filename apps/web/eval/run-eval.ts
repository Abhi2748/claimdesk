import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";
import {
  fetchValidSections,
  resolveDocumentId,
  resolveDocumentIdForForm,
  scoreQuestion,
  type EvalStatus,
  type GoldenFile,
} from "./scoring";
import { answerPolicyQuestion } from "../lib/qa/pipeline";
import type { PolicyCitation, PolicyQAResult } from "../lib/qa/types";
import { answerPolicyQuestionTree } from "../lib/tree/navigate";
import { askPolicyQuestion } from "../lib/ai/client";

loadEnvLocal();

const strategy = (process.env.STRATEGY ?? "vector") as "vector" | "tree";
const qaTarget = (process.env.QA_TARGET ?? "local") as "local" | "remote";
// Defaults to the frozen F-122 golden file — unchanged behavior. Set
// GOLDEN_FILE=golden-f123.json or golden-f144.json to run the multi-doc
// corpus; each resolves its own document_id via eval/documents.json
// (scripts/ingest-golden-docs.ts), not via DOC_ID.
const goldenFile = process.env.GOLDEN_FILE ?? "golden.json";
// Output filename suffix so non-F-122 runs don't clobber results.md/
// transcripts.md — e.g. "golden-f123.json" -> "f123".
const goldenSuffix = goldenFile
  .replace(/^golden-?/, "")
  .replace(/\.json$/, "");

const DELAY_MS = 1000;

interface EvalRow {
  id: number;
  difficulty: string;
  status: EvalStatus;
  topSimilarity: string;
  latencyMs: number;
  question: string;
  answer: string;
  notes: string;
  retrievedChunks: PolicyCitation[];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function printTable(rows: EvalRow[]) {
  const header = ["id", "difficulty", "result", "top_sim", "latency_ms"];
  const widths = [4, 10, 8, 8, 11];
  const line = header
    .map((h, i) => h.padEnd(widths[i]!))
    .join(" ");
  console.log(line);
  console.log("-".repeat(line.length));
  for (const row of rows) {
    console.log(
      [
        String(row.id).padEnd(widths[0]!),
        row.difficulty.padEnd(widths[1]!),
        row.status.padEnd(widths[2]!),
        row.topSimilarity.padEnd(widths[3]!),
        String(row.latencyMs).padEnd(widths[4]!),
      ].join(" ")
    );
  }
}

function totalsByDifficulty(rows: EvalRow[]) {
  const byDiff = new Map<string, { pass: number; fail: number; severe: number }>();
  for (const row of rows) {
    const cur = byDiff.get(row.difficulty) ?? { pass: 0, fail: 0, severe: 0 };
    if (row.status === "PASS") cur.pass++;
    else if (row.status === "SEVERE") cur.severe++;
    else cur.fail++;
    byDiff.set(row.difficulty, cur);
  }
  return byDiff;
}

function outFilename(base: string): string {
  const parts = [goldenSuffix, strategy !== "vector" ? strategy : null].filter(
    Boolean
  );
  return parts.length === 0 ? `${base}.md` : `${base}.${parts.join(".")}.md`;
}

function writeMarkdown(rows: EvalRow[], documentId: string) {
  const byDiff = totalsByDifficulty(rows);
  const totalPass = rows.filter((r) => r.status === "PASS").length;
  const totalFail = rows.filter((r) => r.status === "FAIL").length;
  const totalSevere = rows.filter((r) => r.status === "SEVERE").length;

  let md = `# Eval Results\n\n`;
  md += `Run: ${new Date().toISOString()}\n\n`;
  md += `Strategy: \`${strategy}\`\n\n`;
  md += `Document ID: \`${documentId}\`\n\n`;
  md += `## Summary\n\n`;
  md += `- **PASS:** ${totalPass} / ${rows.length}\n`;
  md += `- **FAIL:** ${totalFail} / ${rows.length}\n`;
  md += `- **SEVERE:** ${totalSevere} / ${rows.length}\n\n`;
  md += `## By difficulty\n\n`;
  md += `| Difficulty | PASS | FAIL | SEVERE |\n`;
  md += `|------------|------|------|--------|\n`;
  for (const [diff, counts] of [...byDiff.entries()].sort()) {
    md += `| ${diff} | ${counts.pass} | ${counts.fail} | ${counts.severe} |\n`;
  }
  md += `\n## Results\n\n`;
  md += `| id | difficulty | result | top_sim | latency_ms | notes |\n`;
  md += `|----|------------|--------|---------|------------|-------|\n`;
  for (const row of rows) {
    md += `| ${row.id} | ${row.difficulty} | ${row.status} | ${row.topSimilarity} | ${row.latencyMs} | ${row.notes.replace(/\|/g, "\\|")} |\n`;
  }

  const outPath = resolve(process.cwd(), `eval/${outFilename("results")}`);
  writeFileSync(outPath, md, "utf-8");
  console.log(`\nWrote ${outPath}`);
}

function writeTranscripts(rows: EvalRow[]) {
  const failures = rows.filter((r) => r.status === "FAIL");
  if (failures.length === 0) {
    return;
  }

  let md = `# Eval Failure Transcripts\n\n`;
  md += `Run: ${new Date().toISOString()}\n\n`;
  md += `${failures.length} FAIL(s) — full question, model answer, and retrieved chunks.\n\n`;

  for (const row of failures) {
    md += `---\n\n`;
    md += `## Q${row.id} (${row.difficulty}) — ${row.notes}\n\n`;
    md += `### Question\n\n${row.question}\n\n`;
    md += `### Model answer\n\n${row.answer || "_(empty)_"}\n\n`;
    md += `### Retrieved chunks (${row.retrievedChunks.length})\n\n`;
    if (row.retrievedChunks.length === 0) {
      md += `_No chunks retrieved._\n\n`;
    } else {
      for (const [i, chunk] of row.retrievedChunks.entries()) {
        md += `${i + 1}. **${chunk.sectionLabel}** — similarity ${chunk.similarity.toFixed(3)}\n`;
      }
      md += `\n`;
    }
  }

  const outPath = resolve(process.cwd(), `eval/${outFilename("transcripts")}`);
  writeFileSync(outPath, md, "utf-8");
  console.log(`Wrote ${outPath}`);
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requireEnv("EVAL_USER_EMAIL");
  const password = requireEnv("EVAL_USER_PASSWORD");

  const supabase = createClient(url, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) {
    throw new Error(`Sign-in failed: ${authError.message}`);
  }

  let accessToken = "";
  let aiBaseUrl = "";
  if (qaTarget === "remote") {
    aiBaseUrl = requireEnv("AI_BASE_URL");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session available for remote eval.");
    accessToken = session.access_token;
    console.log(`QA target: remote → ${aiBaseUrl}/qa/answer`);
  }

  const goldenPath = resolve(process.cwd(), `eval/${goldenFile}`);
  const golden = JSON.parse(readFileSync(goldenPath, "utf-8")) as GoldenFile;

  // golden.json (F-122) keeps its exact original resolution — DOC_ID env,
  // frozen and untouched. Other golden files resolve via eval/documents.json,
  // keyed by their own document.form (e.g. "F-123").
  const documentId =
    goldenFile === "golden.json"
      ? await resolveDocumentId(supabase)
      : await resolveDocumentIdForForm(
          supabase,
          (golden.document as { form: string }).form
        );
  const validSections = await fetchValidSections(supabase, documentId);

  console.log(
    `Evaluating ${golden.questions.length} questions (strategy: ${strategy}, golden: ${goldenFile}) against doc ${documentId}\n`
  );

  const rows: EvalRow[] = [];

  for (let i = 0; i < golden.questions.length; i++) {
    const q = golden.questions[i]!;
    const start = Date.now();
    let result: PolicyQAResult;
    try {
      if (qaTarget === "remote") {
        const resp = await askPolicyQuestion(aiBaseUrl, accessToken, {
          document_id: documentId,
          question: q.question,
        });
        result = {
          answer: resp.answer,
          citations: [],
          retrievedChunks: resp.retrieved_chunks.map((c) => ({
            id: c.id,
            sectionLabel: c.section_label ?? "Section",
            pageStart: c.page_start ?? null,
            pageEnd: c.page_end ?? null,
            content: c.content,
            similarity: c.similarity,
          })),
          refused: resp.refused,
          topSimilarity: resp.top_similarity ?? null,
        };
      } else {
        result =
          strategy === "tree"
            ? await answerPolicyQuestionTree(supabase, documentId, q.question)
            : await answerPolicyQuestion(supabase, documentId, q.question);
      }
    } catch (err) {
      const latencyMs = Date.now() - start;
      rows.push({
        id: q.id,
        difficulty: q.difficulty,
        status: "FAIL",
        topSimilarity: "—",
        latencyMs,
        question: q.question,
        answer: "",
        notes: err instanceof Error ? err.message : "Unknown error",
        retrievedChunks: [],
      });
      if (i < golden.questions.length - 1) await sleep(DELAY_MS);
      continue;
    }

    const latencyMs = Date.now() - start;
    const { status, notes } = scoreQuestion(q, result.answer, validSections);

    rows.push({
      id: q.id,
      difficulty: q.difficulty,
      status,
      topSimilarity:
        result.topSimilarity != null ? result.topSimilarity.toFixed(3) : "—",
      latencyMs,
      question: q.question,
      answer: result.answer,
      notes,
      retrievedChunks: result.retrievedChunks,
    });

    if (i < golden.questions.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  printTable(rows);

  const byDiff = totalsByDifficulty(rows);
  console.log("\nTotals by difficulty:");
  for (const [diff, counts] of [...byDiff.entries()].sort()) {
    console.log(
      `  ${diff}: PASS=${counts.pass} FAIL=${counts.fail} SEVERE=${counts.severe}`
    );
  }

  const totalPass = rows.filter((r) => r.status === "PASS").length;
  console.log(
    `\nOverall: PASS=${totalPass}/${rows.length} FAIL=${rows.filter((r) => r.status === "FAIL").length} SEVERE=${rows.filter((r) => r.status === "SEVERE").length}`
  );

  writeMarkdown(rows, documentId);
  writeTranscripts(rows);

  const ciMode = process.env.EVAL_CI === "1";
  if (ciMode) {
    const totalFail = rows.filter((r) => r.status === "FAIL").length;
    const totalSevere = rows.filter((r) => r.status === "SEVERE").length;
    const minPass = Number(process.env.EVAL_MIN_PASS ?? "17");

    if (totalSevere > 0 || totalPass < minPass) {
      console.error("\n=== EVAL CI FAIL ===");
      console.error(
        `PASS=${totalPass}/${rows.length} (required >= ${minPass}), FAIL=${totalFail}, SEVERE=${totalSevere}`
      );
      process.exit(1);
    }

    console.log("\n=== EVAL CI PASS ===");
    console.log(
      `PASS=${totalPass}/${rows.length}, FAIL=${totalFail}, SEVERE=${totalSevere}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

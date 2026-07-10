import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";
import {
  fetchValidSections,
  resolveDocumentId,
  scoreQuestion,
  type EvalStatus,
  type GoldenFile,
} from "./scoring";
import { answerPolicyQuestion } from "../lib/qa/pipeline";
import type { PolicyCitation } from "../lib/qa/types";
import { answerPolicyQuestionTree } from "../lib/tree/navigate";

loadEnvLocal();

const strategy = (process.env.STRATEGY ?? "vector") as "vector" | "tree";

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

  const outPath =
    strategy === "vector"
      ? resolve(process.cwd(), "eval/results.md")
      : resolve(process.cwd(), `eval/results.${strategy}.md`);
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

  const outPath =
    strategy === "vector"
      ? resolve(process.cwd(), "eval/transcripts.md")
      : resolve(process.cwd(), `eval/transcripts.${strategy}.md`);
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

  const documentId = await resolveDocumentId(supabase);
  const validSections = await fetchValidSections(supabase, documentId);

  const goldenPath = resolve(process.cwd(), "eval/golden.json");
  const golden = JSON.parse(readFileSync(goldenPath, "utf-8")) as GoldenFile;

  console.log(
    `Evaluating ${golden.questions.length} questions (strategy: ${strategy}) against doc ${documentId}\n`
  );

  const rows: EvalRow[] = [];

  for (let i = 0; i < golden.questions.length; i++) {
    const q = golden.questions[i]!;
    const start = Date.now();
    let result;
    try {
      result =
        strategy === "tree"
          ? await answerPolicyQuestionTree(supabase, documentId, q.question)
          : await answerPolicyQuestion(supabase, documentId, q.question);
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

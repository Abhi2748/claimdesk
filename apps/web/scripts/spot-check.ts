/**
 * One-off spot-check: run a handful of golden questions against a specific
 * document_id and print the answer + retrieved chunks, so a human can
 * confirm the doc is actually answerable before trusting the full eval run.
 * Not part of the eval suite; delete-safe.
 *
 * Run: pnpm --filter web exec tsx scripts/spot-check.ts <form> <id1> [id2] [id3]
 * e.g. pnpm --filter web exec tsx scripts/spot-check.ts F-123 1 5 9
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvLocal, requireEnv } from "../eval/env";
import { resolveDocumentIdForForm, type GoldenFile } from "../eval/scoring";
import { answerPolicyQuestion } from "../lib/qa/pipeline";

loadEnvLocal();

async function main() {
  const [form, ...idsArg] = process.argv.slice(2);
  if (!form || idsArg.length === 0) {
    throw new Error("Usage: spot-check.ts <form> <questionId1> [id2] [id3]");
  }
  const ids = idsArg.map((s) => parseInt(s, 10));

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requireEnv("EVAL_USER_EMAIL");
  const password = requireEnv("EVAL_USER_PASSWORD");

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`Sign-in failed: ${authError.message}`);

  const documentId = await resolveDocumentIdForForm(supabase, form);
  console.log(`Form ${form} -> document_id ${documentId}\n`);

  const goldenFileName =
    form === "F-123" ? "golden-f123.json" : form === "F-144" ? "golden-f144.json" : "golden.json";
  const goldenPath = resolve(process.cwd(), `eval/${goldenFileName}`);
  const golden = JSON.parse(readFileSync(goldenPath, "utf-8")) as GoldenFile;

  for (const id of ids) {
    const q = golden.questions.find((q) => q.id === id);
    if (!q) {
      console.log(`No question with id ${id} in ${goldenFileName}\n`);
      continue;
    }
    console.log("=".repeat(80));
    console.log(`Q${q.id} (${q.difficulty}): ${q.question}`);
    console.log(`must_cite: ${JSON.stringify(q.must_cite)}  must_refuse: ${q.must_refuse}`);
    console.log("-".repeat(80));

    const result = await answerPolicyQuestion(supabase, documentId, q.question);

    console.log(`ANSWER:\n${result.answer}\n`);
    console.log(`top_similarity: ${result.topSimilarity?.toFixed(3) ?? "—"}  refused: ${result.refused}`);
    console.log(`RETRIEVED CHUNKS (${result.retrievedChunks.length}):`);
    for (const [i, c] of result.retrievedChunks.entries()) {
      console.log(
        `  ${i + 1}. [${c.sectionLabel}] p.${c.pageStart ?? "?"}-${c.pageEnd ?? "?"} sim=${c.similarity.toFixed(3)}`
      );
      console.log(`     "${c.content.slice(0, 160).replace(/\n/g, " ")}..."`);
    }
    console.log();
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

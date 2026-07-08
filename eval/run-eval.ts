import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { REFUSAL_MESSAGE } from "../lib/qa/constants";
import { answerPolicyQuestion } from "../lib/qa/pipeline";

loadEnvLocal();

const DELAY_MS = 1000;
const SECTION_REF_PATTERN = /([IVX]+\.[A-Z](?:\.\d+)?)/gi;

interface GoldenQuestion {
  id: number;
  difficulty: string;
  question: string;
  expected_answer: string;
  must_cite: string[];
  pages: number[];
  must_refuse: boolean;
  trap_notes?: string;
}

interface GoldenFile {
  document: Record<string, unknown>;
  scoring_rules: Record<string, unknown>;
  questions: GoldenQuestion[];
}

type EvalStatus = "PASS" | "FAIL" | "SEVERE";

interface EvalRow {
  id: number;
  difficulty: string;
  status: EvalStatus;
  topSimilarity: string;
  latencyMs: number;
  answer: string;
  notes: string;
}

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function buildValidSectionSet(labels: (string | null)[]): Set<string> {
  const set = new Set<string>();
  for (const label of labels) {
    if (!label) continue;
    const token = label.trim().split(/\s+/)[0]!;
    const upper = token.toUpperCase();
    set.add(upper);
    const segments = token.split(".");
    for (let i = 1; i <= segments.length; i++) {
      set.add(segments.slice(0, i).join(".").toUpperCase());
    }
  }
  return set;
}

function extractSectionRefs(answer: string): string[] {
  const refs = new Set<string>();
  for (const match of answer.matchAll(SECTION_REF_PATTERN)) {
    refs.add(match[1]!.toUpperCase());
  }
  return [...refs];
}

function answerContainsCite(answer: string, mustCite: string[]): boolean {
  if (mustCite.length === 0) return false;
  const normalized = normalizeWhitespace(answer);
  return mustCite.some((cite) => {
    const compact = cite.replace(/\s+/g, "");
    const re = new RegExp(
      `(?:Section\\s+)?${compact.replace(/\./g, "\\.")}\\b`,
      "i"
    );
    return re.test(normalized);
  });
}

function findInventedCitations(
  answer: string,
  validSections: Set<string>
): string[] {
  return extractSectionRefs(answer).filter((ref) => !validSections.has(ref));
}

function scoreQuestion(
  q: GoldenQuestion,
  answer: string,
  validSections: Set<string>
): { status: EvalStatus; notes: string } {
  const invented = findInventedCitations(answer, validSections);
  const trimmedAnswer = answer.trim();

  if (invented.length > 0) {
    return {
      status: "SEVERE",
      notes: `Invented citation(s): ${invented.join(", ")}`,
    };
  }

  if (q.must_refuse) {
    if (trimmedAnswer === REFUSAL_MESSAGE) {
      return { status: "PASS", notes: "Correct refusal" };
    }
    return {
      status: "SEVERE",
      notes: "must_refuse question received substantive answer",
    };
  }

  if (answerContainsCite(answer, q.must_cite)) {
    return { status: "PASS", notes: `Cited ${q.must_cite.join(", ")}` };
  }

  return {
    status: "FAIL",
    notes: `Missing required cite: ${q.must_cite.join(", ")}`,
  };
}

async function resolveDocumentId(
  supabase: SupabaseClient
): Promise<string> {
  const docId = process.env.DOC_ID;
  if (docId) {
    const { data, error } = await supabase
      .from("documents")
      .select("id, ingest_status, doc_type")
      .eq("id", docId)
      .single();
    if (error || !data) {
      throw new Error(`DOC_ID not found: ${error?.message}`);
    }
    const doc = data as { ingest_status: string };
    if (doc.ingest_status !== "ready") {
      throw new Error(`DOC_ID document is not ready (ingest_status=${doc.ingest_status})`);
    }
    return docId;
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, ingest_status, doc_type, created_at")
    .eq("doc_type", "policy")
    .eq("ingest_status", "ready")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    throw new Error(
      "No ready policy document found. Set DOC_ID or process a policy PDF."
    );
  }

  return (data[0] as { id: string }).id;
}

async function fetchValidSections(
  supabase: SupabaseClient,
  documentId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("chunks")
    .select("section_label")
    .eq("document_id", documentId);

  if (error) {
    throw new Error(`Failed to load chunk labels: ${error.message}`);
  }

  return buildValidSectionSet(
    (data ?? []).map((r) => (r as { section_label: string | null }).section_label)
  );
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

  const outPath = resolve(process.cwd(), "eval/results.md");
  writeFileSync(outPath, md, "utf-8");
  console.log(`\nWrote ${outPath}`);
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

  console.log(`Evaluating ${golden.questions.length} questions against doc ${documentId}\n`);

  const rows: EvalRow[] = [];

  for (let i = 0; i < golden.questions.length; i++) {
    const q = golden.questions[i]!;
    const start = Date.now();
    let result;
    try {
      result = await answerPolicyQuestion(supabase, documentId, q.question);
    } catch (err) {
      const latencyMs = Date.now() - start;
      rows.push({
        id: q.id,
        difficulty: q.difficulty,
        status: "FAIL",
        topSimilarity: "—",
        latencyMs,
        answer: "",
        notes: err instanceof Error ? err.message : "Unknown error",
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
      answer: result.answer,
      notes,
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

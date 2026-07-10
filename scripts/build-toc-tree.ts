import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  extractTocTree,
  reconstructDocText,
  treeStats,
  validateTocTree,
} from "../lib/tree/extract-tree";

loadEnvLocal();

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

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requireEnv("EVAL_USER_EMAIL");
  const password = requireEnv("EVAL_USER_PASSWORD");
  const documentId = requireEnv("DOC_ID");

  const supabase = createClient(url, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) {
    throw new Error(`Sign-in failed: ${authError.message}`);
  }

  const { data: docData, error: docError } = await supabase
    .from("documents")
    .select("id, title, ingest_status")
    .eq("id", documentId)
    .single();

  if (docError || !docData) {
    throw new Error(`DOC_ID not found: ${docError?.message ?? "unknown"}`);
  }

  const doc = docData as { id: string; title: string; ingest_status: string };
  if (doc.ingest_status !== "ready") {
    throw new Error(
      `Document is not ready (ingest_status=${doc.ingest_status}). Process it first.`
    );
  }

  console.log(`Building ToC tree for: ${doc.title} (${documentId})\n`);

  const { text, minPage, maxPage } = await reconstructDocText(
    supabase,
    documentId
  );
  console.log(
    `Reconstructed ${text.length.toLocaleString()} chars, pages ${minPage}–${maxPage}\n`
  );

  console.log("Extracting tree with Claude…");
  const tree = await extractTocTree(text);

  const validation = validateTocTree(tree, minPage, maxPage);
  const stats = treeStats(tree);

  console.log("\n--- Summary ---");
  console.log(`Document: ${tree.docDescription || "(no description)"}`);
  console.log(`Model: ${tree.model} (${tree.promptVersion})`);
  console.log(`Total nodes: ${stats.totalNodes}`);
  console.log(`Max depth: ${stats.maxDepth}`);
  if (stats.pageSpan) {
    console.log(
      `Page span: ${stats.pageSpan.start}–${stats.pageSpan.end} (bounds ${minPage}–${maxPage})`
    );
  }

  if (!validation.ok) {
    console.error("\nValidation FAILED — tree not persisted:");
    for (const err of validation.errors) {
      console.error(`  • ${err}`);
    }
    process.exit(1);
  }

  console.log("\nValidation: OK");

  const { error: updateError } = await supabase
    .from("documents")
    .update({ toc_tree: tree as unknown as Record<string, unknown> })
    .eq("id", documentId);

  if (updateError) {
    throw new Error(`Failed to persist toc_tree: ${updateError.message}`);
  }

  console.log(`\nPersisted toc_tree to document ${documentId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

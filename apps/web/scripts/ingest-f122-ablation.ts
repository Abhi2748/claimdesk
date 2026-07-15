/**
 * Block 2.2c — ingest a FRESH copy of F-122 with today's parser, under a new
 * document_id, into the same fixture case as F-123/F-144. This is the
 * ablation's F-122 leg of the reproducible 3-doc benchmark corpus.
 *
 * Does NOT touch the live/frozen F-122 document (its DOC_ID, chunks, or the
 * 17/20 eval gate) — that document is never reprocessed. This script inserts
 * an entirely separate document row with a distinct title/storage path so
 * there is no collision with the live doc, and records its id under a new
 * "F-122-ABLATION" key in eval/documents.json (existing keys, including the
 * frozen "F-122", are read and preserved, not overwritten).
 *
 * Idempotent: reruns reuse the existing ablation document row if one exists.
 *
 * Note (ADR 007): the ingestion default flipped to MIN_CHUNK_CONTENT_CHARS=0
 * for new documents. F-122-ABLATION is the ADR 003/004 50-char baseline —
 * rerunning this script (idempotent: reuses the existing row and re-chunks
 * it) must keep producing that same baseline, so it now requires
 * CHUNK_MIN_CONTENT_CHARS=50 explicitly rather than silently inheriting the
 * new default.
 *
 * Run: CHUNK_MIN_CONTENT_CHARS=50 pnpm --filter web exec tsx scripts/ingest-f122-ablation.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvLocal, requireEnv } from "../eval/env";
import { processDocumentIngestion } from "../lib/ingestion/process-document";
import { chunkPolicyText } from "../lib/ingestion/chunk-policy";
import { extractPdfPages } from "../lib/ingestion/extract-pdf";

loadEnvLocal();

if (process.env.CHUNK_MIN_CONTENT_CHARS !== "50") {
  throw new Error(
    "This script reproduces the ADR 003/004 50-char chunking baseline for " +
      "F-122-ABLATION — run with CHUNK_MIN_CONTENT_CHARS=50 explicitly (got " +
      `${JSON.stringify(process.env.CHUNK_MIN_CONTENT_CHARS)}). The ` +
      "ingestion default flipped to 0 (MC0) in ADR 007; new documents don't " +
      "need this override, but rerunning this script does, or it would " +
      "silently re-chunk the baseline row at the new default."
  );
}

// Same org + case as the F-123/F-144 ablation ingest (Block 2.2b) and the
// frozen F-122 eval document.
const ORG_ID = "60b4efce-8f8a-4298-8df6-3bcd8d934cb8";
const CASE_ID = "e5dcbbae-134c-4548-b6d2-74d8de3e5131";

const SOURCE_FILE = "fema_F-122-Dwelling-SFIP_2021.pdf";
// Distinct title so this never collides (by case_id+title idempotency match,
// or by storage path) with the live/frozen F-122 document row.
const ABLATION_TITLE = "fema_F-122-Dwelling-SFIP_2021.ablation-2.2c.pdf";

const EMBEDDING_PRICE_PER_MTOK = 0.02;
const CHARS_PER_TOKEN = 4;

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requireEnv("EVAL_USER_EMAIL");
  const password = requireEnv("EVAL_USER_PASSWORD");

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { error: authError, data: authData } =
    await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) {
    throw new Error(`Sign-in failed: ${authError?.message}`);
  }
  const userId = authData.user.id;

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, org_id")
    .eq("id", CASE_ID)
    .single();
  if (caseError || !caseRow) {
    throw new Error(`Fixture case not found: ${caseError?.message}`);
  }
  if ((caseRow as { org_id: string }).org_id !== ORG_ID) {
    throw new Error("Fixture case org_id does not match expected ORG_ID.");
  }

  const pdfPath = resolve(process.cwd(), "../../docs/policy-corpus", SOURCE_FILE);
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }
  const pdfBytes = readFileSync(pdfPath);

  const filename = ABLATION_TITLE.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${ORG_ID}/${CASE_ID}/${filename}`;

  const { data: existing } = await supabase
    .from("documents")
    .select("id, storage_path, ingest_status")
    .eq("case_id", CASE_ID)
    .eq("title", ABLATION_TITLE)
    .maybeSingle();

  let documentId: string;
  let alreadyReady = false;
  if (existing) {
    documentId = (existing as { id: string }).id;
    alreadyReady =
      (existing as { ingest_status: string }).ingest_status === "ready";
    console.log(
      `Reusing existing ablation document row ${documentId} (ingest_status=${(existing as { ingest_status: string }).ingest_status})`
    );
  } else {
    const { error: uploadError } = await supabase.storage
      .from("case-documents")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    console.log(`Uploaded to storage: ${storagePath}`);

    const { data: inserted, error: insertError } = await supabase
      .from("documents")
      .insert([
        {
          case_id: CASE_ID,
          storage_path: storagePath,
          doc_type: "policy",
          title: ABLATION_TITLE,
          page_count: null,
          ingest_status: "pending",
        },
      ])
      .select("id")
      .single();
    if (insertError || !inserted) {
      await supabase.storage.from("case-documents").remove([storagePath]);
      throw new Error(`Failed to insert document row: ${insertError?.message}`);
    }
    documentId = (inserted as { id: string }).id;
    console.log(`Inserted document row ${documentId}`);
  }

  const { pages } = await extractPdfPages(
    pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer
  );
  const previewChunks = chunkPolicyText(pages);
  const totalChars = previewChunks.reduce((sum, c) => sum + c.content.length, 0);
  const estimatedEmbeddingTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
  const estimatedCostUsd =
    (estimatedEmbeddingTokens / 1_000_000) * EMBEDDING_PRICE_PER_MTOK;

  let pageCount: number;
  let chunkCount: number;
  let ingestStats: {
    chunk_count: number;
    labeled_ratio: number;
    pages_detected: number;
    total_pages: number;
  };

  if (alreadyReady) {
    const { data: docRow, error: docRowError } = await supabase
      .from("documents")
      .select("page_count, ingest_stats")
      .eq("id", documentId)
      .single();
    if (docRowError || !docRow) {
      throw new Error(`Failed to read existing document: ${docRowError?.message}`);
    }
    const row = docRow as { page_count: number; ingest_stats: typeof ingestStats };
    pageCount = row.page_count;
    ingestStats = row.ingest_stats;
    chunkCount = ingestStats.chunk_count;
    console.log(
      `Already ready — skipping re-ingest: ${chunkCount} chunks, ${pageCount} pages, labeled_ratio=${ingestStats.labeled_ratio.toFixed(3)}, pages_detected=${ingestStats.pages_detected}/${ingestStats.total_pages}`
    );
  } else {
    await supabase.from("documents").update({ ingest_status: "pending" }).eq("id", documentId);

    const result = await processDocumentIngestion(supabase, documentId, storagePath, userId);
    pageCount = result.pageCount;
    chunkCount = result.chunkCount;
    ingestStats = result.ingestStats;

    console.log(
      `Ingested: ${chunkCount} chunks, ${pageCount} pages, labeled_ratio=${ingestStats.labeled_ratio.toFixed(3)}, pages_detected=${ingestStats.pages_detected}/${ingestStats.total_pages}`
    );
    console.log(
      `Estimated embedding cost: ~${estimatedEmbeddingTokens} tokens ~= $${estimatedCostUsd.toFixed(5)}`
    );
  }

  console.log("\n=== Summary ===");
  console.table([
    {
      form: "F-122-ABLATION",
      document_id: documentId,
      chunks: chunkCount,
      pages: pageCount,
      labeled_ratio: ingestStats.labeled_ratio.toFixed(3),
      pages_detected: `${ingestStats.pages_detected}/${ingestStats.total_pages}`,
      est_tokens: estimatedEmbeddingTokens,
      est_cost_usd: estimatedCostUsd.toFixed(5),
    },
  ]);

  const documentsMapPath = resolve(process.cwd(), "eval/documents.json");
  const existingMap: Record<string, string> = existsSync(documentsMapPath)
    ? JSON.parse(readFileSync(documentsMapPath, "utf-8"))
    : {};
  const documentsMap = { ...existingMap, "F-122-ABLATION": documentId };
  writeFileSync(documentsMapPath, JSON.stringify(documentsMap, null, 2) + "\n");
  console.log(`\nWrote ${documentsMapPath}`);
  console.log(JSON.stringify(documentsMap, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

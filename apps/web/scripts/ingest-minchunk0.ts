/**
 * Block 2.2c (chunking-knob leg) — ingest fresh copies of all 3 benchmark
 * docs (F-122-ABLATION, F-123, F-144 source PDFs) at
 * MIN_CHUNK_CONTENT_CHARS=0, under NEW document rows, so the retrieval-lab
 * ablation can compare the two chunking settings without touching the
 * 50-char rows (still needed as the ADR 003/004 baseline) or the
 * live/frozen F-122 document.
 *
 * Note (ADR 007): MIN_CHUNK_CONTENT_CHARS=0 is now the ingestion default
 * for all new documents — this script's explicit override predates that
 * and is kept for clarity/reproducibility of exactly what the 2.2c ablation
 * ran, not because it's still needed to get 0-char behavior.
 *
 * MIN_CHUNK_CONTENT_CHARS is overridden via the CHUNK_MIN_CONTENT_CHARS env
 * var, which chunk-policy.ts reads at module-load time — this process must
 * be launched with that env var set (see the Run line below).
 *
 * Idempotent: reruns reuse the existing MC0 document row if one exists.
 * Merges new keys into eval/documents.json; never overwrites existing keys.
 *
 * Run: CHUNK_MIN_CONTENT_CHARS=0 pnpm --filter web exec tsx scripts/ingest-minchunk0.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvLocal, requireEnv } from "../eval/env";
import { processDocumentIngestion } from "../lib/ingestion/process-document";
import { chunkPolicyText } from "../lib/ingestion/chunk-policy";
import { extractPdfPages } from "../lib/ingestion/extract-pdf";

loadEnvLocal();

if (process.env.CHUNK_MIN_CONTENT_CHARS !== "0") {
  throw new Error(
    "This script must be run with CHUNK_MIN_CONTENT_CHARS=0 (got " +
      `${JSON.stringify(process.env.CHUNK_MIN_CONTENT_CHARS)}) — it exists to ` +
      "produce the MIN_CHUNK_CONTENT_CHARS=0 ablation variant; running it at " +
      "the default would just duplicate the existing 50-char rows."
  );
}

// Same org + case as every other golden-corpus ingest (Block 1.2a-ii /
// 2.2b / 2.2c).
const ORG_ID = "60b4efce-8f8a-4298-8df6-3bcd8d934cb8";
const CASE_ID = "e5dcbbae-134c-4548-b6d2-74d8de3e5131";

const EMBEDDING_PRICE_PER_MTOK = 0.02;
const CHARS_PER_TOKEN = 4;

interface IngestTarget {
  form: string;
  file: string;
}

// F-122's benchmark copy is the ablation row (920bb3a7...), not the frozen
// live F-122 (e11b7bdf...) — same source PDF, distinct title, never the
// live document.
const TARGETS: IngestTarget[] = [
  { form: "F-122-ABLATION-MC0", file: "fema_F-122-Dwelling-SFIP_2021.pdf" },
  { form: "F-123-MC0", file: "fema_F-123-general-property-SFIP_2021.pdf" },
  { form: "F-144-MC0", file: "fema_F-144-RCBAP-SFIP_2021.pdf" },
];

interface IngestReport {
  form: string;
  documentId: string;
  pageCount: number;
  chunkCount: number;
  labeledRatio: number;
  pagesDetected: number;
  totalPages: number;
  estimatedEmbeddingTokens: number;
  estimatedCostUsd: number;
}

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

  const reports: IngestReport[] = [];

  for (const target of TARGETS) {
    console.log(`\n=== ${target.form}: ${target.file} (MIN_CHUNK_CONTENT_CHARS=0) ===`);

    const pdfPath = resolve(process.cwd(), "../../docs/policy-corpus", target.file);
    if (!existsSync(pdfPath)) {
      throw new Error(`PDF not found: ${pdfPath}`);
    }
    const pdfBytes = readFileSync(pdfPath);

    // Distinct title from both the frozen live doc and the 50-char ablation
    // row, so idempotency matching and storage paths never collide.
    const title = `${target.file}.minchunk0-2.2c.pdf`;
    const filename = title.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${ORG_ID}/${CASE_ID}/${filename}`;

    const { data: existing } = await supabase
      .from("documents")
      .select("id, storage_path, ingest_status")
      .eq("case_id", CASE_ID)
      .eq("title", title)
      .maybeSingle();

    let documentId: string;
    let alreadyReady = false;
    if (existing) {
      documentId = (existing as { id: string }).id;
      alreadyReady = (existing as { ingest_status: string }).ingest_status === "ready";
      console.log(
        `Reusing existing document row ${documentId} (ingest_status=${(existing as { ingest_status: string }).ingest_status})`
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
            title,
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
    const estimatedCostUsd = (estimatedEmbeddingTokens / 1_000_000) * EMBEDDING_PRICE_PER_MTOK;

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

    reports.push({
      form: target.form,
      documentId,
      pageCount,
      chunkCount,
      labeledRatio: ingestStats.labeled_ratio,
      pagesDetected: ingestStats.pages_detected,
      totalPages: ingestStats.total_pages,
      estimatedEmbeddingTokens,
      estimatedCostUsd,
    });
  }

  console.log("\n=== Summary ===");
  console.table(
    reports.map((r) => ({
      form: r.form,
      document_id: r.documentId,
      chunks: r.chunkCount,
      pages: r.pageCount,
      labeled_ratio: r.labeledRatio.toFixed(3),
      pages_detected: `${r.pagesDetected}/${r.totalPages}`,
      est_tokens: r.estimatedEmbeddingTokens,
      est_cost_usd: r.estimatedCostUsd.toFixed(5),
    }))
  );

  const documentsMapPath = resolve(process.cwd(), "eval/documents.json");
  const existingMap: Record<string, string> = existsSync(documentsMapPath)
    ? JSON.parse(readFileSync(documentsMapPath, "utf-8"))
    : {};
  const documentsMap = { ...existingMap };
  for (const r of reports) documentsMap[r.form] = r.documentId;
  writeFileSync(documentsMapPath, JSON.stringify(documentsMap, null, 2) + "\n");
  console.log(`\nWrote ${documentsMapPath}`);
  console.log(JSON.stringify(documentsMap, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

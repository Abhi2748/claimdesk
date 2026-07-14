/**
 * Block 2.2b — ingest the F-123 and F-144 golden-corpus PDFs (owner account,
 * same org as the frozen F-122 eval doc) so their golden questions are
 * answerable, and record each document_id + a token/cost report for the
 * ingestion.
 *
 * Idempotent: reruns reuse an existing document row (matched by case_id +
 * title) and just re-run ingestion (chunk+embed) on it rather than
 * duplicating the upload.
 *
 * Does NOT touch the F-122 path, retrieval code, or prompt logic — this
 * only drives the existing processDocumentIngestion() pipeline against two
 * new source PDFs.
 *
 * Run: pnpm --filter web exec tsx scripts/ingest-golden-docs.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvLocal, requireEnv } from "../eval/env";
import { processDocumentIngestion } from "../lib/ingestion/process-document";
import { chunkPolicyText } from "../lib/ingestion/chunk-policy";
import { extractPdfPages } from "../lib/ingestion/extract-pdf";

loadEnvLocal();

// Same org + case the frozen F-122 eval document (DOC_ID) already lives in —
// this case has been the golden-corpus fixture since Block 1.2a-ii.
const ORG_ID = "60b4efce-8f8a-4298-8df6-3bcd8d934cb8";
const CASE_ID = "e5dcbbae-134c-4548-b6d2-74d8de3e5131";

// OpenAI text-embedding-3-small pricing, per ADR 001.
const EMBEDDING_PRICE_PER_MTOK = 0.02;
const CHARS_PER_TOKEN = 4;

interface IngestTarget {
  form: string;
  file: string;
}

const TARGETS: IngestTarget[] = [
  { form: "F-123", file: "fema_F-123-general-property-SFIP_2021.pdf" },
  { form: "F-144", file: "fema_F-144-RCBAP-SFIP_2021.pdf" },
];

interface IngestReport {
  form: string;
  documentId: string;
  storagePath: string;
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
    console.log(`\n=== ${target.form}: ${target.file} ===`);

    const pdfPath = resolve(
      process.cwd(),
      "../../docs/policy-corpus",
      target.file
    );
    if (!existsSync(pdfPath)) {
      throw new Error(`PDF not found: ${pdfPath}`);
    }
    const pdfBytes = readFileSync(pdfPath);

    const filename = target.file.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${ORG_ID}/${CASE_ID}/${filename}`;

    // Idempotency: reuse an existing document row for this case+title if one
    // already exists (e.g. a prior run of this script), instead of inserting
    // a duplicate.
    const { data: existing } = await supabase
      .from("documents")
      .select("id, storage_path, ingest_status")
      .eq("case_id", CASE_ID)
      .eq("title", target.file)
      .maybeSingle();

    let documentId: string;
    let alreadyReady = false;
    if (existing) {
      documentId = (existing as { id: string }).id;
      alreadyReady =
        (existing as { ingest_status: string }).ingest_status === "ready";
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
            title: target.file,
            page_count: null,
            ingest_status: "pending",
          },
        ])
        .select("id")
        .single();
      if (insertError || !inserted) {
        await supabase.storage.from("case-documents").remove([storagePath]);
        throw new Error(
          `Failed to insert document row: ${insertError?.message}`
        );
      }
      documentId = (inserted as { id: string }).id;
      console.log(`Inserted document row ${documentId}`);
    }

    // Independent pure-function pass (no API calls) purely to report the
    // token/cost estimate for this ingest — processDocumentIngestion below
    // redoes this internally and is the actual source of truth for the DB.
    const { pages, totalPages } = await extractPdfPages(pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer);
    const previewChunks = chunkPolicyText(pages);
    const totalChars = previewChunks.reduce(
      (sum, c) => sum + c.content.length,
      0
    );
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
      const row = docRow as {
        page_count: number;
        ingest_stats: typeof ingestStats;
      };
      pageCount = row.page_count;
      ingestStats = row.ingest_stats;
      chunkCount = ingestStats.chunk_count;
      console.log(
        `Already ready — skipping re-ingest: ${chunkCount} chunks, ${pageCount} pages, labeled_ratio=${ingestStats.labeled_ratio.toFixed(3)}, pages_detected=${ingestStats.pages_detected}/${ingestStats.total_pages}`
      );
    } else {
      await supabase
        .from("documents")
        .update({ ingest_status: "pending" })
        .eq("id", documentId);

      const result = await processDocumentIngestion(
        supabase,
        documentId,
        storagePath,
        userId
      );
      pageCount = result.pageCount;
      chunkCount = result.chunkCount;
      ingestStats = result.ingestStats;

      console.log(
        `Ingested: ${chunkCount} chunks, ${pageCount} pages, labeled_ratio=${ingestStats.labeled_ratio.toFixed(3)}, pages_detected=${ingestStats.pages_detected}/${ingestStats.total_pages}`
      );
      console.log(
        `Estimated embedding cost: ~${estimatedEmbeddingTokens} tokens ≈ $${estimatedCostUsd.toFixed(5)}`
      );
    }

    reports.push({
      form: target.form,
      documentId,
      storagePath,
      pageCount,
      chunkCount,
      labeledRatio: ingestStats.labeled_ratio,
      pagesDetected: ingestStats.pages_detected,
      totalPages: ingestStats.total_pages,
      estimatedEmbeddingTokens,
      estimatedCostUsd,
    });

    void totalPages; // extraction return value, unused beyond preview chunking
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
  const documentsMap: Record<string, string> = {
    "F-122": requireEnv("DOC_ID"),
  };
  for (const r of reports) {
    documentsMap[r.form] = r.documentId;
  }
  writeFileSync(documentsMapPath, JSON.stringify(documentsMap, null, 2) + "\n");
  console.log(`\nWrote ${documentsMapPath}`);
  console.log(JSON.stringify(documentsMap, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

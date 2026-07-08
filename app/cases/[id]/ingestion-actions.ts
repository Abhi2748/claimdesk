"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { processDocumentIngestion } from "@/lib/ingestion/process-document";
import type { ProcessDocumentState } from "./ingestion-types";

type IngestStatus = "pending" | "processing" | "ready" | "failed";

async function runIngestion(
  documentId: string,
  caseId: string,
  allowedStatuses: IngestStatus[]
): Promise<ProcessDocumentState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: docData, error: docError } = await supabase
    .from("documents")
    .select("id, storage_path, ingest_status")
    .eq("id", documentId)
    .eq("case_id", caseId)
    .single();

  if (docError || !docData) {
    return { error: "Document not found or access denied." };
  }

  const doc = docData as {
    id: string;
    storage_path: string;
    ingest_status: IngestStatus;
  };

  if (doc.ingest_status === "processing") {
    return { error: "Document is already being processed." };
  }

  if (!allowedStatuses.includes(doc.ingest_status)) {
    return {
      error: `Cannot process document with status "${doc.ingest_status}".`,
    };
  }

  const { error: statusError } = await supabase
    .from("documents")
    .update({ ingest_status: "processing" })
    .eq("id", documentId);

  if (statusError) {
    return { error: `Failed to start processing: ${statusError.message}` };
  }

  try {
    await processDocumentIngestion(
      supabase,
      documentId,
      doc.storage_path,
      user.id
    );
    revalidatePath(`/cases/${caseId}`);
    return { success: true };
  } catch (err) {
    console.error("Document ingestion failed:", err);
    await supabase
      .from("documents")
      .update({ ingest_status: "failed" })
      .eq("id", documentId);
    revalidatePath(`/cases/${caseId}`);
    return {
      error:
        err instanceof Error ? err.message : "Document processing failed.",
    };
  }
}

export async function processDocument(
  documentId: string,
  caseId: string
): Promise<ProcessDocumentState> {
  return runIngestion(documentId, caseId, ["pending"]);
}

export async function reprocessDocument(
  documentId: string,
  caseId: string
): Promise<ProcessDocumentState> {
  return runIngestion(documentId, caseId, ["ready", "failed"]);
}

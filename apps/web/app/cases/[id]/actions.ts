"use server";

import { revalidatePath } from "next/cache";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { Database, DocType } from "@/types/database";

export type UploadState = {
  error?: string;
  success?: boolean;
};

const VALID_DOC_TYPES: DocType[] = [
  "policy",
  "denial_letter",
  "estimate",
  "correspondence",
  "other",
];

export async function uploadDocument(
  _prevState: UploadState,
  formData: FormData
): Promise<UploadState> {
  const caseId = formData.get("caseId") as string;
  const docType = formData.get("doc_type") as DocType;
  const file = formData.get("file") as File | null;

  if (!caseId) {
    return { error: "Case ID is required." };
  }

  if (!file || file.size === 0) {
    return { error: "Please select a PDF file." };
  }

  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are allowed." };
  }

  if (!VALID_DOC_TYPES.includes(docType)) {
    return { error: "Invalid document type." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to upload documents." };
  }

  if (isDemoUser(user)) {
    return { error: "Uploads are disabled in the public demo." };
  }

  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select("id, org_id")
    .eq("id", caseId)
    .single();

  const caseRow = caseData as { id: string; org_id: string } | null;

  if (caseError || !caseRow) {
    return { error: "Case not found or access denied." };
  }

  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Org-scoped storage: the path prefix is the case's org_id, so the 012 storage
  // RLS policy (folder[1] = org) grants access to org members, not just the uploader.
  const storagePath = `${caseRow.org_id}/${caseId}/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("case-documents")
    .upload(storagePath, arrayBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  const documentRow: Database["public"]["Tables"]["documents"]["Insert"] = {
    case_id: caseId,
    storage_path: storagePath,
    doc_type: docType,
    title: file.name,
    page_count: null,
    ingest_status: "pending",
  };

  const { error: insertError } = await supabase
    .from("documents")
    .insert([documentRow]);

  if (insertError) {
    await supabase.storage.from("case-documents").remove([storagePath]);
    return { error: `Failed to save document record: ${insertError.message}` };
  }

  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

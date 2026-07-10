"use server";

import { answerPolicyQuestion as runPolicyQA } from "@/lib/qa/pipeline";
import { isDemoUser } from "@/lib/demo";
import { enforceDemoRateLimit } from "@/lib/demo-rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { AskPolicyResult } from "./qa-types";

export async function askPolicy(
  documentId: string,
  caseId: string,
  question: string
): Promise<AskPolicyResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    return { ok: false, error: "Please enter a question." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  if (isDemoUser(user)) {
    const guard = await enforceDemoRateLimit(supabase);
    if (!guard.ok) {
      return { ok: false, error: guard.message };
    }
  }

  const { data: docData, error: docError } = await supabase
    .from("documents")
    .select("id, ingest_status")
    .eq("id", documentId)
    .eq("case_id", caseId)
    .single();

  if (docError || !docData) {
    return { ok: false, error: "Document not found or access denied." };
  }

  const doc = docData as { id: string; ingest_status: string };

  if (doc.ingest_status !== "ready") {
    return { ok: false, error: "This document has not been processed yet." };
  }

  try {
    const result = await runPolicyQA(supabase, documentId, trimmed);

    return {
      ok: true,
      answer: result.answer,
      citations: result.citations,
      refused: result.refused,
    };
  } catch (err) {
    console.error("Policy Q&A failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

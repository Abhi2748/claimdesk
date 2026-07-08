"use server";

import { revalidatePath } from "next/cache";
import { runDemandLetterPipeline } from "@/lib/demand-letter/pipeline";
import { createClient } from "@/lib/supabase/server";
import type { Case, Document } from "@/types/database";
import type { DraftDemandLetterResult, SaveLetterResult } from "./letter-types";

export async function draftDemandLetter(
  caseId: string
): Promise<DraftDemandLetterResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", caseId)
    .single();

  if (caseError || !caseData) {
    return { ok: false, error: "Case not found or access denied." };
  }

  const caseRow = caseData as Case;

  const { data: documentsData } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", caseId);

  const documents = (documentsData ?? []) as Document[];

  try {
    const result = await runDemandLetterPipeline(
      supabase,
      caseRow,
      documents,
      user.id
    );

    revalidatePath(`/cases/${caseId}`);

    return {
      ok: true,
      letterId: result.letterId,
      content: result.content,
      hadPolicyPassages: result.hadPolicyPassages,
      queryCount: result.queryCount,
      passageCount: result.passageCount,
      plannedQueries: result.plannedQueries,
    };
  } catch (err) {
    console.error("Demand letter generation failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Letter generation failed.",
    };
  }
}

export async function saveLetterEdits(
  letterId: string,
  caseId: string,
  content: string
): Promise<SaveLetterResult> {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, error: "Letter content cannot be empty." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("letters")
    .update({ content: trimmed })
    .eq("id", letterId)
    .eq("case_id", caseId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

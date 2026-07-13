"use server";

import { revalidatePath } from "next/cache";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { ReviewKind, ReviewStatus } from "@/types/database";

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

export async function flagForReview(input: {
  caseId: string;
  kind: ReviewKind;
  title: string;
  summary?: string;
  refId?: string;
}): Promise<ReviewActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (isDemoUser(user)) return { ok: false, error: "Review actions are disabled in the demo." };

  const { error } = await supabase.from("review_items").insert([{
    case_id: input.caseId,
    kind: input.kind,
    title: input.title.slice(0, 200),
    summary: input.summary?.slice(0, 4000) ?? null,
    ref_id: input.refId ?? null,
  }]);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/review");
  return { ok: true };
}

export async function setReviewStatus(
  itemId: string,
  status: Exclude<ReviewStatus, "pending">,
  note?: string
): Promise<ReviewActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (isDemoUser(user)) return { ok: false, error: "Review actions are disabled in the demo." };

  const { error } = await supabase.from("review_items")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: note ?? null })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/review");
  return { ok: true };
}

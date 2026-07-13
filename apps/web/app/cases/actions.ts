"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { CaseStatus, ClaimType, Database } from "@/types/database";

export type MatterFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const CLAIM_TYPES: ClaimType[] = ["flood", "fire", "water", "wind_hail", "denied", "underpaid"];
const STATUSES: CaseStatus[] = ["intake", "investigation", "demand", "litigation", "resolved"];

type MatterValues = {
  title: string;
  client_name: string;
  claim_type: ClaimType;
  state: string;
  status: CaseStatus;
  insurer: string | null;
  policy_number: string | null;
  date_of_loss: string | null;
  amount_offered: number | null;
  amount_claimed: number | null;
  is_nfip: boolean;
};

type ParseResult =
  | { ok: true; values: MatterValues }
  | { ok: false; fieldErrors: Record<string, string> };

// To add an intake field later: (1) add the column in an additive migration,
// (2) add it to Case + the cases Insert/Update in types/database.ts, (3) add one
// getter + validation here and one field block in matter-form.tsx.
function parseMatterForm(formData: FormData): ParseResult {
  const fieldErrors: Record<string, string> = {};

  const title = ((formData.get("title") as string | null) ?? "").trim();
  const client_name = ((formData.get("client_name") as string | null) ?? "").trim();
  const claim_type = (formData.get("claim_type") as string | null) ?? "";
  const state = (((formData.get("state") as string | null) ?? "").trim()).toUpperCase();
  const status = (formData.get("status") as string | null) ?? "intake";
  const insurerRaw = ((formData.get("insurer") as string | null) ?? "").trim();
  const policyRaw = ((formData.get("policy_number") as string | null) ?? "").trim();
  const dolRaw = ((formData.get("date_of_loss") as string | null) ?? "").trim();
  const offeredRaw = ((formData.get("amount_offered") as string | null) ?? "").trim();
  const claimedRaw = ((formData.get("amount_claimed") as string | null) ?? "").trim();
  const nfipVal = formData.get("is_nfip");
  const is_nfip = nfipVal === "on" || nfipVal === "true";

  if (!title) fieldErrors.title = "Matter title is required.";
  if (!client_name) fieldErrors.client_name = "Client name is required.";
  if (!CLAIM_TYPES.includes(claim_type as ClaimType)) fieldErrors.claim_type = "Select a claim type.";
  if (!/^[A-Za-z]{2}$/.test(state)) fieldErrors.state = "Use a 2-letter state code.";
  if (!STATUSES.includes(status as CaseStatus)) fieldErrors.status = "Select a status.";

  const parseMoney = (raw: string, key: string): number | null => {
    if (!raw) return null;
    const n = Number(raw.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(n) || n < 0) {
      fieldErrors[key] = "Enter a valid non-negative amount.";
      return null;
    }
    return n;
  };
  const amount_offered = parseMoney(offeredRaw, "amount_offered");
  const amount_claimed = parseMoney(claimedRaw, "amount_claimed");

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    values: {
      title,
      client_name,
      claim_type: claim_type as ClaimType,
      state,
      status: status as CaseStatus,
      insurer: insurerRaw || null,
      policy_number: policyRaw || null,
      date_of_loss: dolRaw || null,
      amount_offered,
      amount_claimed,
      is_nfip,
    },
  };
}

export async function createMatter(
  _prev: MatterFormState,
  formData: FormData
): Promise<MatterFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (isDemoUser(user)) return { error: "Creating matters is disabled in the public demo." };

  const parsed = parseMatterForm(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  // org_id and created_by are filled by column defaults (default_org_id() / auth.uid());
  // org-scoped RLS (008) enforces org membership + created_by on insert.
  const insert: Database["public"]["Tables"]["cases"]["Insert"] = parsed.values;

  const { data, error } = await supabase
    .from("cases")
    .insert([insert])
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to create matter." };

  revalidatePath("/cases");
  redirect(`/cases/${(data as { id: string }).id}`);
}

export async function updateMatter(
  _prev: MatterFormState,
  formData: FormData
): Promise<MatterFormState> {
  const caseId = formData.get("case_id") as string | null;
  if (!caseId) return { error: "Missing matter id." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (isDemoUser(user)) return { error: "Editing matters is disabled in the public demo." };

  const parsed = parseMatterForm(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  const update: Database["public"]["Tables"]["cases"]["Update"] = parsed.values;

  const { error } = await supabase.from("cases").update(update).eq("id", caseId);
  if (error) return { error: error.message };

  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}

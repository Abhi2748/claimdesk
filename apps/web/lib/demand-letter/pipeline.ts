import type { SupabaseClient } from "@supabase/supabase-js";
import { ANTHROPIC_MODEL } from "@/lib/anthropic";
import { draftDemandLetterContent } from "@/lib/demand-letter/draft-letter";
import { planRetrievalQueries } from "@/lib/demand-letter/plan-retrieval";
import { retrievePassagesForLetter } from "@/lib/demand-letter/retrieve-passages";
import {
  DEMAND_LETTER_PROMPT_VERSION,
  type CaseFactsForLetter,
  type LetterPassage,
} from "@/lib/demand-letter/types";
import type { Case, Document } from "@/types/database";

export interface DraftDemandLetterResult {
  letterId: string;
  content: string;
  hadPolicyPassages: boolean;
  queryCount: number;
  passageCount: number;
  plannedQueries: string[] | null;
}

function toCaseFacts(caseRow: Case): CaseFactsForLetter {
  return {
    client_name: caseRow.client_name,
    insurer: caseRow.insurer,
    policy_number: caseRow.policy_number,
    state: caseRow.state,
    claim_type: caseRow.claim_type,
    is_nfip: caseRow.is_nfip,
    date_of_loss: caseRow.date_of_loss,
    amount_offered: caseRow.amount_offered,
    amount_claimed: caseRow.amount_claimed,
  };
}

function findReadyPolicyDocument(
  documents: Document[]
): Document | undefined {
  return documents.find(
    (d) => d.doc_type === "policy" && d.ingest_status === "ready"
  );
}

export async function runDemandLetterPipeline(
  supabase: SupabaseClient,
  caseRow: Case,
  documents: Document[],
  userId: string
): Promise<DraftDemandLetterResult> {
  const facts = toCaseFacts(caseRow);
  const policyDoc = findReadyPolicyDocument(documents);

  let queries: string[] = [];
  let passages: LetterPassage[] = [];

  if (policyDoc) {
    queries = await planRetrievalQueries(facts);
    console.log("[letter-planner] queries:", queries);
    passages = await retrievePassagesForLetter(
      supabase,
      policyDoc.id,
      queries
    );
  }

  const content = await draftDemandLetterContent(facts, passages);

  const { data: letter, error: insertError } = await supabase
    .from("letters")
    .insert({
      case_id: caseRow.id,
      created_by: userId,
      letter_type: "demand",
      content,
      model: ANTHROPIC_MODEL,
      prompt_version: DEMAND_LETTER_PROMPT_VERSION,
      planned_queries: policyDoc ? queries : null,
    })
    .select("id")
    .single();

  if (insertError || !letter) {
    throw new Error(
      `Failed to save letter: ${insertError?.message ?? "Unknown error"}`
    );
  }

  const saved = letter as { id: string };

  return {
    letterId: saved.id,
    content,
    hadPolicyPassages: passages.length > 0,
    queryCount: queries.length,
    passageCount: passages.length,
    plannedQueries: policyDoc ? queries : null,
  };
}

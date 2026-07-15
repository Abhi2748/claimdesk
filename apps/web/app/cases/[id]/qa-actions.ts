"use server";

import { analyzeCoverage, askMatterQuestion } from "@/lib/ai/client";
import { isDemoUser } from "@/lib/demo";
import { enforceDemoRateLimit } from "@/lib/demo-rate-limit";
import type { PolicyCitation } from "@/lib/qa/types";
import { verifyCitations } from "@/lib/qa/verify";
import { createClient } from "@/lib/supabase/server";
import type { AskMatterResult, RequestCoverageOpinionResult } from "./qa-types";

export async function askMatter(
  caseId: string,
  question: string
): Promise<AskMatterResult> {
  const trimmed = question.trim();
  if (!trimmed) return { ok: false, error: "Please enter a question." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  if (isDemoUser(user)) {
    const guard = await enforceDemoRateLimit(supabase);
    if (!guard.ok) return { ok: false, error: guard.message };
  }

  const { data: caseData, error: caseErr } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .single();
  if (caseErr || !caseData) {
    return { ok: false, error: "Matter not found or access denied." };
  }

  const { data: docsData, error: docsError } = await supabase
    .from("documents")
    .select("id, title")
    .eq("case_id", caseId)
    .eq("ingest_status", "ready");
  if (docsError) {
    return {
      ok: false,
      error: `Document lookup failed: ${docsError.message}`,
    };
  }

  const sourceDocuments = (docsData ?? []) as { id: string; title: string }[];
  const titleById = new Map(sourceDocuments.map((d) => [d.id, d.title]));

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: "You must be signed in." };
  }

  const aiBaseUrl = process.env.AI_BASE_URL;
  if (!aiBaseUrl) {
    return { ok: false, error: "AI service is not configured." };
  }

  try {
    const result = await askMatterQuestion(aiBaseUrl, session.access_token, {
      document_ids: sourceDocuments.map((d) => d.id),
      question: trimmed,
    });

    const mapCitation = (c: {
      id: number;
      section_label: string;
      page_start: number | null;
      page_end: number | null;
      content: string;
      similarity: number;
      document_id: string;
    }): PolicyCitation => ({
      id: c.id,
      sectionLabel: c.section_label,
      pageStart: c.page_start,
      pageEnd: c.page_end,
      content: c.content,
      similarity: c.similarity,
      documentId: c.document_id,
      documentTitle: titleById.get(c.document_id) ?? "Document",
    });

    const citations = result.citations.map(mapCitation);
    const retrievedChunks = result.retrieved_chunks.map(mapCitation);
    const verification = result.refused
      ? null
      : verifyCitations(result.answer, retrievedChunks);

    return {
      ok: true,
      answer: result.answer,
      citations,
      refused: result.refused,
      sourceDocuments,
      verification,
    };
  } catch (err) {
    console.error("Matter Q&A failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function requestCoverageOpinion(
  caseId: string,
  claimSummary: string
): Promise<RequestCoverageOpinionResult> {
  const trimmed = claimSummary.trim();
  if (!trimmed) {
    return { ok: false, error: "Please describe the claim." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  // Writes coverage_opinions + review_items — demo stays read-only.
  if (isDemoUser(user)) {
    return {
      ok: false,
      error: "Coverage analysis is disabled in the demo.",
    };
  }

  const { data: caseData, error: caseErr } = await supabase
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .single();
  if (caseErr || !caseData) {
    return { ok: false, error: "Matter not found or access denied." };
  }

  const { data: docsData, error: docsError } = await supabase
    .from("documents")
    .select("id")
    .eq("case_id", caseId)
    .eq("ingest_status", "ready");
  if (docsError) {
    return {
      ok: false,
      error: `Document lookup failed: ${docsError.message}`,
    };
  }

  const documentIds = ((docsData ?? []) as { id: string }[]).map((d) => d.id);
  if (documentIds.length === 0) {
    return {
      ok: false,
      error: "No ready documents available for coverage analysis.",
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: "You must be signed in." };
  }

  const aiBaseUrl = process.env.AI_BASE_URL;
  if (!aiBaseUrl) {
    return { ok: false, error: "AI service is not configured." };
  }

  try {
    const result = await analyzeCoverage(aiBaseUrl, session.access_token, {
      case_id: caseId,
      document_ids: documentIds,
      claim_summary: trimmed,
    });

    return { ok: true, status: result.status };
  } catch (err) {
    console.error("Coverage analysis request failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

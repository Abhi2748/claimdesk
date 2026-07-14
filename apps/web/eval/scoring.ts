import type { SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REFUSAL_MESSAGE } from "../lib/qa/constants";

const SECTION_REF_PATTERN = /([IVX]+\.[A-Z](?:\.\d+)?(?:\.[a-z])?)/gi;

export type EvalStatus = "PASS" | "FAIL" | "SEVERE";

export interface GoldenQuestion {
  id: number;
  difficulty: string;
  question: string;
  expected_answer: string;
  must_cite: string[];
  pages: number[];
  must_refuse: boolean;
  trap_notes?: string;
}

export interface GoldenFile {
  document: Record<string, unknown>;
  scoring_rules: Record<string, unknown>;
  questions: GoldenQuestion[];
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildValidSectionSet(labels: (string | null)[]): Set<string> {
  const set = new Set<string>();
  for (const label of labels) {
    if (!label) continue;
    const token = label.trim().split(/\s+/)[0]!;
    const upper = token.toUpperCase();
    set.add(upper);
    const segments = token.split(".");
    for (let i = 1; i <= segments.length; i++) {
      set.add(segments.slice(0, i).join(".").toUpperCase());
    }
  }
  return set;
}

function extractSectionRefs(answer: string): string[] {
  const refs = new Set<string>();
  for (const match of answer.matchAll(SECTION_REF_PATTERN)) {
    refs.add(match[1]!.toUpperCase());
  }
  return [...refs];
}

function answerContainsCite(answer: string, mustCite: string[]): boolean {
  if (mustCite.length === 0) return false;
  const normalized = normalizeWhitespace(answer);
  return mustCite.some((cite) => {
    const compact = cite.replace(/\s+/g, "");
    const re = new RegExp(
      `(?:Section\\s+)?${compact.replace(/\./g, "\\.")}\\b`,
      "i"
    );
    return re.test(normalized);
  });
}

function findInventedCitations(
  answer: string,
  validSections: Set<string>
): string[] {
  return extractSectionRefs(answer).filter((ref) => !validSections.has(ref));
}

export function scoreQuestion(
  q: GoldenQuestion,
  answer: string,
  validSections: Set<string>
): { status: EvalStatus; notes: string } {
  const invented = findInventedCitations(answer, validSections);
  const trimmedAnswer = answer.trim();

  if (invented.length > 0) {
    return {
      status: "SEVERE",
      notes: `Invented citation(s): ${invented.join(", ")}`,
    };
  }

  if (q.must_refuse) {
    if (trimmedAnswer === REFUSAL_MESSAGE) {
      return { status: "PASS", notes: "Correct refusal" };
    }
    return {
      status: "SEVERE",
      notes: "must_refuse question received substantive answer",
    };
  }

  if (answerContainsCite(answer, q.must_cite)) {
    return { status: "PASS", notes: `Cited ${q.must_cite.join(", ")}` };
  }

  return {
    status: "FAIL",
    notes: `Missing required cite: ${q.must_cite.join(", ")}`,
  };
}

export async function resolveDocumentId(
  supabase: SupabaseClient
): Promise<string> {
  const docId = process.env.DOC_ID;
  if (docId) {
    const { data, error } = await supabase
      .from("documents")
      .select("id, ingest_status, doc_type")
      .eq("id", docId)
      .single();
    if (error || !data) {
      throw new Error(`DOC_ID not found: ${error?.message}`);
    }
    const doc = data as { ingest_status: string };
    if (doc.ingest_status !== "ready") {
      throw new Error(
        `DOC_ID document is not ready (ingest_status=${doc.ingest_status})`
      );
    }
    return docId;
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, ingest_status, doc_type, created_at")
    .eq("doc_type", "policy")
    .eq("ingest_status", "ready")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    throw new Error(
      "No ready policy document found. Set DOC_ID or process a policy PDF."
    );
  }

  return (data[0] as { id: string }).id;
}

/**
 * Resolves the document_id for a golden file that targets a specific NFIP
 * form (e.g. F-123, F-144), via the eval/documents.json map produced by
 * scripts/ingest-golden-docs.ts. Separate from resolveDocumentId(), which
 * stays untouched and keeps gating the frozen F-122 baseline on DOC_ID.
 */
export async function resolveDocumentIdForForm(
  supabase: SupabaseClient,
  form: string
): Promise<string> {
  const mapPath = resolve(process.cwd(), "eval/documents.json");
  if (!existsSync(mapPath)) {
    throw new Error(
      `eval/documents.json not found. Run scripts/ingest-golden-docs.ts first.`
    );
  }
  const map = JSON.parse(readFileSync(mapPath, "utf-8")) as Record<
    string,
    string
  >;
  const docId = map[form];
  if (!docId) {
    throw new Error(`No document_id mapped for form "${form}" in eval/documents.json`);
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, ingest_status")
    .eq("id", docId)
    .single();
  if (error || !data) {
    throw new Error(`Mapped document for ${form} not found: ${error?.message}`);
  }
  const doc = data as { ingest_status: string };
  if (doc.ingest_status !== "ready") {
    throw new Error(
      `Mapped document for ${form} is not ready (ingest_status=${doc.ingest_status})`
    );
  }
  return docId;
}

export async function fetchValidSections(
  supabase: SupabaseClient,
  documentId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("chunks")
    .select("section_label")
    .eq("document_id", documentId);

  if (error) {
    throw new Error(`Failed to load chunk labels: ${error.message}`);
  }

  return buildValidSectionSet(
    (data ?? []).map((r) => (r as { section_label: string | null }).section_label)
  );
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

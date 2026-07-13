import type {
  PolicyCitation,
  VerificationResult,
  VerifiedCitation,
} from "@/lib/qa/types";

// Mirrors eval/scoring.ts SECTION_REF_PATTERN — keep the two in sync.
// Matches labels like III.B, III.B.8, III.B.8.a.
const SECTION_REF = /[IVX]+\.[A-Z](?:\.\d+)?(?:\.[a-z])?/i;
const MARKER = /\[([^\]]+)\]/g;
const PAGES = /pp?\.\s*(\d+)(?:\s*[-–]\s*(\d+))?/i;

function sectionPrefixes(label: string): string[] {
  const token = (label.trim().split(/\s+/)[0] ?? "").toUpperCase();
  if (!token) return [];
  const segs = token.split(".");
  const out: string[] = [];
  for (let i = 1; i <= segs.length; i++) out.push(segs.slice(0, i).join("."));
  return out;
}

function parsePages(inner: string): number[] {
  const m = inner.match(PAGES);
  if (!m) return [];
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  if (Number.isNaN(start)) return [];
  if (Number.isNaN(end) || end < start) return [start];
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

function pageOverlap(cited: number[], chunk: PolicyCitation): boolean {
  if (cited.length === 0) return true;
  if (chunk.pageStart == null) return true;
  const end = chunk.pageEnd ?? chunk.pageStart;
  return cited.some((p) => p >= chunk.pageStart! && p <= end);
}

function labelMatches(chunkLabel: string, rawLabel: string, romanLabel: string | null): boolean {
  if (romanLabel && sectionPrefixes(chunkLabel).includes(romanLabel)) return true;
  const a = chunkLabel.trim().toLowerCase();
  const b = rawLabel.trim().toLowerCase();
  return b.length > 0 && (a === b || a.startsWith(b) || b.startsWith(a));
}

/**
 * Verify each [LABEL, p.PAGE] citation in an answer against the passages that
 * were actually retrieved and shown to the model. "verified" = resolves to a
 * real retrieved passage (label prefix + page overlap) whose source text we can
 * show. Stricter than the eval's invented-citation check, so verified ⊆ valid.
 */
export function verifyCitations(
  answer: string,
  retrievedChunks: PolicyCitation[]
): VerificationResult {
  const seen = new Set<string>();
  const citations: VerifiedCitation[] = [];
  MARKER.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = MARKER.exec(answer)) !== null) {
    const marker = m[0];
    const inner = m[1]!;
    const rawLabel = (inner.split(",")[0] ?? "").trim();
    const romanLabel = (inner.match(SECTION_REF)?.[0] ?? "").toUpperCase() || null;
    const hasPage = PAGES.test(inner);
    if ((!romanLabel && !hasPage) || !rawLabel) continue; // not a citation bracket

    const pages = parsePages(inner);
    const key = `${rawLabel.toLowerCase()}|${pages.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const source = retrievedChunks.find(
      (c) => labelMatches(c.sectionLabel, rawLabel, romanLabel) && pageOverlap(pages, c)
    );
    citations.push({
      marker,
      label: romanLabel ?? rawLabel.toUpperCase(),
      pages,
      status: source ? "verified" : "unverified",
      source,
    });
  }

  const verifiedCount = citations.filter((c) => c.status === "verified").length;
  return {
    citations,
    verifiedCount,
    totalCount: citations.length,
    allVerified: citations.length > 0 && verifiedCount === citations.length,
  };
}

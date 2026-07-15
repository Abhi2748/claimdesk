import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { CoverageVerdictBadge } from "@/components/coverage-verdict-badge";
import { createClient } from "@/lib/supabase/server";
import type { CoverageFinding, CoverageFindingType, CoverageOpinion, ReviewItem } from "@/types/database";
import { ReviewItemActions } from "./review-item-actions";

const kindLabels: Record<string, string> = {
  qa_answer: "Q&A answer",
  letter: "Demand letter",
  coverage_analysis: "Coverage analysis",
};

const findingTypeStyles: Record<CoverageFindingType, string> = {
  coverage: "text-seal-deep",
  condition: "text-brass",
  exclusion: "text-flag",
};

function CoverageFindingRow({ finding }: { finding: CoverageFinding }) {
  return (
    <div className="rounded-[10px] border border-line bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${findingTypeStyles[finding.type]}`}>
          {finding.type}
        </span>
        {finding.verified && (
          <span className="font-mono text-[10px] text-ink-mute">grounding {finding.grounding_score.toFixed(2)}</span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{finding.statement}</p>
      {finding.verified ? (
        <blockquote className="mt-2 border-l-2 border-seal-ring pl-2.5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-seal-deep">
            § {finding.citation.section_label}
          </p>
          <p className="mt-1 font-serif text-xs italic leading-relaxed text-ink-soft">{finding.citation.quoted_text}</p>
        </blockquote>
      ) : (
        <p className="mt-2 rounded border border-line bg-flag-tint px-1.5 py-1 text-xs font-medium text-flag">
          § {finding.citation.section_label} ⚠ couldn&apos;t be verified against retrieved source
        </p>
      )}
    </div>
  );
}

function CoverageOpinionDetail({ opinion }: { opinion: CoverageOpinion }) {
  const unverifiedCount = opinion.findings.filter((f) => !f.verified).length;
  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <CoverageVerdictBadge verdict={opinion.verdict} />
        {unverifiedCount === 0 ? (
          <p className="text-xs font-medium text-seal">
            ✓ {opinion.findings.length}/{opinion.findings.length} citations verified · grounding{" "}
            {opinion.overall_grounding_score.toFixed(2)}
          </p>
        ) : (
          <p className="text-xs font-medium text-flag">
            ⚠ {unverifiedCount} of {opinion.findings.length} citation{unverifiedCount === 1 ? "" : "s"} couldn&apos;t be
            verified
          </p>
        )}
      </div>
      <div className="space-y-2">
        {opinion.findings.map((finding, i) => (
          <CoverageFindingRow key={i} finding={finding} />
        ))}
      </div>
    </div>
  );
}

function ReviewRow({ item, opinion }: { item: ReviewItem; opinion?: CoverageOpinion }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
          {kindLabels[item.kind] ?? item.kind}
        </span>
        {item.case_id && (
          <Link href={`/cases/${item.case_id}`} className="text-xs text-seal transition hover:text-seal-deep">
            View case →
          </Link>
        )}
      </div>
      <p className="mt-2 text-sm font-medium text-ink">{item.title}</p>
      {opinion ? (
        <>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{opinion.claim_summary}</p>
          <CoverageOpinionDetail opinion={opinion} />
        </>
      ) : (
        item.summary && (
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{item.summary}</p>
        )
      )}
    </div>
  );
}

export default async function ReviewQueuePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_items")
    .select("*")
    .order("created_at", { ascending: false });
  const items = (data ?? []) as ReviewItem[];

  const coverageRefIds = items
    .filter((i) => i.kind === "coverage_analysis" && i.ref_id)
    .map((i) => i.ref_id as string);
  const opinionsById = new Map<string, CoverageOpinion>();
  if (coverageRefIds.length > 0) {
    const { data: opinions } = await supabase
      .from("coverage_opinions")
      .select("*")
      .in("id", coverageRefIds);
    for (const o of (opinions ?? []) as CoverageOpinion[]) opinionsById.set(o.id, o);
  }

  const pending = items.filter((i) => i.status === "pending");
  const reviewed = items.filter((i) => i.status !== "pending");

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">Human-in-the-loop</p>
          <h1 className="mt-1 text-3xl text-ink">Review queue</h1>
          <p className="mt-1 text-sm text-ink-mute">
            {pending.length} awaiting review · {reviewed.length} reviewed
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-mute">Awaiting review</h2>
          {pending.length === 0 ? (
            <p className="card-surface px-6 py-8 text-center text-sm text-ink-mute">
              Nothing awaiting review. Flag an answer from a case to send it here.
            </p>
          ) : (
            <ul className="space-y-3">
              {pending.map((item) => (
                <li key={item.id} className="card-surface p-5">
                  <ReviewRow item={item} opinion={item.ref_id ? opinionsById.get(item.ref_id) : undefined} />
                  <ReviewItemActions itemId={item.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {reviewed.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-mute">Reviewed</h2>
            <ul className="space-y-3">
              {reviewed.map((item) => (
                <li key={item.id} className="card-surface p-5 opacity-80">
                  <ReviewRow item={item} opinion={item.ref_id ? opinionsById.get(item.ref_id) : undefined} />
                  <p className={"mt-2 text-xs font-medium " + (item.status === "approved" ? "text-seal" : "text-flag")}>
                    {item.status === "approved" ? "✓ Approved" : "✕ Rejected"}
                    {item.reviewed_at ? ` · ${new Date(item.reviewed_at).toLocaleString()}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

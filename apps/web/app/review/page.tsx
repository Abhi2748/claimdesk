import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import type { ReviewItem } from "@/types/database";
import { ReviewItemActions } from "./review-item-actions";

const kindLabels: Record<string, string> = {
  qa_answer: "Q&A answer",
  letter: "Demand letter",
  coverage_analysis: "Coverage analysis",
};

function ReviewRow({ item }: { item: ReviewItem }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
          {kindLabels[item.kind] ?? item.kind}
        </span>
        {item.case_id && (
          <Link href={`/cases/${item.case_id}`} className="text-xs text-seal transition hover:text-seal-deep">
            View matter →
          </Link>
        )}
      </div>
      <p className="mt-2 text-sm font-medium text-ink">{item.title}</p>
      {item.summary && (
        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{item.summary}</p>
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
              Nothing awaiting review. Flag an answer from a matter to send it here.
            </p>
          ) : (
            <ul className="space-y-3">
              {pending.map((item) => (
                <li key={item.id} className="card-surface p-5">
                  <ReviewRow item={item} />
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
                  <ReviewRow item={item} />
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

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestCoverageOpinion } from "./qa-actions";

export function CoverageOpinionPanel({
  caseId,
  readyCount,
  isDemo,
}: {
  caseId: string;
  readyCount: number;
  isDemo: boolean;
}) {
  const [claimSummary, setClaimSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const summary = claimSummary.trim();
    if (!summary || isPending || isDemo) return;
    setError(null);
    setAccepted(false);
    startTransition(async () => {
      const result = await requestCoverageOpinion(caseId, summary);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAccepted(true);
      setClaimSummary("");
    });
  }

  return (
    <section className="card-surface overflow-hidden">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-xl text-ink">Generate coverage opinion</h2>
        <p className="mt-1 text-sm text-ink-mute">
          Runs a structured coverage analysis across {readyCount} ready
          document{readyCount === 1 ? "" : "s"} — result lands in your review
          queue.
        </p>
      </div>

      <div className="space-y-4 px-6 py-4">
        {isDemo ? (
          <p className="text-sm text-ink-mute">
            Coverage analysis is disabled in the demo.
          </p>
        ) : (
          <>
            {isPending && (
              <div className="rounded-[10px] border border-dashed border-line bg-card-2 px-4 py-3">
                <p className="text-sm text-ink-mute">
                  Starting coverage analysis…
                </p>
                <div className="mt-2 flex gap-1 motion-reduce:hidden" aria-hidden>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-seal" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-seal [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-seal [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-[10px] bg-flag-tint px-3 py-2 text-sm text-flag">
                {error}
              </p>
            )}

            {accepted && !error && (
              <p className="rounded-[10px] bg-seal-tint px-3 py-2 text-sm text-seal-deep">
                Analysis started — it&apos;ll appear in your{" "}
                <Link
                  href="/review"
                  className="font-medium underline underline-offset-2 transition hover:text-seal"
                >
                  review queue
                </Link>{" "}
                in ~20 seconds.
              </p>
            )}

            {!isPending && !accepted && (
              <p className="text-sm leading-relaxed text-ink-mute">
                Describe what happened — the agent retrieves from the matter&apos;s
                policies, drafts a cited verdict, and queues it for human review.
              </p>
            )}
          </>
        )}
      </div>

      {!isDemo && (
        <form onSubmit={handleSubmit} className="border-t border-line px-6 py-4">
          <div className="flex flex-col gap-2">
            <textarea
              value={claimSummary}
              onChange={(e) => setClaimSummary(e.target.value)}
              placeholder="e.g. Rising floodwater entered the dwelling and damaged drywall and flooring on the main level."
              disabled={isPending}
              rows={4}
              className="w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm shadow-sm focus:border-seal focus:outline-none focus:ring-2 focus:ring-seal-ring disabled:opacity-50"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending || !claimSummary.trim()}
                className="rounded-[10px] bg-seal px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
              >
                {isPending ? "Starting…" : "Generate coverage opinion"}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

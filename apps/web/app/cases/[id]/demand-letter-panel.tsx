"use client";

import { useState, useTransition } from "react";
import { LetterRetrievalPlan } from "./letter-retrieval-plan";
import { draftDemandLetter, saveLetterEdits } from "./letter-actions";

export function DemandLetterPanel({
  caseId,
  initialLetterId,
  initialContent,
  initialPlannedQueries,
  isDemo = false,
}: {
  caseId: string;
  initialLetterId: string | null;
  initialContent: string | null;
  initialPlannedQueries: string[] | null;
  isDemo?: boolean;
}) {
  const [letterId, setLetterId] = useState<string | null>(initialLetterId);
  const [content, setContent] = useState(initialContent ?? "");
  const [plannedQueries, setPlannedQueries] = useState<string[] | null>(
    initialPlannedQueries
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy to clipboard");
  const [isDrafting, startDraft] = useTransition();
  const [isSaving, startSave] = useTransition();

  function handleDraft() {
    setError(null);
    setInfo(null);
    startDraft(async () => {
      const result = await draftDemandLetter(caseId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLetterId(result.letterId);
      setContent(result.content);
      setPlannedQueries(result.plannedQueries);
      if (result.hadPolicyPassages) {
        setInfo(
          `Drafted with ${result.passageCount} policy passage${result.passageCount === 1 ? "" : "s"} from ${result.queryCount} retrieval quer${result.queryCount === 1 ? "y" : "ies"}.`
        );
      } else {
        setInfo(
          "Drafted without policy passages (no ready policy document or retrieval returned nothing). Coverage analysis omitted per guardrails."
        );
      }
    });
  }

  function handleSave() {
    if (!letterId) return;
    setError(null);
    setInfo(null);
    startSave(async () => {
      const result = await saveLetterEdits(letterId, caseId, content);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setInfo("Edits saved.");
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy to clipboard"), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  const busy = isDrafting || isSaving;

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-xl text-ink">Demand letter</h2>
            <p className="mt-1 text-sm text-ink-mute">
              AI-drafted demand with policy-grounded citations when a processed
              policy is available
            </p>
          </div>
          {content && (
            <span className="inline-flex items-center rounded-full bg-pass-tint px-2.5 py-0.5 text-[11.5px] font-semibold text-pass ring-1 ring-inset ring-pass/30">
              Draft ready
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleDraft}
          disabled={busy}
          className="rounded-[10px] bg-seal px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
        >
          {isDrafting ? "Drafting letter…" : "Draft demand letter"}
        </button>
      </div>

      <div className="space-y-4 px-6 py-4">
        {isDrafting && (
          <div className="rounded-[10px] border border-dashed border-line bg-card-2 px-4 py-3">
            <p className="text-sm text-ink-mute">
              Planning retrieval, fetching policy passages, and drafting…
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

        {info && !error && (
          <p className="rounded-[10px] bg-seal-tint px-3 py-2 text-sm text-seal-deep">
            {info}
          </p>
        )}

        {content ? (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={busy}
              rows={24}
              className="w-full rounded-[10px] border border-line bg-card px-4 py-3 font-serif text-sm leading-relaxed text-ink shadow-sm focus:border-seal focus:outline-none focus:ring-2 focus:ring-seal-ring disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={busy || !content}
                className="rounded-[10px] border border-line bg-card px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-card-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring disabled:opacity-50"
              >
                {copyLabel}
              </button>
              {!isDemo && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy || !letterId}
                  className="rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save edits"}
                </button>
              )}
            </div>
            <LetterRetrievalPlan queries={plannedQueries} />
          </>
        ) : (
          !isDrafting && (
            <p className="text-sm text-ink-mute">
              No demand letter yet. Click &quot;Draft demand letter&quot; to
              generate one from this case&apos;s facts
              {initialContent === null ? " and policy, if available" : ""}.
            </p>
          )
        )}
      </div>
    </section>
  );
}

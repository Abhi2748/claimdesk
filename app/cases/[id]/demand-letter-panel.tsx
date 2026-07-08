"use client";

import { useState, useTransition } from "react";
import { LetterRetrievalPlan } from "./letter-retrieval-plan";
import { draftDemandLetter, saveLetterEdits } from "./letter-actions";

export function DemandLetterPanel({
  caseId,
  initialLetterId,
  initialContent,
  initialPlannedQueries,
}: {
  caseId: string;
  initialLetterId: string | null;
  initialContent: string | null;
  initialPlannedQueries: string[] | null;
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
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-medium text-zinc-900">Demand Letter</h2>
          <p className="mt-1 text-sm text-zinc-500">
            AI-drafted demand with policy-grounded citations when a processed
            policy is available
          </p>
        </div>
        <button
          type="button"
          onClick={handleDraft}
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isDrafting ? "Drafting letter…" : "Draft demand letter"}
        </button>
      </div>

      <div className="space-y-4 px-6 py-4">
        {isDrafting && (
          <p className="text-sm text-zinc-500">
            Planning retrieval, fetching policy passages, and drafting…
          </p>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {info && !error && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
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
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={busy || !content}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                {copyLabel}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy || !letterId}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save edits"}
              </button>
            </div>
            <LetterRetrievalPlan queries={plannedQueries} />
          </>
        ) : (
          !isDrafting && (
            <p className="text-sm text-zinc-500">
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

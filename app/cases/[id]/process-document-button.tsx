"use client";

import { useState, useTransition } from "react";
import {
  processDocument,
  reprocessDocument,
} from "./ingestion-actions";
import type { ProcessDocumentState } from "./ingestion-types";

export function ProcessDocumentButton({
  documentId,
  caseId,
  variant = "process",
}: {
  documentId: string;
  caseId: string;
  variant?: "process" | "reprocess";
}) {
  const [state, setState] = useState<ProcessDocumentState>({});
  const [isPending, startTransition] = useTransition();

  const isReprocess = variant === "reprocess";
  const action = isReprocess ? reprocessDocument : processDocument;
  const label = isReprocess ? "Re-process document" : "Process document";
  const pendingLabel = isReprocess ? "Re-processing…" : "Processing…";

  function handleClick() {
    startTransition(async () => {
      setState({});
      const result = await action(documentId, caseId);
      setState(result);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={
          isReprocess
            ? "rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
            : "rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        }
      >
        {isPending ? pendingLabel : label}
      </button>
      {state.error && (
        <span className="max-w-xs text-xs text-red-600">{state.error}</span>
      )}
      {state.success && (
        <span className="text-xs text-green-600">
          {isReprocess ? "Re-processed successfully." : "Processed successfully."}
        </span>
      )}
    </div>
  );
}

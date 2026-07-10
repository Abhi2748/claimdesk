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
            ? "rounded-[10px] border border-seal-ring bg-card px-3 py-1.5 text-xs font-semibold text-seal-deep transition hover:bg-seal-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring disabled:opacity-50"
            : "rounded-[10px] bg-seal px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring disabled:opacity-50"
        }
      >
        {isPending ? pendingLabel : label}
      </button>
      {state.error && (
        <span className="max-w-xs text-xs text-flag">{state.error}</span>
      )}
      {state.success && (
        <span className="text-xs text-pass">
          {isReprocess ? "Re-processed successfully." : "Processed successfully."}
        </span>
      )}
    </div>
  );
}

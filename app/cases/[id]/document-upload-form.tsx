"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadDocument, type UploadState } from "./actions";
import type { DocType } from "@/types/database";

const initialState: UploadState = {};

const docTypeOptions: { value: DocType; label: string }[] = [
  { value: "policy", label: "Policy" },
  { value: "denial_letter", label: "Denial Letter" },
  { value: "estimate", label: "Estimate" },
  { value: "correspondence", label: "Correspondence" },
  { value: "other", label: "Other" },
];

export function DocumentUploadForm({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(
    uploadDocument,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && formRef.current) {
      formRef.current.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="caseId" value={caseId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="doc_type"
            className="block text-sm font-medium text-ink-soft"
          >
            Document type
          </label>
          <select
            id="doc_type"
            name="doc_type"
            required
            defaultValue="policy"
            className="mt-1 block w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm shadow-sm focus:border-seal focus:outline-none focus:ring-2 focus:ring-seal-ring"
          >
            {docTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="file"
            className="block text-sm font-medium text-ink-soft"
          >
            PDF file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="application/pdf"
            required
            className="mt-1 block w-full text-sm text-ink-mute file:mr-4 file:rounded-[10px] file:border-0 file:bg-seal-tint file:px-4 file:py-2 file:text-sm file:font-semibold file:text-seal-deep hover:file:bg-seal-ring/40"
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-[10px] bg-flag-tint px-3 py-2 text-sm text-flag">
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="rounded-[10px] bg-pass-tint px-3 py-2 text-sm text-pass">
          Document uploaded successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-[10px] bg-seal px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}

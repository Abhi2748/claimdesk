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
            className="block text-sm font-medium text-zinc-700"
          >
            Document type
          </label>
          <select
            id="doc_type"
            name="doc_type"
            required
            defaultValue="policy"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="block text-sm font-medium text-zinc-700"
          >
            PDF file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="application/pdf"
            required
            className="mt-1 block w-full text-sm text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Document uploaded successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}

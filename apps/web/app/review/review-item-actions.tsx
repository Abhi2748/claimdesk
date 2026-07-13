"use client";

import { useState, useTransition } from "react";
import { setReviewStatus } from "./actions";

export function ReviewItemActions({ itemId }: { itemId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(status: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const r = await setReviewStatus(itemId, status);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => act("approved")}
        className="rounded-[10px] bg-seal px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-seal-deep disabled:opacity-50">
        Approve
      </button>
      <button type="button" disabled={pending} onClick={() => act("rejected")}
        className="rounded-[10px] border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-card-2 disabled:opacity-50">
        Reject
      </button>
      {error && <span className="text-xs text-flag">{error}</span>}
    </div>
  );
}

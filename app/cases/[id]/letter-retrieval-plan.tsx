export function LetterRetrievalPlan({
  queries,
}: {
  queries: string[] | null;
}) {
  if (!queries || queries.length === 0) {
    return null;
  }

  return (
    <details className="group rounded-lg border border-zinc-200 bg-zinc-50">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-zinc-600 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block text-[10px] text-zinc-400 transition group-open:rotate-90"
          >
            ▶
          </span>
          Retrieval plan
          <span className="font-normal text-zinc-400">
            ({queries.length} quer{queries.length === 1 ? "y" : "ies"})
          </span>
        </span>
      </summary>
      <div className="flex flex-wrap gap-1.5 border-t border-zinc-200 px-3 py-2">
        {queries.map((query) => (
          <span
            key={query}
            className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-700"
          >
            {query}
          </span>
        ))}
      </div>
    </details>
  );
}

export function LetterRetrievalPlan({
  queries,
}: {
  queries: string[] | null;
}) {
  if (!queries || queries.length === 0) {
    return null;
  }

  return (
    <details className="group rounded-[10px] border border-line bg-card-2">
      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-mute marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block text-[10px] text-ink-mute transition group-open:rotate-90 motion-reduce:transition-none"
          >
            ▶
          </span>
          What the AI looked up to write this
          <span className="font-normal normal-case text-ink-mute">
            ({queries.length} quer{queries.length === 1 ? "y" : "ies"})
          </span>
        </span>
      </summary>
      <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-3">
        {queries.map((query) => (
          <span
            key={query}
            className="rounded-full border border-brass-ring bg-brass-tint px-2.5 py-0.5 text-[11.5px] font-medium text-brass"
          >
            {query}
          </span>
        ))}
      </div>
    </details>
  );
}

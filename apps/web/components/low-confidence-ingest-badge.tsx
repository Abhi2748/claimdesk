export function LowConfidenceIngestBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full bg-brass-tint px-2.5 py-0.5 text-[11.5px] font-semibold text-brass ring-1 ring-inset ring-brass-ring"
      title="Heading detection found labels for fewer than half of chunks; citations may fall back to page numbers only."
    >
      Low-confidence indexing
    </span>
  );
}

export function LowConfidenceIngestBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
      title="Heading detection found labels for fewer than half of chunks; citations may fall back to page numbers only."
    >
      Low-confidence ingestion — citations may be page-only
    </span>
  );
}

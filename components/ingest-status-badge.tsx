import type { IngestStatus } from "@/types/database";

const ingestStatusStyles: Record<IngestStatus, string> = {
  pending: "bg-card-2 text-ink-mute ring-line",
  processing: "bg-brass-tint text-brass ring-brass-ring",
  ready: "bg-pass-tint text-pass ring-pass/30",
  failed: "bg-flag-tint text-flag ring-flag/30",
};

const ingestStatusLabels: Record<IngestStatus, string> = {
  pending: "Needs indexing",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export function IngestStatusBadge({ status }: { status: IngestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${ingestStatusStyles[status]}`}
    >
      {ingestStatusLabels[status]}
    </span>
  );
}

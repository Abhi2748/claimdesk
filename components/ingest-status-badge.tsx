import type { IngestStatus } from "@/types/database";

const ingestStatusStyles: Record<IngestStatus, string> = {
  pending: "bg-zinc-100 text-zinc-600",
  processing: "bg-blue-100 text-blue-700",
  ready: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export function IngestStatusBadge({ status }: { status: IngestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ingestStatusStyles[status]}`}
    >
      {status}
    </span>
  );
}

import type { CaseStatus } from "@/types/database";

const statusStyles: Record<CaseStatus, string> = {
  intake: "bg-card-2 text-ink-soft ring-line",
  investigation: "bg-brass-tint text-brass ring-brass-ring",
  demand: "bg-brass-tint text-brass ring-brass-ring",
  litigation: "bg-flag-tint text-flag ring-flag/30",
  resolved: "bg-pass-tint text-pass ring-pass/30",
};

const statusLabels: Record<CaseStatus, string> = {
  intake: "Intake",
  investigation: "Investigation",
  demand: "Demand",
  litigation: "Litigation",
  resolved: "Resolved",
};

export function StatusPill({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

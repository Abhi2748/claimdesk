import type { CaseStatus } from "@/types/database";

const statusStyles: Record<CaseStatus, string> = {
  intake: "bg-zinc-100 text-zinc-700",
  investigation: "bg-purple-100 text-purple-800",
  demand: "bg-yellow-100 text-yellow-800",
  litigation: "bg-red-100 text-red-800",
  resolved: "bg-green-100 text-green-800",
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

import type { ClaimType } from "@/types/database";

const claimTypeStyles: Record<ClaimType, string> = {
  flood: "bg-cyan-100 text-cyan-800",
  fire: "bg-orange-100 text-orange-800",
  water: "bg-blue-100 text-blue-800",
  wind_hail: "bg-sky-100 text-sky-800",
  denied: "bg-red-100 text-red-800",
  underpaid: "bg-amber-100 text-amber-800",
};

const claimTypeLabels: Record<ClaimType, string> = {
  flood: "Flood",
  fire: "Fire",
  water: "Water",
  wind_hail: "Wind/Hail",
  denied: "Denied",
  underpaid: "Underpaid",
};

export function ClaimTypeBadge({ type }: { type: ClaimType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${claimTypeStyles[type]}`}
    >
      {claimTypeLabels[type]}
    </span>
  );
}

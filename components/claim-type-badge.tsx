import type { ClaimType } from "@/types/database";

const claimTypeStyles: Record<ClaimType, string> = {
  flood: "bg-seal-tint text-seal-deep ring-seal-ring",
  fire: "bg-flag-tint text-flag ring-flag/30",
  water: "bg-seal-tint/70 text-seal ring-seal-ring",
  wind_hail: "bg-brass-tint text-brass ring-brass-ring",
  denied: "bg-flag-tint text-flag ring-flag/30",
  underpaid: "bg-brass-tint text-brass ring-brass-ring",
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${claimTypeStyles[type]}`}
    >
      {claimTypeLabels[type]}
    </span>
  );
}

export { claimTypeLabels };

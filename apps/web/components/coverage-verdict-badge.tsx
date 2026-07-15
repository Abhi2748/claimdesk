import type { CoverageVerdict } from "@/types/database";

const verdictStyles: Record<CoverageVerdict, string> = {
  covered: "bg-seal-tint text-seal-deep ring-seal-ring",
  excluded: "bg-flag-tint text-flag ring-flag/30",
  partial: "bg-brass-tint text-brass ring-brass-ring",
  unclear: "bg-card-2 text-ink-soft ring-line",
};

const verdictLabels: Record<CoverageVerdict, string> = {
  covered: "Covered",
  excluded: "Excluded",
  partial: "Partial",
  unclear: "Unclear",
};

export function CoverageVerdictBadge({ verdict }: { verdict: CoverageVerdict }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${verdictStyles[verdict]}`}
    >
      {verdictLabels[verdict]}
    </span>
  );
}

export { verdictLabels };

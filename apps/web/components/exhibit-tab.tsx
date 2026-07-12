"use client";

export function formatExhibitPage(
  pageStart: number | null,
  pageEnd: number | null
): string {
  if (pageStart == null) return "?";
  if (pageEnd != null && pageEnd !== pageStart) {
    return `${pageStart}-${pageEnd}`;
  }
  return String(pageStart);
}

export interface ExhibitCitation {
  sectionLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  content?: string;
}

function exhibitLabel(sectionLabel: string, pageStart: number | null, pageEnd: number | null) {
  const sectionToken = sectionLabel.split(/\s+/)[0] ?? sectionLabel;
  return `§ ${sectionToken} · p.${formatExhibitPage(pageStart, pageEnd)}`;
}

export function ExhibitTab({
  sectionLabel,
  pageStart,
  pageEnd,
  content,
  expanded,
  onToggle,
}: {
  sectionLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  content?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = exhibitLabel(sectionLabel, pageStart, pageEnd);

  return (
    <span className="inline">
      <button
        type="button"
        onClick={onToggle}
        className="exhibit-tab mx-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        aria-expanded={expanded}
      >
        {label}
      </button>
      {expanded && content && (
        <blockquote className="my-3 overflow-hidden rounded-[10px] border border-line bg-card shadow-sm">
          <div className="border-l-4 border-seal px-4 py-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-seal-deep">
              {sectionLabel} · p.{formatExhibitPage(pageStart, pageEnd)}
            </p>
            <p className="mt-2 font-serif text-sm italic leading-relaxed text-ink-soft">
              {content}
            </p>
          </div>
        </blockquote>
      )}
    </span>
  );
}

export function ExhibitTabStatic({
  sectionLabel,
  pageStart,
  pageEnd,
}: {
  sectionLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
}) {
  return (
    <span className="exhibit-tab-static">
      {exhibitLabel(sectionLabel, pageStart, pageEnd)}
    </span>
  );
}

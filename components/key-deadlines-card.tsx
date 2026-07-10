import type { DeadlineDisplay } from "@/lib/deadlines";
import { DEMO_DISCLAIMER } from "@/lib/deadlines";

const statusStyles: Record<
  DeadlineDisplay["urgency"],
  string
> = {
  urgent: "bg-flag-tint text-flag ring-flag/30",
  warning: "bg-brass-tint text-brass ring-brass-ring",
  ok: "bg-pass-tint text-pass ring-pass/30",
  pending: "bg-card-2 text-ink-mute ring-line",
};

export function KeyDeadlinesCard({
  deadline,
}: {
  deadline: DeadlineDisplay;
}) {
  return (
    <section className="card-surface overflow-hidden border-l-4 border-l-flag">
      <div className="p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl text-ink">Key deadline</h2>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusStyles[deadline.urgency]}`}
          >
            {deadline.statusLabel}
          </span>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
              Rule
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-ink">
              {deadline.description}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
              Runs from
            </dt>
            <dd className="mt-1 text-sm font-medium text-ink">
              {deadline.claimBasis}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
              Deadline
            </dt>
            <dd className="mt-1 font-mono text-sm font-medium text-ink">
              {deadline.deadlineLabel}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
              Source
            </dt>
            <dd className="mt-1 font-mono text-sm text-ink-soft">
              {deadline.source}
            </dd>
          </div>
        </dl>

        <div className="mt-5 rounded-[10px] border border-flag/20 bg-flag-tint px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-flag">
            Why it matters
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {deadline.periodLabel}
            {deadline.daysRemainingLabel !== "—" && (
              <>
                {" "}
                ·{" "}
                <span className="font-mono font-medium text-ink">
                  {deadline.daysRemainingLabel}
                </span>
              </>
            )}
          </p>
        </div>

        {deadline.showDemoDisclaimer && (
          <p className="mt-4 rounded-[10px] border border-brass-ring bg-brass-tint px-3 py-2 text-sm text-brass">
            {DEMO_DISCLAIMER}
          </p>
        )}
      </div>
    </section>
  );
}

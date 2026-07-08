import type { DeadlineDisplay } from "@/lib/deadlines";
import { DEMO_DISCLAIMER } from "@/lib/deadlines";

const statusStyles: Record<
  DeadlineDisplay["urgency"],
  string
> = {
  urgent: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  ok: "bg-green-100 text-green-800",
  pending: "bg-zinc-100 text-zinc-600",
};

export function KeyDeadlinesCard({
  deadline,
}: {
  deadline: DeadlineDisplay;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Key Deadlines
        </h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusStyles[deadline.urgency]}`}
        >
          {deadline.statusLabel}
        </span>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm text-zinc-500">Rule</dt>
          <dd className="mt-0.5 text-sm text-zinc-900">{deadline.description}</dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-500">Claim basis</dt>
          <dd className="mt-0.5 text-sm font-medium text-zinc-900">
            {deadline.claimBasis}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-500">Period</dt>
          <dd className="mt-0.5 text-sm font-medium text-zinc-900">
            {deadline.periodLabel}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-500">Deadline</dt>
          <dd className="mt-0.5 text-sm font-medium text-zinc-900">
            {deadline.deadlineLabel}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-500">Days remaining</dt>
          <dd className="mt-0.5 text-sm font-medium text-zinc-900">
            {deadline.daysRemainingLabel}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-zinc-500">Source</dt>
          <dd className="mt-0.5 text-sm text-zinc-700">
            Source: {deadline.source}
          </dd>
        </div>
      </dl>

      {deadline.showDemoDisclaimer && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {DEMO_DISCLAIMER}
        </p>
      )}
    </section>
  );
}

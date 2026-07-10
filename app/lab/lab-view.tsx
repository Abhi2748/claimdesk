"use client";

import { useMemo, useState } from "react";
import { ExhibitTabStatic } from "@/components/exhibit-tab";
import type { LabData, LabQuestionRow, LabStrategyResult } from "@/eval/lab-types";
import type { EvalStatus } from "@/eval/scoring";

const DEFAULT_QUESTION_ID = 18;

const STRATEGY_LABELS = {
  vector: "Similarity search",
  tree: "Guided reading",
  oracle_hybrid: "Best of both",
} as const;

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function StatusPill({ status }: { status: EvalStatus }) {
  const styles: Record<EvalStatus, string> = {
    PASS: "bg-pass-tint text-pass ring-pass/30",
    FAIL: "bg-card-2 text-ink-mute ring-line",
    SEVERE: "bg-flag-tint text-flag ring-flag/30",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function TrapBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-brass-tint font-bold uppercase text-brass ring-1 ring-inset ring-brass-ring ${
        compact
          ? "px-1.5 py-0.5 text-[10px] tracking-wide"
          : "px-2.5 py-0.5 text-[11.5px] tracking-wider"
      }`}
    >
      Trap
    </span>
  );
}

function CitationChips({ citations }: { citations: LabStrategyResult["citations"] }) {
  if (citations.length === 0) {
    return <p className="text-xs text-ink-mute">No citations retrieved</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {citations.map((c, i) => (
        <ExhibitTabStatic
          key={`${c.sectionLabel}-${i}`}
          sectionLabel={c.sectionLabel}
          pageStart={c.pageStart}
          pageEnd={c.pageEnd}
        />
      ))}
    </div>
  );
}

function NavigationPathHero({
  breadcrumb,
  navigationPath,
}: {
  breadcrumb: string;
  navigationPath: LabStrategyResult["navigationPath"];
}) {
  const parts = breadcrumb ? breadcrumb.split(" → ").filter(Boolean) : [];

  return (
    <div className="rounded-[14px] border-2 border-brass-ring bg-gradient-to-br from-brass-tint via-brass-tint to-card px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brass">
        Navigation path
      </p>
      {parts.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
          {parts.map((part, i) => (
            <span key={`${part}-${i}`} className="inline-flex items-center gap-2">
              {i > 0 && (
                <span className="font-mono text-sm text-brass" aria-hidden>
                  →
                </span>
              )}
              <span className="rounded-md border border-brass-ring bg-card px-2.5 py-1.5 font-mono text-sm font-semibold text-ink">
                {part}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-brass">
          No sections selected (navigator refusal)
        </p>
      )}
      {navigationPath.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-brass-ring/70 pt-4">
          {navigationPath.map((step) => (
            <li key={step.hop} className="font-mono text-xs leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">Hop {step.hop}:</span>{" "}
              {step.pickedNodeIds.length > 0
                ? step.pickedNodeIds.join(", ")
                : "—"}{" "}
              <span className="text-ink-mute">— {step.reasoning}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StrategyColumn({
  title,
  result,
  showSimilarity,
  showNavigation,
}: {
  title: string;
  result: LabStrategyResult;
  showSimilarity: boolean;
  showNavigation: boolean;
}) {
  return (
    <div className="card-surface flex min-w-0 flex-col overflow-hidden">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill status={result.status} />
          <span className="font-mono text-xs text-ink-mute">
            {result.latencyMs} ms
          </span>
          {showSimilarity && (
            <span className="font-mono text-xs text-ink-mute">
              top sim{" "}
              {result.topSimilarity != null
                ? result.topSimilarity.toFixed(3)
                : "—"}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        {showNavigation && (
          <NavigationPathHero
            breadcrumb={result.navigationBreadcrumb}
            navigationPath={result.navigationPath}
          />
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
            Answer
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {result.answer || "_(empty — API or retrieval error)_"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">
            Retrieved passages
          </p>
          <CitationChips citations={result.citations} />
        </div>

        <p className="text-xs leading-relaxed text-ink-mute">{result.notes}</p>
      </div>
    </div>
  );
}

function QuestionDetail({ question }: { question: LabQuestionRow }) {
  return (
    <div className="space-y-5">
      <div className="card-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl text-ink">Q{question.id}</h2>
          <span className="rounded-full bg-card-2 px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-mute ring-1 ring-inset ring-line">
            {question.difficulty}
          </span>
          {question.trap_notes && <TrapBadge />}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {question.question}
        </p>
        <p className="mt-2 font-mono text-xs text-ink-mute">
          Required cite:{" "}
          {question.must_refuse
            ? "must refuse"
            : question.must_cite.join(", ") || "—"}
        </p>
        {question.trap_notes && (
          <p className="mt-3 rounded-[10px] border border-brass-ring bg-brass-tint px-3 py-2.5 text-xs leading-relaxed text-brass">
            {question.trap_notes}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <StrategyColumn
          title={STRATEGY_LABELS.vector}
          result={question.vector}
          showSimilarity
          showNavigation={false}
        />
        <StrategyColumn
          title={STRATEGY_LABELS.tree}
          result={question.tree}
          showSimilarity={false}
          showNavigation
        />
      </div>
    </div>
  );
}

function Scoreboard({ data }: { data: LabData }) {
  const rows = [
    { key: "vector" as const, row: data.scoreboard.vector },
    { key: "tree" as const, row: data.scoreboard.tree },
    { key: "oracle_hybrid" as const, row: data.scoreboard.oracle_hybrid },
  ];

  return (
    <div className="card-surface overflow-hidden">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-mute">
          Scoreboard
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-card-2">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute sm:px-5">
                Strategy
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute sm:px-5">
                Answers correct
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute sm:px-5">
                Trick questions caught
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute sm:px-5">
                Made something up
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute sm:px-5">
                Speed
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ key, row }) => (
              <tr
                key={key}
                className={
                  key === "oracle_hybrid"
                    ? "bg-seal-tint/80 font-medium"
                    : undefined
                }
              >
                <td className="px-4 py-3 text-ink sm:px-5">
                  {STRATEGY_LABELS[key]}
                </td>
                <td className="px-4 py-3 text-ink-soft sm:px-5">
                  {row.passCount}/{row.totalCount} ({formatPercent(row.passRate)})
                </td>
                <td className="px-4 py-3 text-ink-soft sm:px-5">
                  {formatPercent(row.trapCatchRate)}
                </td>
                <td className="px-4 py-3 sm:px-5">
                  {row.severeCount === 0 ? (
                    <span className="font-semibold text-pass">Never</span>
                  ) : (
                    <span className="font-semibold text-flag">
                      {row.severeCount}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-ink-soft sm:px-5">
                  {row.medianLatencyMs.toLocaleString()} ms
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LabView({ data }: { data: LabData }) {
  const defaultId = useMemo(() => {
    const dramatize = data.questions.find(
      (q) => q.id === DEFAULT_QUESTION_ID
    );
    return dramatize?.id ?? data.questions[0]?.id ?? 1;
  }, [data.questions]);

  const [selectedId, setSelectedId] = useState(defaultId);
  const selected = data.questions.find((q) => q.id === selectedId);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">
          How we prove it
        </p>
        <h1 className="text-3xl text-ink">Accuracy Lab</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          Every retrieval change is tested against a graded 20-question answer
          key on a real FEMA flood policy — with deliberate traps where a wrong
          answer would lose an attorney&apos;s credibility.
        </p>
        <p className="font-mono text-xs text-ink-mute">
          {data.documentTitle} · generated{" "}
          {new Date(data.generatedAt).toLocaleString()} · doc{" "}
          <code className="rounded bg-card-2 px-1 py-0.5">{data.documentId}</code>
        </p>
      </header>

      <div className="rounded-[14px] bg-ink px-6 py-5 sm:px-8 sm:py-6">
        <h2 className="text-xl text-white">Similarity is not relevance</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
          Embedding search ranks passages by vocabulary resemblance — but legal
          questions often need a section whose wording doesn&apos;t match the
          question at all. We benchmark similarity search against guided reading
          (walking the policy&apos;s table of contents like an expert) on the
          same golden set.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-white/50">
          Guided reading pass rate is 15–16/20 across runs (LLM sampling);
          made-something-up = 0 and refusal stable across runs. Neither strategy
          alone reaches 18/20 — only &quot;Best of both&quot; does.
        </p>
      </div>

      <Scoreboard data={data} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_1fr]">
        <nav className="card-surface overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Golden questions</h2>
            <p className="mt-0.5 text-xs text-ink-mute">
              Dots: similarity · guided pass
            </p>
          </div>
          <ul className="max-h-[min(480px,50vh)] divide-y divide-line-soft overflow-y-auto lg:max-h-[520px]">
            {data.questions.map((q) => {
              const active = q.id === selectedId;
              const vectorPass = q.vector.status === "PASS";
              const treePass = q.tree.status === "PASS";
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(q.id)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-card-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-seal-ring ${
                      active ? "bg-seal-tint/60 hover:bg-seal-tint/60" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-ink">
                        Q{q.id}
                      </span>
                      {q.trap_notes && <TrapBadge compact />}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${vectorPass ? "bg-pass" : "bg-line"}`}
                        title="Similarity search"
                      />
                      <span
                        className={`h-2 w-2 rounded-full ${treePass ? "bg-pass" : "bg-line"}`}
                        title="Guided reading"
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {selected ? (
            <QuestionDetail question={selected} />
          ) : (
            <div className="card-surface border-dashed px-6 py-12 text-center">
              <p className="text-sm text-ink-mute">
                Select a question to compare strategies.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

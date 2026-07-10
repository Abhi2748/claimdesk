"use client";

import { useMemo, useState } from "react";
import type { LabData, LabQuestionRow, LabStrategyResult } from "@/eval/lab-types";
import type { EvalStatus } from "@/eval/scoring";

const DEFAULT_QUESTION_ID = 18;

function formatPage(pageStart: number | null, pageEnd: number | null): string {
  if (pageStart == null) return "?";
  if (pageEnd != null && pageEnd !== pageStart) {
    return `${pageStart}-${pageEnd}`;
  }
  return String(pageStart);
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function StatusPill({ status }: { status: EvalStatus }) {
  const styles: Record<EvalStatus, string> = {
    PASS: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/60",
    FAIL: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80",
    SEVERE: "bg-red-100 text-red-800 ring-1 ring-red-200/60",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function TrapBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-200 font-bold uppercase text-amber-950 ring-1 ring-amber-300/80 ${
        compact ? "px-1.5 py-0.5 text-[10px] tracking-wide" : "px-2.5 py-0.5 text-xs tracking-wider"
      }`}
    >
      Trap
    </span>
  );
}

function CitationChips({ citations }: { citations: LabStrategyResult["citations"] }) {
  if (citations.length === 0) {
    return <p className="text-xs text-zinc-500">No citations retrieved</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {citations.map((c, i) => (
        <span
          key={`${c.sectionLabel}-${i}`}
          className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-blue-200/60"
        >
          {c.sectionLabel.split(/\s+/)[0]} · p.
          {formatPage(c.pageStart, c.pageEnd)}
        </span>
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
    <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-amber-50 to-amber-100/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
        Navigation path
      </p>
      {parts.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
          {parts.map((part, i) => (
            <span key={`${part}-${i}`} className="inline-flex items-center gap-2">
              {i > 0 && (
                <span className="text-base font-medium text-amber-600" aria-hidden>
                  →
                </span>
              )}
              <span className="rounded-lg bg-white/80 px-2.5 py-1.5 text-sm font-semibold text-amber-950 shadow-sm ring-1 ring-amber-200/80 sm:text-base">
                {part}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-amber-900">
          No sections selected (navigator refusal)
        </p>
      )}
      {navigationPath.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-amber-300/70 pt-4">
          {navigationPath.map((step) => (
            <li key={step.hop} className="text-xs leading-relaxed text-amber-900">
              <span className="font-semibold">Hop {step.hop}:</span>{" "}
              {step.pickedNodeIds.length > 0
                ? step.pickedNodeIds.join(", ")
                : "—"}{" "}
              <span className="text-amber-800">— {step.reasoning}</span>
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
    <div className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill status={result.status} />
          <span className="text-xs text-zinc-500">{result.latencyMs} ms</span>
          {showSimilarity && (
            <span className="text-xs text-zinc-500">
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
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Answer
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {result.answer || "_(empty — API or retrieval error)_"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Retrieved passages
          </p>
          <CitationChips citations={result.citations} />
        </div>

        <p className="text-xs leading-relaxed text-zinc-500">{result.notes}</p>
      </div>
    </div>
  );
}

function QuestionDetail({ question }: { question: LabQuestionRow }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">
            Q{question.id}
          </h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200/80">
            {question.difficulty}
          </span>
          {question.trap_notes && <TrapBadge />}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-800">
          {question.question}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Required cite:{" "}
          {question.must_refuse
            ? "must refuse"
            : question.must_cite.join(", ") || "—"}
        </p>
        {question.trap_notes && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
            {question.trap_notes}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <StrategyColumn
          title="Vector (pgvector)"
          result={question.vector}
          showSimilarity
          showNavigation={false}
        />
        <StrategyColumn
          title="Tree (ToC navigation)"
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
    { key: "vector", label: "Vector", row: data.scoreboard.vector },
    { key: "tree", label: "Tree", row: data.scoreboard.tree },
    {
      key: "oracle_hybrid",
      label: "Oracle hybrid",
      row: data.scoreboard.oracle_hybrid,
    },
  ] as const;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Scoreboard
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-5">
                Strategy
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-5">
                Pass rate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-5">
                Trap catch
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-5">
                SEVERE
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-5">
                Median latency
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {rows.map(({ key, label, row }) => (
              <tr
                key={key}
                className={
                  key === "oracle_hybrid"
                    ? "bg-amber-50/90 font-medium ring-1 ring-inset ring-amber-200/60"
                    : undefined
                }
              >
                <td className="px-4 py-3 text-zinc-900 sm:px-5">{label}</td>
                <td className="px-4 py-3 text-zinc-700 sm:px-5">
                  {row.passCount}/{row.totalCount} ({formatPercent(row.passRate)})
                </td>
                <td className="px-4 py-3 text-zinc-700 sm:px-5">
                  {formatPercent(row.trapCatchRate)}
                </td>
                <td
                  className={`px-4 py-3 sm:px-5 ${
                    row.severeCount > 0
                      ? "font-semibold text-red-700"
                      : "text-zinc-700"
                  }`}
                >
                  {row.severeCount}
                </td>
                <td className="px-4 py-3 text-zinc-700 sm:px-5">
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
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Retrieval Lab
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600">
          Similarity is not relevance: benchmarking retrieval strategies on real
          insurance policies.
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-zinc-500">
          Tree pass rate is 15–16/20 across runs (LLM sampling); SEVERE=0 and
          refusal stable across runs.
        </p>
        <p className="text-xs text-zinc-500">
          {data.documentTitle} · generated{" "}
          {new Date(data.generatedAt).toLocaleString()} · doc{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">
            {data.documentId}
          </code>
        </p>
      </header>

      <Scoreboard data={data} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,260px)_1fr]">
        <nav className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Golden questions
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Green dots: vector · tree pass
            </p>
          </div>
          <ul className="max-h-[min(480px,50vh)] divide-y divide-zinc-100 overflow-y-auto lg:max-h-[520px]">
            {data.questions.map((q) => {
              const active = q.id === selectedId;
              const vectorPass = q.vector.status === "PASS";
              const treePass = q.tree.status === "PASS";
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(q.id)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-zinc-50 ${
                      active ? "bg-amber-50/80 hover:bg-amber-50/80" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-zinc-900">
                        Q{q.id}
                      </span>
                      {q.trap_notes && <TrapBadge compact />}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${vectorPass ? "bg-emerald-500" : "bg-zinc-300"}`}
                        title="Vector"
                      />
                      <span
                        className={`h-2 w-2 rounded-full ${treePass ? "bg-emerald-500" : "bg-zinc-300"}`}
                        title="Tree"
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
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
              <p className="text-sm text-zinc-500">Select a question to compare strategies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

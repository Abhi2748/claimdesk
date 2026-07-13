"use client";

import { useState, useTransition } from "react";
import { flagForReview } from "@/app/review/actions";
import type { VerificationResult, VerifiedCitation } from "@/lib/qa/types";
import { askMatter } from "./qa-actions";
import { type PolicyCitation } from "./qa-types";

interface AssistantMessage {
  role: "assistant";
  question: string;
  answer: string;
  citations: PolicyCitation[];
  refused: boolean;
  verification: VerificationResult | null;
  sourceDocuments: { id: string; title: string }[];
}
interface UserMessage { role: "user"; content: string }
type ChatMessage = UserMessage | AssistantMessage;

function pagesLabel(pages: number[]): string {
  if (pages.length === 0) return "?";
  if (pages.length === 1) return String(pages[0]);
  return `${pages[0]}-${pages[pages.length - 1]}`;
}

function TrustBar({ v, refused }: { v: VerificationResult | null; refused: boolean }) {
  if (refused) return <p className="text-xs font-medium text-seal">✓ ClaimDesk refused rather than guessing</p>;
  if (!v || v.totalCount === 0) return <p className="text-xs text-ink-mute">No citations in this answer.</p>;
  if (v.allVerified) return <p className="text-xs font-medium text-seal">✓ {v.verifiedCount}/{v.totalCount} citations verified against source</p>;
  const un = v.totalCount - v.verifiedCount;
  return <p className="text-xs font-medium text-flag">⚠ {un} of {v.totalCount} citation{un === 1 ? "" : "s"} couldn&apos;t be verified against retrieved source</p>;
}

function FlagForReviewButton({ caseId, msg }: { caseId: string; msg: AssistantMessage }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const v = msg.verification;
  const summary = (v ? `[${v.verifiedCount}/${v.totalCount} citations verified] ` : "") + msg.answer;
  function flag() {
    startTransition(async () => {
      const r = await flagForReview({ caseId, kind: "qa_answer", title: msg.question || "Policy Q&A answer", summary });
      setState(r.ok ? "done" : "error");
    });
  }
  if (state === "done") return <p className="mt-2 text-xs font-medium text-seal">✓ Sent to review queue</p>;
  return (
    <button type="button" onClick={flag} disabled={pending}
      className="mt-2 text-xs font-medium text-ink-mute underline-offset-2 transition hover:text-ink hover:underline disabled:opacity-50">
      {pending ? "Flagging…" : "Flag for review"}
      {state === "error" ? <span className="ml-2 text-flag">couldn&apos;t flag</span> : null}
    </button>
  );
}

function MatterAnswer({ msg, caseId, isDemo }: { msg: AssistantMessage; caseId: string; isDemo: boolean }) {
  const cites: VerifiedCitation[] = msg.verification?.citations ?? [];
  const multiDoc = msg.sourceDocuments.length > 1;
  const [active, setActive] = useState<number>(() => {
    const v = cites.findIndex((c) => c.status === "verified");
    return v >= 0 ? v : 0;
  });

  if (msg.refused) {
    return (
      <div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{msg.answer}</p>
        <p className="mt-3"><TrustBar v={null} refused /></p>
      </div>
    );
  }

  const byMarker = new Map<string, number>();
  cites.forEach((vc, i) => { if (!byMarker.has(vc.marker)) byMarker.set(vc.marker, i); });
  const parts = msg.answer.split(/(\[[^\]]+\])/g);

  return (
    <div className="space-y-3">
      <div className="text-sm leading-relaxed text-ink-soft">
        {parts.map((part, i) => {
          const idx = byMarker.get(part);
          if (idx !== undefined) {
            const vc = cites[idx]!;
            const verified = vc.status === "verified";
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActive(idx)}
                title={verified ? "Verified — click to view source" : "Unverified — no matching retrieved passage"}
                className={verified
                  ? "exhibit-tab mx-0.5"
                  : "mx-0.5 rounded border border-line bg-flag-tint px-1.5 py-0.5 text-xs font-medium text-flag"}
              >
                {verified ? `§ ${vc.label} · p.${pagesLabel(vc.pages)}` : `${part} ⚠`}
              </button>
            );
          }
          return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        })}
      </div>

      <TrustBar v={msg.verification} refused={false} />

      {cites.length > 0 && (
        <div className="rounded-[10px] border border-line bg-card-2">
          <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
            {cites.map((vc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={"rounded-full px-2.5 py-1 text-xs font-medium transition " +
                  (i === active ? "bg-seal text-white"
                    : vc.status === "verified" ? "bg-card text-ink-soft hover:bg-card-2"
                    : "bg-flag-tint text-flag")}
              >
                § {vc.label} {vc.status === "verified" ? "✓" : "⚠"}
              </button>
            ))}
          </div>
          <div className="px-4 py-3">
            {(() => {
              const vc = cites[active];
              if (!vc) return null;
              if (vc.status !== "verified" || !vc.source) {
                return <p className="text-sm text-flag">No retrieved passage matched <span className="font-mono">{vc.marker}</span>. This citation couldn&apos;t be verified against source text.</p>;
              }
              return (
                <blockquote>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-seal-deep">
                    {vc.source.sectionLabel} · p.{pagesLabel(vc.pages)}{multiDoc && vc.source.documentTitle ? ` · ${vc.source.documentTitle}` : ""}
                  </p>
                  <p className="mt-2 font-serif text-sm italic leading-relaxed text-ink-soft">{vc.source.content}</p>
                </blockquote>
              );
            })()}
          </div>
        </div>
      )}

      {!isDemo && <FlagForReviewButton caseId={caseId} msg={msg} />}
    </div>
  );
}

export function MatterQAPanel({ caseId, readyCount, isDemo }: { caseId: string; readyCount: number; isDemo: boolean }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || isPending) return;
    setQuestion("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    startTransition(async () => {
      const result = await askMatter(caseId, q);
      if (!result.ok) { setError(result.error); return; }
      setMessages((prev) => [...prev, {
        role: "assistant",
        question: q,
        answer: result.answer,
        citations: result.citations,
        refused: result.refused,
        verification: result.verification,
        sourceDocuments: result.sourceDocuments,
      }]);
    });
  }

  return (
    <section className="card-surface overflow-hidden">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-xl text-ink">Ask the matter</h2>
        <p className="mt-1 text-sm text-ink-mute">
          Retrieves across {readyCount} ready document{readyCount === 1 ? "" : "s"} — every answer cites the policy, or refuses.
        </p>
      </div>

      <div className="flex max-h-[32rem] flex-col gap-4 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isPending && (
          <p className="text-sm leading-relaxed text-ink-mute">
            Ask a question about this matter&apos;s documents. Each citation is verified against the retrieved source, and unverifiable ones are flagged.
          </p>
        )}
        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="ml-0 rounded-[10px] bg-card-2 px-4 py-3 sm:ml-8">
              <p className="text-sm text-ink">{msg.content}</p>
            </div>
          ) : (
            <div key={i} className="mr-0 rounded-[10px] border border-line bg-card px-4 py-3 sm:mr-8">
              <MatterAnswer msg={msg} caseId={caseId} isDemo={isDemo} />
            </div>
          )
        )}
        {isPending && (
          <div className="mr-0 rounded-[10px] border border-dashed border-line bg-card-2 px-4 py-3 sm:mr-8">
            <p className="text-sm text-ink-mute">Searching the matter and drafting answer…</p>
            <div className="mt-2 flex gap-1 motion-reduce:hidden" aria-hidden>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-seal" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-seal [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-seal [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-6 mb-2 rounded-[10px] bg-flag-tint px-3 py-2 text-sm text-flag">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-line px-6 py-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How does this policy define a flood?"
            disabled={isPending}
            className="flex-1 rounded-[10px] border border-line bg-card px-3 py-2 text-sm shadow-sm focus:border-seal focus:outline-none focus:ring-2 focus:ring-seal-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPending || !question.trim()}
            className="rounded-[10px] bg-seal px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </form>
    </section>
  );
}

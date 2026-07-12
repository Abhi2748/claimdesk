"use client";

import { useState, useTransition } from "react";
import { ExhibitTab } from "@/components/exhibit-tab";
import { askPolicy } from "./qa-actions";
import { REFUSAL_MESSAGE, type PolicyCitation } from "./qa-types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: PolicyCitation[];
}

function findCitationForLabel(
  label: string,
  citations: PolicyCitation[]
): PolicyCitation | undefined {
  const normalized = label.trim().toLowerCase();
  return citations.find((c) => {
    const section = c.sectionLabel.toLowerCase();
    const page =
      c.pageStart != null
        ? c.pageEnd != null && c.pageEnd !== c.pageStart
          ? `${c.pageStart}-${c.pageEnd}`
          : String(c.pageStart)
        : "?";
    return (
      normalized.includes(section) ||
      normalized.includes(`p.${page}`) ||
      label.includes(c.sectionLabel)
    );
  });
}

function AnswerWithCitations({
  answer,
  citations,
}: {
  answer: string;
  citations: PolicyCitation[];
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (answer === REFUSAL_MESSAGE) {
    return (
      <div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
          {answer}
        </p>
        <p className="mt-3 text-xs font-medium text-seal">
          ✓ ClaimDesk refused rather than guessing
        </p>
      </div>
    );
  }

  if (citations.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
        {answer}
      </p>
    );
  }

  const parts = answer.split(/(\[[^\]]+\])/g);

  return (
    <div className="text-sm leading-relaxed text-ink-soft">
      {parts.map((part, i) => {
        const match = part.match(/^\[(.+)\]$/);
        if (match) {
          const label = match[1]!;
          const key = `${label}-${i}`;
          const citation = findCitationForLabel(label, citations);
          if (!citation) {
            return (
              <span key={key} className="whitespace-pre-wrap">
                {part}
              </span>
            );
          }
          return (
            <ExhibitTab
              key={key}
              sectionLabel={citation.sectionLabel}
              pageStart={citation.pageStart}
              pageEnd={citation.pageEnd}
              content={citation.content}
              expanded={expandedKey === key}
              onToggle={() =>
                setExpandedKey(expandedKey === key ? null : key)
              }
            />
          );
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </div>
  );
}

export function PolicyQAPanel({
  documentId,
  caseId,
  documentTitle,
}: {
  documentId: string;
  caseId: string;
  documentTitle: string;
}) {
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
      const result = await askPolicy(documentId, caseId, q);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          citations: result.citations,
        },
      ]);
    });
  }

  return (
    <section className="card-surface overflow-hidden">
      <div className="border-b border-line px-6 py-4">
        <h2 className="text-xl text-ink">Ask the policy</h2>
        <p className="mt-1 text-sm text-ink-mute">{documentTitle}</p>
      </div>

      <div className="border-b border-line-soft bg-seal-tint px-6 py-3">
        <p className="text-sm leading-relaxed text-seal-deep">
          Grounded answers only — each reply cites the policy, or refuses if the
          policy doesn&apos;t address it.
        </p>
      </div>

      <div className="flex max-h-96 flex-col gap-4 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isPending && (
          <p className="text-sm leading-relaxed text-ink-mute">
            Ask a question about this policy. Answers cite specific sections
            and pages, or refuse when the policy doesn&apos;t address the topic.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user"
                ? "ml-0 rounded-[10px] bg-card-2 px-4 py-3 sm:ml-8"
                : "mr-0 rounded-[10px] border border-line bg-card px-4 py-3 sm:mr-8"
            }
          >
            {msg.role === "user" ? (
              <p className="text-sm text-ink">{msg.content}</p>
            ) : (
              <AnswerWithCitations
                answer={msg.content}
                citations={msg.citations ?? []}
              />
            )}
          </div>
        ))}
        {isPending && (
          <div className="mr-0 rounded-[10px] border border-dashed border-line bg-card-2 px-4 py-3 sm:mr-8">
            <p className="text-sm text-ink-mute">
              Searching policy and drafting answer…
            </p>
            <div className="mt-2 flex gap-1 motion-reduce:hidden" aria-hidden>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-seal" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-seal [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-seal [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-6 mb-2 rounded-[10px] bg-flag-tint px-3 py-2 text-sm text-flag">
          {error}
        </div>
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

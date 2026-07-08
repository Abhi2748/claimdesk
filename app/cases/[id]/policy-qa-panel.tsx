"use client";

import { useState, useTransition } from "react";
import { askPolicy } from "./qa-actions";
import { REFUSAL_MESSAGE, type PolicyCitation } from "./qa-types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: PolicyCitation[];
}

function formatPage(pageStart: number | null, pageEnd: number | null): string {
  if (pageStart == null) return "?";
  if (pageEnd != null && pageEnd !== pageStart) {
    return `${pageStart}-${pageEnd}`;
  }
  return String(pageStart);
}

function CitationChip({
  label,
  citation,
  expanded,
  onToggle,
}: {
  label: string;
  citation: PolicyCitation | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="inline">
      <button
        type="button"
        onClick={onToggle}
        className="mx-0.5 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 transition hover:bg-blue-200"
      >
        {label}
      </button>
      {expanded && citation && (
        <blockquote className="my-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-zinc-700">
          <p className="mb-1 text-xs font-medium text-blue-800">
            {citation.sectionLabel} · p.{formatPage(citation.pageStart, citation.pageEnd)}
          </p>
          <p className="whitespace-pre-wrap">{citation.content}</p>
        </blockquote>
      )}
    </span>
  );
}

function findCitationForLabel(
  label: string,
  citations: PolicyCitation[]
): PolicyCitation | undefined {
  const normalized = label.trim().toLowerCase();
  return citations.find((c) => {
    const section = c.sectionLabel.toLowerCase();
    const page = formatPage(c.pageStart, c.pageEnd);
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

  if (answer === REFUSAL_MESSAGE || citations.length === 0) {
    return <p className="whitespace-pre-wrap text-sm text-zinc-800">{answer}</p>;
  }

  const parts = answer.split(/(\[[^\]]+\])/g);

  return (
    <div className="text-sm text-zinc-800">
      {parts.map((part, i) => {
        const match = part.match(/^\[(.+)\]$/);
        if (match) {
          const label = match[1]!;
          const key = `${label}-${i}`;
          const citation = findCitationForLabel(label, citations);
          return (
            <CitationChip
              key={key}
              label={part}
              citation={citation}
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
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-6 py-4">
        <h2 className="text-lg font-medium text-zinc-900">Ask the policy</h2>
        <p className="mt-1 text-sm text-zinc-500">{documentTitle}</p>
      </div>

      <div className="flex max-h-96 flex-col gap-4 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            Ask a question about this policy. Answers cite specific sections
            and pages, or refuse when the policy doesn&apos;t address the topic.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user"
                ? "ml-8 rounded-lg bg-zinc-100 px-4 py-3"
                : "mr-8 rounded-lg border border-zinc-200 bg-white px-4 py-3"
            }
          >
            {msg.role === "user" ? (
              <p className="text-sm text-zinc-900">{msg.content}</p>
            ) : (
              <AnswerWithCitations
                answer={msg.content}
                citations={msg.citations ?? []}
              />
            )}
          </div>
        ))}
        {isPending && (
          <p className="text-sm text-zinc-500">Searching policy and drafting answer…</p>
        )}
      </div>

      {error && (
        <div className="mx-6 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-zinc-200 px-6 py-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How does this policy define a flood?"
            disabled={isPending}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPending || !question.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </form>
    </section>
  );
}

import type { Case, DeadlineRule, Document, Letter } from "@/types/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ClaimTypeBadge } from "@/components/claim-type-badge";
import { IngestStatusBadge } from "@/components/ingest-status-badge";
import { LowConfidenceIngestBadge } from "@/components/low-confidence-ingest-badge";
import { KeyDeadlinesCard } from "@/components/key-deadlines-card";
import { StatusPill } from "@/components/status-pill";
import { buildDeadlineDisplay } from "@/lib/deadlines";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { formatDateOnly } from "@/lib/utils";
import { CoverageOpinionPanel } from "./coverage-opinion-panel";
import { DocumentUploadForm } from "./document-upload-form";
import { DemandLetterPanel } from "./demand-letter-panel";
import { LetterRetrievalPlan } from "./letter-retrieval-plan";
import { MatterQAPanel } from "./matter-qa-panel";
import { ProcessDocumentButton } from "./process-document-button";

const docTypeLabels = {
  policy: "Policy",
  denial_letter: "Denial Letter",
  estimate: "Estimate",
  correspondence: "Correspondence",
  other: "Other",
} as const;

function formatDateTime(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: number | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function disputeBlock(claimed: number | null, offered: number | null) {
  const dispute = claimed != null ? claimed - (offered ?? 0) : null;
  const offeredLabel =
    offered == null || offered === 0
      ? "$0 offered (denied)"
      : `${formatCurrency(offered)} offered`;

  return {
    disputeLabel: dispute != null ? formatCurrency(dispute) : "—",
    subline: `${formatCurrency(claimed)} claimed · ${offeredLabel}`,
  };
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isDemo = isDemoUser(user);

  const { data, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();

  const caseRow = data as Case | null;

  if (caseError || !caseRow) {
    notFound();
  }

  const { data: documentsData } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: false });

  const documents = (documentsData ?? []) as Document[];
  const readyDocuments = documents.filter((d) => d.ingest_status === "ready");

  const { data: lettersData } = await supabase
    .from("letters")
    .select("id, content, created_at, planned_queries")
    .eq("case_id", id)
    .eq("letter_type", "demand")
    .order("created_at", { ascending: false });

  const letters = (lettersData ?? []) as Pick<
    Letter,
    "id" | "content" | "created_at" | "planned_queries"
  >[];

  const latestLetter = letters[0] ?? null;
  const previousLetters = letters.slice(1);

  const { data: rulesData } = await supabase.from("deadline_rules").select("*");
  const deadlineRules = (rulesData ?? []) as DeadlineRule[];
  const deadlineDisplay = buildDeadlineDisplay(caseRow, deadlineRules);
  const money = disputeBlock(caseRow.amount_claimed, caseRow.amount_offered);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <header>
          <div className="flex items-center justify-between">
            <Link
              href="/cases"
              className="text-sm text-ink-mute transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring"
            >
              ← Back to cases
            </Link>
            {!isDemo && (
              <Link
                href={`/cases/${id}/edit`}
                className="text-sm font-medium text-seal transition hover:text-seal-deep"
              >
                Edit matter
              </Link>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl text-ink">{caseRow.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ClaimTypeBadge type={caseRow.claim_type} />
                <StatusPill status={caseRow.status} />
                {caseRow.is_nfip && (
                  <span className="inline-flex items-center rounded-full bg-seal-tint px-2.5 py-0.5 text-[11.5px] font-semibold text-seal-deep ring-1 ring-inset ring-seal-ring">
                    NFIP
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 rounded-[14px] bg-ink px-5 py-4 text-left sm:text-right">
              <p className="font-mono text-2xl font-semibold text-white">
                {money.disputeLabel}
              </p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-white/55">
                Amount in dispute
              </p>
              <p className="mt-1 font-mono text-xs text-white/65">
                {money.subline}
              </p>
            </div>
          </div>
        </header>

        <div className="rounded-[14px] border border-seal-ring bg-seal-tint px-5 py-4">
          <p className="text-sm leading-relaxed text-seal-deep">
            What you can do here: ask questions about this policy or draft a
            demand letter. Every AI answer cites the exact section and page — and
            says &apos;not in the policy&apos; rather than guessing.
          </p>
        </div>

        <section className="card-surface overflow-hidden">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-xl text-ink">Case details</h2>
          </div>
          <dl className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
                Client
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {caseRow.client_name}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
                State
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {caseRow.state}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
                Insurer
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {caseRow.insurer ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
                Policy number
              </dt>
              <dd className="mt-1 font-mono text-sm font-medium text-ink">
                {caseRow.policy_number ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
                Date of loss
              </dt>
              <dd className="mt-1 font-mono text-sm font-medium text-ink">
                {formatDateOnly(caseRow.date_of_loss)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-ink-mute">
                Created
              </dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {formatDateTime(caseRow.created_at)}
              </dd>
            </div>
          </dl>
        </section>

        {deadlineDisplay && <KeyDeadlinesCard deadline={deadlineDisplay} />}

        <section className="card-surface overflow-hidden">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-xl text-ink">Documents</h2>
            <p className="mt-1 text-sm text-ink-mute">
              &apos;Ready&apos; means the document is indexed so you can ask it
              questions.
            </p>
          </div>

          <div className="border-b border-line px-6 py-4">
            {isDemo ? (
              <p className="text-sm text-ink-mute">
                Uploads are disabled in the demo.
              </p>
            ) : (
              <DocumentUploadForm caseId={id} />
            )}
          </div>

          {!documents || documents.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-ink-soft">No documents yet</p>
              <p className="mt-1 text-sm text-ink-mute">
                Upload a PDF to enable policy Q&amp;A and demand-letter drafting.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-card-2">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute">
                      Pages
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute">
                      Uploaded
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-mute">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-4 py-3 text-sm font-medium text-ink">
                        {doc.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-soft">
                        {docTypeLabels[doc.doc_type]}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <IngestStatusBadge status={doc.ingest_status} />
                          {doc.ingest_stats &&
                            doc.ingest_stats.labeled_ratio < 0.5 && (
                              <LowConfidenceIngestBadge />
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-ink-soft">
                        {doc.page_count ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-mute">
                        {formatDateTime(doc.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {!isDemo && doc.ingest_status === "pending" && (
                          <ProcessDocumentButton
                            documentId={doc.id}
                            caseId={id}
                            variant="process"
                          />
                        )}
                        {!isDemo &&
                          (doc.ingest_status === "ready" ||
                            doc.ingest_status === "failed") && (
                            <ProcessDocumentButton
                              documentId={doc.id}
                              caseId={id}
                              variant="reprocess"
                            />
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {readyDocuments.length > 0 && (
          <MatterQAPanel caseId={id} readyCount={readyDocuments.length} isDemo={isDemo} />
        )}

        {readyDocuments.length > 0 && (
          <CoverageOpinionPanel
            caseId={id}
            readyCount={readyDocuments.length}
            isDemo={isDemo}
          />
        )}

        <DemandLetterPanel
          caseId={id}
          initialLetterId={latestLetter?.id ?? null}
          initialContent={latestLetter?.content ?? null}
          initialPlannedQueries={latestLetter?.planned_queries ?? null}
          isDemo={isDemo}
        />

        {previousLetters.length > 0 && (
          <section className="card-surface overflow-hidden">
            <div className="border-b border-line px-6 py-4">
              <h2 className="text-xl text-ink">Previous drafts</h2>
              <p className="mt-1 text-sm text-ink-mute">
                Earlier demand letter versions for this case
              </p>
            </div>
            <ul className="divide-y divide-line">
              {previousLetters.map((letter) => (
                <li key={letter.id} className="space-y-2 px-6 py-4">
                  <p className="text-sm font-medium text-ink-soft">
                    {formatDateTime(letter.created_at)}
                  </p>
                  <LetterRetrievalPlan queries={letter.planned_queries} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

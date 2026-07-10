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
import { DocumentUploadForm } from "./document-upload-form";
import { DemandLetterPanel } from "./demand-letter-panel";
import { LetterRetrievalPlan } from "./letter-retrieval-plan";
import { PolicyQAPanel } from "./policy-qa-panel";
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

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <div>
          <Link
            href="/cases"
            className="text-sm text-zinc-500 transition hover:text-zinc-900"
          >
            ← Back to cases
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {caseRow.title}
            </h1>
            <ClaimTypeBadge type={caseRow.claim_type} />
            <StatusPill status={caseRow.status} />
            {caseRow.is_nfip && (
              <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-medium text-cyan-800">
                NFIP
              </span>
            )}
          </div>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Case Details
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-500">Client</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {caseRow.client_name}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">State</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {caseRow.state}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Insurer</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {caseRow.insurer ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Policy Number</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {caseRow.policy_number ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Date of Loss</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {formatDateOnly(caseRow.date_of_loss)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Amount Claimed</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {formatCurrency(caseRow.amount_claimed)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Amount Offered</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {formatCurrency(caseRow.amount_offered)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-500">Created</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {formatDateTime(caseRow.created_at)}
              </dd>
            </div>
          </dl>
        </section>

        {deadlineDisplay && <KeyDeadlinesCard deadline={deadlineDisplay} />}

        <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Documents</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Upload PDFs, then process pending documents to enable policy Q&amp;A
            </p>
          </div>

          <div className="border-b border-zinc-200 px-6 py-4">
            {isDemo ? (
              <p className="text-sm text-zinc-500">
                Uploads are disabled in the demo.
              </p>
            ) : (
              <DocumentUploadForm caseId={id} />
            )}
          </div>

          {!documents || documents.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-zinc-700">No documents yet</p>
              <p className="mt-1 text-sm text-zinc-500">
                Upload a PDF to enable policy Q&amp;A and demand-letter drafting.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Ingest Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Pages
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Uploaded
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                        {doc.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
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
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {doc.page_count ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500">
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

        {readyDocuments.map((doc) => (
          <PolicyQAPanel
            key={doc.id}
            documentId={doc.id}
            caseId={id}
            documentTitle={doc.title}
          />
        ))}

        <DemandLetterPanel
          caseId={id}
          initialLetterId={latestLetter?.id ?? null}
          initialContent={latestLetter?.content ?? null}
          initialPlannedQueries={latestLetter?.planned_queries ?? null}
          isDemo={isDemo}
        />

        {previousLetters.length > 0 && (
          <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-6 py-4">
              <h2 className="text-lg font-medium text-zinc-900">
                Previous drafts
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Earlier demand letter versions for this case
              </p>
            </div>
            <ul className="divide-y divide-zinc-200">
              {previousLetters.map((letter) => (
                <li key={letter.id} className="space-y-2 px-6 py-4">
                  <p className="text-sm font-medium text-zinc-700">
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

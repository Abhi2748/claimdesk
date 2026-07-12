import type { Case, ClaimType } from "@/types/database";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ClaimTypeBadge, claimTypeLabels } from "@/components/claim-type-badge";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

const claimBorderTint: Record<ClaimType, string> = {
  flood: "border-l-seal",
  fire: "border-l-flag",
  water: "border-l-seal/70",
  wind_hail: "border-l-brass",
  denied: "border-l-flag",
  underpaid: "border-l-brass",
};

function formatCurrency(amount: number | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function disputeBlock(claimed: number | null, offered: number | null) {
  const dispute =
    claimed != null ? claimed - (offered ?? 0) : null;
  const offeredLabel =
    offered == null || offered === 0
      ? "$0 offered (denied)"
      : `${formatCurrency(offered)} offered`;

  return {
    disputeLabel: dispute != null ? formatCurrency(dispute) : "—",
    subline: `${formatCurrency(claimed)} claimed · ${offeredLabel}`,
  };
}

export default async function CasesPage() {
  const supabase = await createClient();
  const { data: casesData, error } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });

  const cases = (casesData ?? []) as Case[];

  if (error) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-sm text-flag">Failed to load cases: {error.message}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">
            Caseload
          </p>
          <h1 className="mt-1 text-3xl text-ink">Your cases</h1>
          <p className="mt-1 text-sm text-ink-mute">
            {cases.length} {cases.length === 1 ? "case" : "cases"}
          </p>
        </header>

        <div className="rounded-[14px] border border-seal-ring bg-seal-tint px-5 py-4">
          <p className="text-sm leading-relaxed text-seal-deep">
            Each case bundles the client&apos;s policy, its key deadlines, and two
            AI tools — one that answers questions about the policy and one that
            drafts demand letters. Every AI answer is cited to a specific section
            and page.
          </p>
        </div>

        {cases.length === 0 ? (
          <div className="card-surface border-dashed px-6 py-14 text-center">
            <p className="text-sm font-medium text-ink-soft">No cases yet</p>
            <p className="mt-1 text-sm text-ink-mute">
              Seeded demo cases appear after running migrations.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {cases.map((c) => {
              const money = disputeBlock(c.amount_claimed, c.amount_offered);
              return (
                <li key={c.id}>
                  <Link
                    href={`/cases/${c.id}`}
                    className={`card-surface group flex flex-col gap-4 border-l-4 ${claimBorderTint[c.claim_type]} p-5 transition hover:border-seal-ring sm:flex-row sm:items-center sm:justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring`}
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl text-ink group-hover:text-seal-deep">
                        {c.title}
                      </h2>
                      <p className="mt-1 text-sm text-ink-mute">
                        {c.client_name} · {claimTypeLabels[c.claim_type]} ·{" "}
                        {c.state}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <ClaimTypeBadge type={c.claim_type} />
                        {c.is_nfip && (
                          <span className="inline-flex items-center rounded-full bg-seal-tint px-2.5 py-0.5 text-[11.5px] font-semibold text-seal-deep ring-1 ring-inset ring-seal-ring">
                            NFIP
                          </span>
                        )}
                        <StatusPill status={c.status} />
                      </div>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="font-mono text-2xl font-semibold text-ink">
                        {money.disputeLabel}
                      </p>
                      <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-ink-mute">
                        In dispute
                      </p>
                      <p className="mt-1 font-mono text-xs text-ink-mute">
                        {money.subline}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

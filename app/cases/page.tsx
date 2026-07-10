import type { Case } from "@/types/database";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ClaimTypeBadge } from "@/components/claim-type-badge";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

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
          <p className="text-sm text-red-600">
            Failed to load cases: {error.message}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Cases</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {cases.length} {cases.length === 1 ? "case" : "cases"}
          </p>
        </div>

        {cases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-sm font-medium text-zinc-700">No cases yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Seeded demo cases appear after running migrations.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Claim Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    State
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {cases.map((c) => (
                  <tr key={c.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {c.client_name}
                    </td>
                    <td className="px-4 py-3">
                      <ClaimTypeBadge type={c.claim_type} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {c.state}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

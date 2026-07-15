import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { Case } from "@/types/database";
import { MatterForm } from "../../matter-form";

export default async function EditMatterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (isDemoUser(user)) redirect(`/cases/${id}`);

  const { data, error } = await supabase.from("cases").select("*").eq("id", id).single();
  if (error || !data) notFound();
  const matter = data as Case;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        <header>
          <Link href={`/cases/${id}`} className="text-sm text-ink-mute transition hover:text-ink">
            ← Back to case
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">
            Edit case
          </p>
          <h1 className="mt-1 text-3xl text-ink">{matter.title}</h1>
        </header>
        <div className="card-surface p-6">
          <MatterForm mode="edit" initial={matter} />
        </div>
      </main>
    </>
  );
}

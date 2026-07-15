import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { MatterForm } from "../matter-form";

export default async function NewMatterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (isDemoUser(user)) redirect("/cases");

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        <header>
          <Link href="/cases" className="text-sm text-ink-mute transition hover:text-ink">
            ← Back to cases
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">
            Intake
          </p>
          <h1 className="mt-1 text-3xl text-ink">New case</h1>
          <p className="mt-1 text-sm text-ink-mute">
            Open a case file. You can upload the policy and start asking questions next.
          </p>
        </header>
        <div className="card-surface p-6">
          <MatterForm mode="create" />
        </div>
      </main>
    </>
  );
}

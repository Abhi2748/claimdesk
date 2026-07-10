import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { DemoBanner } from "@/components/demo-banner";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

export async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isDemo = isDemoUser(user);

  return (
    <>
      {isDemo && <DemoBanner />}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/cases" className="text-lg font-semibold text-zinc-900">
              ClaimDesk
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/cases"
                className="text-zinc-600 transition hover:text-zinc-900"
              >
                Cases
              </Link>
              <Link
                href="/lab"
                className="text-zinc-600 transition hover:text-zinc-900"
              >
                Retrieval Lab
              </Link>
            </nav>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-zinc-500 transition hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
    </>
  );
}

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

  let pendingReviews = 0;
  if (user && !isDemo) {
    const { count } = await supabase
      .from("review_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingReviews = count ?? 0;
  }

  return (
    <>
      {isDemo && <DemoBanner />}
      <header className="bg-ink">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/cases"
              className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md bg-seal font-serif text-base font-medium text-white"
                aria-hidden
              >
                §
              </span>
              <span className="font-serif text-lg font-medium text-white">
                ClaimDesk
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/cases"
                className="text-white/65 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Cases
              </Link>
              <Link
                href="/review"
                className="text-white/65 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Review{pendingReviews > 0 ? ` (${pendingReviews})` : ""}
              </Link>
              <Link
                href="/lab"
                className="text-white/65 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Accuracy Lab
              </Link>
              <Link
                href="/settings/security"
                className="text-white/65 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Security
              </Link>
            </nav>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-white/55 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
    </>
  );
}

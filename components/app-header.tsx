import Link from "next/link";
import { signOut } from "@/app/login/actions";

export function AppHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/cases" className="text-lg font-semibold text-zinc-900">
          ClaimDesk
        </Link>
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
  );
}

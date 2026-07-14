import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-seal font-serif text-lg font-medium text-white">
              §
            </span>
            <span className="font-serif text-xl font-medium text-ink">
              ClaimDesk
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-[10px] px-3 py-2 text-sm font-medium text-ink-soft transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-[10px] bg-seal px-4 py-2 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-ink px-6 py-20 sm:px-10 sm:py-28">
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h1 className="font-serif text-4xl leading-tight text-white sm:text-5xl">
              Ask the policy. Get answers with{" "}
              <span className="text-seal-tint">receipts</span>.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/65 sm:text-lg">
              ClaimDesk lets you ask questions about insurance policy documents
              and returns cited answers. When the policy doesn&apos;t support
              an answer, it refuses instead of guessing — so you can trust
              what you see.
            </p>
            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex rounded-[10px] bg-seal px-6 py-3 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Create an account
              </Link>
            </div>
          </div>
          <span
            className="pointer-events-none absolute -bottom-10 -right-4 select-none font-serif text-[14rem] leading-none text-white/[0.04] sm:text-[18rem]"
            aria-hidden
          >
            §
          </span>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-20">
          <h2 className="font-serif text-2xl text-ink sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            <li>
              <p className="text-xs font-semibold uppercase tracking-wider text-brass">
                Step 1
              </p>
              <h3 className="mt-2 text-base font-semibold text-ink">
                Upload policy docs
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Add the insurance policies for a matter so ClaimDesk can
                search the actual text.
              </p>
            </li>
            <li>
              <p className="text-xs font-semibold uppercase tracking-wider text-brass">
                Step 2
              </p>
              <h3 className="mt-2 text-base font-semibold text-ink">
                Ask a question
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Ask about coverage, exclusions, limits, or definitions in plain
                language.
              </p>
            </li>
            <li>
              <p className="text-xs font-semibold uppercase tracking-wider text-brass">
                Step 3
              </p>
              <h3 className="mt-2 text-base font-semibold text-ink">
                Get a cited answer
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Receive an answer grounded in the documents, with citations — or
                a clear refusal when the policy doesn&apos;t cover it.
              </p>
            </li>
          </ol>
        </section>
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto max-w-5xl px-6 py-6 sm:px-8">
          <p className="text-center text-xs text-ink-mute">
            © {new Date().getFullYear()} ClaimDesk
          </p>
        </div>
      </footer>
    </div>
  );
}

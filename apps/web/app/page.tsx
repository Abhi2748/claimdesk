import Link from "next/link";
import { signInAsDemo } from "@/app/login/actions";

const capabilities = [
  {
    numeral: "01",
    title: "Case workspace",
    body: "Open a case for each client — fire, water, wind, hail, hurricane, underpaid or delayed. Upload every policy, endorsement, and denial letter into one case; deadlines stay in view beside the facts.",
  },
  {
    numeral: "02",
    title: "Ask across the case",
    body: "Question every ready policy in the case at once. Answers come back with pinpoint section and page citations — so you can open the form and verify the quote before you rely on it.",
  },
  {
    numeral: "03",
    title: "Coverage opinion",
    body: "A structured read — covered, excluded, partial, or unclear — with every finding cited, machine-verified against source text, and grounding-scored. Nothing ships straight to the client: opinions land in a human review queue.",
  },
  {
    numeral: "04",
    title: "Demand letter draft",
    body: "A first draft grounded in this claim’s facts and only those policy provisions the retrieval step actually returned. If the passages don’t support coverage, the letter omits the argument and flags it for counsel.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-paper">
      <header className="border-b border-line bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-seal font-serif text-lg font-medium text-white">
              §
            </span>
            <span className="font-serif text-xl font-medium text-ink">
              ClaimDesk
            </span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-3">
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
        {/* Hero — one composition: brand, claim, proof line, CTAs */}
        <section className="relative overflow-hidden bg-ink px-6 py-24 sm:px-10 sm:py-32">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(37,102,87,0.45), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 100%, rgba(169,119,47,0.18), transparent 50%)",
            }}
            aria-hidden
          />
          <div className="relative z-10 mx-auto max-w-3xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-seal-tint/90">
              Case OS for policyholder counsel
            </p>
            <h1 className="mt-5 font-serif text-4xl leading-[1.12] text-white sm:text-5xl sm:leading-[1.1]">
              ClaimDesk
            </h1>
            <p className="mt-5 max-w-2xl font-serif text-xl leading-snug text-white/88 sm:text-2xl">
              Answers from the actual policy — with citations you can verify,
              or an honest refusal.
            </p>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
              Built for firms that fight underpaid, denied, and delayed
              property claims — fire, water, wind, hail, hurricane — not for
              chasing chatty summaries.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex rounded-[10px] bg-seal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Sign up
              </Link>
              <Link
                href="/login"
                className="inline-flex rounded-[10px] border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring"
              >
                Log in
              </Link>
              <form action={signInAsDemo}>
                <button
                  type="submit"
                  className="inline-flex px-2 py-2.5 text-sm font-medium text-seal-tint underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring"
                >
                  View the live demo
                </button>
              </form>
            </div>
          </div>
          <span
            className="pointer-events-none absolute -bottom-12 -right-2 select-none font-serif text-[15rem] leading-none text-white/[0.04] sm:text-[20rem]"
            aria-hidden
          >
            §
          </span>
        </section>

        {/* Capabilities */}
        <section className="border-b border-line bg-card">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
                What counsel can do
              </p>
              <h2 className="mt-3 font-serif text-2xl text-ink sm:text-3xl">
                From case file to cited first draft
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
                One workspace for the file — not four tools stitched together.
                Jurisdiction-aware deadline tracking sits beside every case so
                limitation periods stay visible while you work the claim.
              </p>
            </div>

            <ol className="mt-12 grid gap-0 sm:grid-cols-2">
              {capabilities.map((cap, i) => (
                <li
                  key={cap.numeral}
                  className={
                    "border-t border-line px-0 py-8 sm:px-6 sm:py-10 " +
                    (i % 2 === 0 ? "sm:border-r sm:pl-0" : "sm:pr-0") +
                    (i >= 2 ? "" : "")
                  }
                >
                  <p className="font-mono text-[11px] font-medium tracking-wider text-seal">
                    § {cap.numeral}
                  </p>
                  <h3 className="mt-3 text-lg font-medium text-ink">
                    {cap.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {cap.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Trust — the differentiator */}
        <section className="bg-paper">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
                  Why firms can trust it
                </p>
                <h2 className="mt-3 font-serif text-2xl text-ink sm:text-3xl">
                  Policy intelligence with a hard refusal contract
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-ink-soft sm:text-base">
                  ClaimDesk is not a chatbot bolted onto PDFs. Every
                  substantive claim is tied to retrieved policy text; every
                  citation is checked against that text before you see a green
                  verified mark — or an amber unverified flag. When the
                  evidence isn&apos;t there, the system returns exactly{" "}
                  <span className="font-serif italic text-ink">
                    I can&apos;t find this in the policy.
                  </span>{" "}
                  — never a confident guess.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-ink-soft sm:text-base">
                  Retrieval is measured on a{" "}
                  <span className="font-medium text-ink">
                    43-question golden set across three real NFIP policy forms
                  </span>
                  , currently{" "}
                  <span className="font-medium text-ink">41/43</span> with zero
                  severe failures. AI output is never auto-approved — coverage
                  opinions and other write-paths land in a human review queue
                  for counsel sign-off.
                </p>
                <p className="mt-6">
                  <Link
                    href="/lab"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-seal transition hover:text-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring"
                  >
                    See the public proof in Accuracy Lab
                    <span aria-hidden>→</span>
                  </Link>
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-[14px] border border-line bg-card px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                    Citation checks
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex rounded-full bg-seal px-2.5 py-1 text-xs font-medium text-white">
                        § III.A · p.3 ✓
                      </span>
                      <span className="text-sm text-ink-soft">
                        Verified against source
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex rounded-full bg-flag-tint px-2.5 py-1 text-xs font-medium text-flag">
                        [IV.Z.1] ⚠
                      </span>
                      <span className="text-sm text-ink-soft">
                        Unverified — surfaced, not hidden
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[14px] border border-seal-ring bg-seal-tint px-5 py-5">
                  <p className="font-mono text-3xl font-semibold text-seal-deep">
                    41/43
                  </p>
                  <p className="mt-1 text-sm font-medium text-seal-deep">
                    multi-document golden set · 0 severe
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-seal-deep/80">
                    Frozen F-122 control stays at 17/20, 0 severe — every
                    retrieval change must clear both gates.
                  </p>
                </div>

                <div className="rounded-[14px] border border-line bg-card px-5 py-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                    Human review
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    Coverage opinions always queue as pending. The model
                    drafts; the attorney decides.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Built for firms */}
        <section className="border-t border-line bg-card">
          <div className="mx-auto max-w-5xl px-6 py-14 sm:px-8 sm:py-16">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
                  Built for firms
                </p>
                <h2 className="mt-3 font-serif text-2xl text-ink">
                  Org workspaces, not personal sandboxes
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                  Multi-tenant org workspaces with role-based access, MFA, and
                  an audit trail — so the same trust posture that governs
                  citations also governs who can see a client file.
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-ink-soft sm:shrink-0">
                <li className="flex items-center gap-2">
                  <span className="font-mono text-seal" aria-hidden>
                    §
                  </span>
                  Org workspaces
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-mono text-seal" aria-hidden>
                    §
                  </span>
                  Role-based access
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-mono text-seal" aria-hidden>
                    §
                  </span>
                  MFA
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-mono text-seal" aria-hidden>
                    §
                  </span>
                  Audit trail
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Closing CTAs */}
        <section className="border-t border-line bg-ink">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 px-6 py-14 sm:flex-row sm:items-center sm:px-8 sm:py-16">
            <div className="max-w-md">
              <h2 className="font-serif text-2xl text-white">
                Open a case. Ask the policy.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Try the read-only live demo with fictional cases, or create an
                org workspace for your firm.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex rounded-[10px] bg-seal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                Sign up
              </Link>
              <Link
                href="/login"
                className="inline-flex rounded-[10px] border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring"
              >
                Log in
              </Link>
              <form action={signInAsDemo}>
                <button
                  type="submit"
                  className="inline-flex rounded-[10px] px-5 py-2.5 text-sm font-medium text-seal-tint transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring"
                >
                  View the live demo
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-6 sm:flex-row sm:px-8">
          <p className="text-xs text-ink-mute">
            © {new Date().getFullYear()} ClaimDesk · Not legal advice · Demo
            data is fictional; NFIP forms are public FEMA documents
          </p>
          <Link
            href="/lab"
            className="text-xs font-medium text-ink-mute transition hover:text-ink"
          >
            Accuracy Lab
          </Link>
        </div>
      </footer>
    </div>
  );
}

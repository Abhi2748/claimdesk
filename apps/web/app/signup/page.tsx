import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-ink px-8 py-10 sm:px-12 lg:px-14 lg:py-14">
        <div className="relative z-10 max-w-md">
          <Link
            href="/"
            className="mb-10 flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-seal font-serif text-lg font-medium text-white">
              §
            </span>
            <span className="font-serif text-xl font-medium text-white">
              ClaimDesk
            </span>
          </Link>

          <h1 className="text-3xl leading-snug text-white sm:text-4xl">
            Read any insurance policy. Get answers with{" "}
            <span className="text-seal-tint">receipts</span>.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            Case workspace for policyholder-side attorneys — grounded Q&amp;A,
            demand-letter drafting, and jurisdiction-aware deadlines.
          </p>

          <ul className="mt-10 space-y-4">
            <li className="flex items-start gap-3 text-sm text-white/80">
              <span className="font-mono text-seal-tint" aria-hidden>
                §
              </span>
              <span>Every answer is cited</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-white/80">
              <span className="text-seal-tint" aria-hidden>
                ✓
              </span>
              <span>It won&apos;t make things up</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-white/80">
              <span className="text-brass-tint" aria-hidden>
                ⚑
              </span>
              <span>Deadlines up front</span>
            </li>
          </ul>
        </div>

        <span
          className="pointer-events-none absolute -bottom-8 -right-4 select-none font-serif text-[12rem] leading-none text-white/[0.04] sm:text-[16rem]"
          aria-hidden
        >
          §
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center bg-paper px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="relative">
            <span className="absolute -top-3 left-4 z-10 inline-flex rounded-t-md border border-brass-ring bg-brass-tint px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brass">
              Create account
            </span>
            <div className="card-surface px-6 pb-6 pt-8">
              <SignupForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-ink px-8 py-10 sm:px-12 lg:px-14 lg:py-14">
        <div className="relative z-10 max-w-md">
          <div className="mb-10 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-seal font-serif text-lg font-medium text-white">
              §
            </span>
            <span className="font-serif text-xl font-medium text-white">
              ClaimDesk
            </span>
          </div>

          <h1 className="text-3xl leading-snug text-white sm:text-4xl">
            Check your inbox.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            We sent a confirmation link to finish setting up your account.
          </p>
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
              Almost there
            </span>
            <div className="card-surface px-6 pb-6 pt-8">
              <p className="text-sm leading-relaxed text-ink-soft">
                Check your inbox and click the confirmation link to activate
                your account. Once confirmed, you&apos;ll be taken to your
                workspace.
              </p>
              <p className="mt-6 text-center text-sm text-ink-mute">
                Already confirmed?{" "}
                <Link
                  href="/login"
                  className="font-medium text-seal hover:text-seal-deep"
                >
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

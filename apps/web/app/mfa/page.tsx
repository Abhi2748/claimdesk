"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/client";

export default function MfaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) {
        setError(listError.message);
        setLoading(false);
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (!verified) {
        setError("No verified authenticator found.");
        setLoading(false);
        return;
      }
      setFactorId(verified.id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase.auth.mfa]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        setError(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      router.push("/cases");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-paper px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-seal font-serif text-lg font-medium text-white">
            §
          </span>
          <span className="font-serif text-xl font-medium text-ink">
            ClaimDesk
          </span>
        </div>

        <div className="card-surface px-6 py-6">
          <h1 className="text-xl text-ink">Two-factor authentication</h1>
          <p className="mt-2 text-sm text-ink-mute">
            Enter the 6-digit code from your authenticator app to continue.
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-ink-mute">Loading…</p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="mfa-code"
                  className="block text-sm font-medium text-ink-soft"
                >
                  Authentication code
                </label>
                <input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 block w-full rounded-[10px] border border-line bg-card px-3 py-2 font-mono text-sm tracking-widest shadow-sm focus:border-seal focus:outline-none focus:ring-2 focus:ring-seal-ring"
                  placeholder="000000"
                />
              </div>

              {error && (
                <p className="rounded-[10px] bg-flag-tint px-3 py-2 text-sm text-flag">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !factorId || code.length !== 6}
                className="w-full rounded-[10px] bg-seal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
            </form>
          )}
        </div>

        <form action={signOut} className="mt-6 text-center">
          <button
            type="submit"
            className="text-sm text-ink-mute transition hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Enrolling = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function SecuritySettings() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setFactors([]);
      return;
    }
    setFactors(data.all ?? []);
  }, [supabase.auth.mfa]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshFactors();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshFactors]);

  async function startEnroll() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    setCode("");
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator",
      });
      if (enrollError) {
        setError(enrollError.message);
        return;
      }
      setEnrolling({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
      if (challengeError) {
        setError(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      setEnrolling(null);
      setCode("");
      setSuccess("Authenticator verified. MFA is now enabled for your account.");
      await refreshFactors();
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (!enrolling) return;
    setBusy(true);
    setError(null);
    try {
      await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
      setEnrolling(null);
      setCode("");
      await refreshFactors();
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factorId: string) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });
      if (unenrollError) {
        setError(unenrollError.message);
        return;
      }
      setSuccess("Authenticator removed.");
      await refreshFactors();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">Security</h1>
        <p className="mt-2 text-sm text-ink-mute">
          Optional authenticator app (TOTP). Once verified, you&apos;ll enter a
          code after signing in.
        </p>
      </div>

      {error && (
        <p className="rounded-[10px] bg-flag-tint px-3 py-2 text-sm text-flag">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-[10px] bg-pass-tint px-3 py-2 text-sm text-pass">
          {success}
        </p>
      )}

      <section className="card-surface p-6">
        <h2 className="text-lg text-ink">Authenticator factors</h2>
        {loading ? (
          <p className="mt-3 text-sm text-ink-mute">Loading…</p>
        ) : factors.length === 0 && !enrolling ? (
          <p className="mt-3 text-sm text-ink-mute">
            No authenticator enrolled. MFA is not required for your account.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {factors.map((factor) => (
              <li
                key={factor.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-card-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {factor.friendly_name || "Authenticator"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    {factor.factor_type.toUpperCase()} ·{" "}
                    {factor.status === "verified" ? "Verified" : "Unverified"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeFactor(factor.id)}
                  className="text-sm text-flag transition hover:text-flag/80 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {!enrolling && (
          <button
            type="button"
            disabled={busy || loading}
            onClick={startEnroll}
            className="mt-5 rounded-[10px] bg-seal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
          >
            Add authenticator
          </button>
        )}
      </section>

      {enrolling && (
        <section className="card-surface space-y-5 p-6">
          <h2 className="text-lg text-ink">Scan QR code</h2>
          <p className="text-sm text-ink-mute">
            Scan with your authenticator app, or enter the secret manually.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns a data-URI SVG */}
          <img
            src={enrolling.qrCode}
            alt="Authenticator QR code"
            className="mx-auto h-48 w-48 rounded-[10px] border border-line bg-white p-3"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-mute">
              Manual secret
            </p>
            <p className="mt-1 break-all font-mono text-sm text-ink">
              {enrolling.secret}
            </p>
          </div>

          <form onSubmit={verifyEnroll} className="space-y-4">
            <div>
              <label
                htmlFor="enroll-code"
                className="block text-sm font-medium text-ink-soft"
              >
                6-digit code
              </label>
              <input
                id="enroll-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1 block w-full max-w-xs rounded-[10px] border border-line bg-card px-3 py-2 font-mono text-sm tracking-widest shadow-sm focus:border-seal focus:outline-none focus:ring-2 focus:ring-seal-ring"
                placeholder="000000"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="rounded-[10px] bg-seal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-seal-deep disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify and enable"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={cancelEnroll}
                className="rounded-[10px] border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-card-2 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

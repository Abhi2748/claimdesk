"use client";

import { useActionState } from "react";
import { login, type AuthState } from "./actions";

const initialState: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink-soft">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 block w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm shadow-sm focus:border-seal focus:outline-none focus:ring-2 focus:ring-seal-ring"
          placeholder="you@firm.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-ink-soft"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 block w-full rounded-[10px] border border-line bg-card px-3 py-2 text-sm shadow-sm focus:border-seal focus:outline-none focus:ring-2 focus:ring-seal-ring"
        />
      </div>

      {state.error && (
        <p className="rounded-[10px] bg-flag-tint px-3 py-2 text-sm text-flag">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[10px] bg-seal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-seal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

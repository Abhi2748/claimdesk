import { LoginForm } from "./login-form";
import { signInAsDemo } from "./actions";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            ClaimDesk
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Sign in to manage your cases
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-zinc-50 px-2 text-zinc-500">or</span>
            </div>
          </div>

          <form action={signInAsDemo} className="mt-4">
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              View live demo
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-zinc-500">
            Read-only · fictional data · no signup
          </p>
        </div>
      </div>
    </div>
  );
}

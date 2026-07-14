"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { provisionOrganization } from "@/lib/org/provision";
import { createClient } from "@/lib/supabase/server";

export type SignupState = {
  error?: string;
};

async function resolveOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const orgName = (formData.get("orgName") as string)?.trim();

  if (!email || !password || !orgName) {
    return { error: "Organization name, email, and password are required." };
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?org_name=${encodeURIComponent(orgName)}`,
      data: { org_name: orgName },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("email rate limit")) {
      // Supabase built-in SMTP: ~2 confirmation emails/hour project-wide.
      // Not an app bug — wait ~1h, or disable “Confirm email” under
      // Authentication → Providers → Email for local testing.
      return {
        error:
          "Too many signup emails were sent recently (Supabase limits the built-in mailer to a few per hour). Wait about an hour and try again, or in the Supabase dashboard turn off Authentication → Providers → Email → Confirm email for local testing.",
      };
    }
    return { error: error.message };
  }

  // Email confirmation disabled in this environment — session is already live.
  if (data.session) {
    const provisioned = await provisionOrganization(supabase, orgName);
    if ("error" in provisioned) {
      return { error: provisioned.error };
    }
    redirect("/cases");
  }

  redirect("/signup/check-email");
}

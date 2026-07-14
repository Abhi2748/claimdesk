import { NextResponse } from "next/server";
import { provisionOrganization } from "@/lib/org/provision";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const orgNameParam = searchParams.get("org_name");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
  }

  const user = data.user;

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (!memberships || memberships.length === 0) {
    const orgName =
      orgNameParam ??
      (typeof user.user_metadata?.org_name === "string"
        ? user.user_metadata.org_name
        : null) ??
      "My Organization";

    const provisioned = await provisionOrganization(supabase, orgName);
    if ("error" in provisioned) {
      // User is authenticated but has no org. A "retry org setup" affordance
      // is a reasonable fast-follow if this fires in practice.
      return NextResponse.redirect(`${origin}/login?error=org_setup_failed`);
    }
  }

  return NextResponse.redirect(`${origin}/cases`);
}

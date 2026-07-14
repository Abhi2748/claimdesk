import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify, withSuffix } from "./slugify";

type CreateOrganizationRpc = {
  Args: { p_name: string; p_slug: string };
  Returns: string;
};

function isSlugCollision(error: {
  message: string;
  details?: string | null;
}): boolean {
  const blob = `${error.message}\n${error.details ?? ""}`;
  return blob.includes("organizations_slug_key");
}

/**
 * Create an org + owner membership via create_organization RPC.
 * Retries on slug unique-violations with a numeric suffix (up to 5 attempts).
 */
export async function provisionOrganization(
  supabase: SupabaseClient,
  orgName: string
): Promise<{ orgId: string } | { error: string }> {
  const base = slugify(orgName) || "organization";

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = withSuffix(base, attempt);

    // database.ts predates create_organization — cast Args/Returns inline
    // so we don't widen the whole client to `any`.
    const { data, error } = (await supabase.rpc("create_organization", {
      p_name: orgName,
      p_slug: slug,
    } as CreateOrganizationRpc["Args"])) as unknown as {
      data: CreateOrganizationRpc["Returns"] | null;
      error: { message: string; details?: string | null } | null;
    };

    if (!error && data) {
      return { orgId: data };
    }

    if (error && isSlugCollision(error)) {
      continue;
    }

    return { error: error?.message ?? "Could not create your organization." };
  }

  return {
    error: "Could not create your organization. Please try again.",
  };
}

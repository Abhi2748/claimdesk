import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEMO_MAX_CALLS = 10;
const DEMO_WINDOW_SECONDS = 3600;

async function getClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headerStore.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export type RateLimitResult = { ok: true } | { ok: false; message: string };

export async function enforceDemoRateLimit(
  supabase: SupabaseClient
): Promise<RateLimitResult> {
  const p_ip = await getClientIp();
  const { data, error } = await supabase.rpc("demo_rate_limit_check", {
    p_ip,
    p_max: DEMO_MAX_CALLS,
    p_window_seconds: DEMO_WINDOW_SECONDS,
  });

  if (error) {
    console.error("[demo-rate-limit] rpc error:", error);
    return {
      ok: false,
      message: "The demo is busy right now — please try again in a moment.",
    };
  }

  if (data === false) {
    return {
      ok: false,
      message:
        "Demo limit reached (10 AI actions per hour). Please try again later — or reach out and I'll give you a full walkthrough.",
    };
  }

  return { ok: true };
}

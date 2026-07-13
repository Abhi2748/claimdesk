/**
 * RLS enforcement proof via a REAL signed-in client (not the SQL editor).
 * A) owner can read an object under their own org's prefix.
 * B) owner CANNOT write into another org's prefix (cross-tenant isolation).
 * Run locally, then delete:
 *   pnpm --filter web exec tsx scripts/prove-storage-rls.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const email = process.env.EVAL_USER_EMAIL!;
const password = process.env.EVAL_USER_PASSWORD!;
const DEMO_ORG_ID = "d110bfd1-41f2-46e6-acd8-425286585b01";

async function main() {
  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  const { data: myDoc } = await supabase.from("documents").select("storage_path").limit(1).maybeSingle();
  const myPath = (myDoc as { storage_path: string } | null)?.storage_path;
  let readOk = false;
  if (myPath) {
    const { data, error } = await supabase.storage.from("case-documents").download(myPath);
    readOk = !error && !!data;
  }
  console.log(`A) read own-org object: ${readOk ? "OK (allowed) ✓" : "no object / denied"} (${myPath ?? "none"})`);

  const hackPath = `${DEMO_ORG_ID}/isolation-probe/x.txt`;
  const { error: writeErr } = await supabase.storage.from("case-documents").upload(hackPath, new Blob(["nope"]), { upsert: true });
  console.log(`B) write into another org prefix: ${writeErr ? "DENIED ✓ (" + writeErr.message + ")" : "ALLOWED ✗ — ISOLATION FAILURE"}`);
  if (!writeErr) await supabase.storage.from("case-documents").remove([hackPath]);
}
main().catch((e) => { console.error(e); process.exit(1); });

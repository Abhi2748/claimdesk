/**
 * ONE-TIME admin migration. Relocate legacy case-documents objects from
 * <user_id>/<case>/<file> to org-scoped <org_id>/<case>/<file>, preserving the
 * same document_id / chunks / embeddings (so the eval is unaffected), then fix
 * documents.storage_path. Uses the SERVICE ROLE key (bypasses RLS) because this
 * moves physical bytes and is an admin migration, not an RLS test.
 * Run once, locally, then delete this file. NEVER commit the key.
 *   Get the key: Supabase Dashboard → Project Settings → API → service_role.
 *   SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter web exec tsx scripts/migrate-storage-paths.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const { data: docs, error } = await admin
    .from("documents")
    .select("id, case_id, storage_path, cases!inner(org_id)");
  if (error) throw error;

  let moved = 0, skipped = 0;
  type DocRow = {
    id: string;
    case_id: string;
    storage_path: string;
    cases: { org_id: string } | { org_id: string }[];
  };
  for (const d of (docs ?? []) as DocRow[]) {
    const c = Array.isArray(d.cases) ? d.cases[0] : d.cases;
    const orgId: string = c.org_id;
    const oldPath: string = d.storage_path;
    const segs = oldPath.split("/");
    const filename = segs[segs.length - 1];
    const firstSeg = segs[0];
    const newPath = `${orgId}/${d.case_id}/${filename}`;

    if (!UUID_RE.test(firstSeg)) { console.log(`? ${d.id}: first segment "${firstSeg}" not a uuid — skipping`); skipped++; continue; }
    if (firstSeg === orgId)     { console.log(`= ${d.id}: already org-scoped (${oldPath})`); skipped++; continue; }

    const { error: moveErr } = await admin.storage.from("case-documents").move(oldPath, newPath);
    if (moveErr) { console.log(`! ${d.id}: move failed (${oldPath} -> ${newPath}): ${moveErr.message}`); skipped++; continue; }

    const { error: updErr } = await admin.from("documents").update({ storage_path: newPath }).eq("id", d.id);
    if (updErr) {
      console.log(`!! ${d.id}: moved but storage_path update failed: ${updErr.message} — rolling back move`);
      await admin.storage.from("case-documents").move(newPath, oldPath);
      skipped++; continue;
    }
    console.log(`✓ ${d.id}: ${oldPath} -> ${newPath}`); moved++;
  }
  console.log(`\nDone. Moved ${moved}, skipped ${skipped}.`);
}
main().catch((e) => { console.error(e); process.exit(1); });

import { AppHeader } from "@/components/app-header";
import { loadLabData } from "@/lib/lab/load-lab-data";
import { LabView } from "./lab-view";

export default function LabPage() {
  const data = loadLabData();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        {!data ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Retrieval Lab
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
              No lab data yet. Run the exporter to benchmark vector vs tree
              retrieval on the golden question set.
            </p>
            <code className="mt-6 inline-block rounded-lg bg-zinc-100 px-4 py-2.5 text-sm text-zinc-800">
              npm run export-lab
            </code>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Requires DOC_ID, eval credentials, and API keys in{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5">.env.local</code>
            </p>
          </div>
        ) : (
          <LabView data={data} />
        )}
      </main>
    </>
  );
}

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
          <div className="card-surface border-dashed px-6 py-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-mute">
              How we prove it
            </p>
            <h1 className="mt-2 text-3xl text-ink">Accuracy Lab</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              No lab data yet. Run the exporter to benchmark similarity search
              vs guided reading on the golden question set.
            </p>
            <code className="mt-6 inline-block rounded-[10px] bg-card-2 px-4 py-2.5 font-mono text-sm text-ink">
              npm run export-lab
            </code>
            <p className="mt-4 text-xs leading-relaxed text-ink-mute">
              Requires DOC_ID, eval credentials, and API keys in{" "}
              <code className="rounded bg-card-2 px-1 py-0.5 font-mono">
                .env.local
              </code>
            </p>
          </div>
        ) : (
          <LabView data={data} />
        )}
      </main>
    </>
  );
}

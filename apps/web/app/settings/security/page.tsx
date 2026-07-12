import { AppHeader } from "@/components/app-header";
import { SecuritySettings } from "./security-settings";

export default function SecurityPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <SecuritySettings />
      </main>
    </>
  );
}

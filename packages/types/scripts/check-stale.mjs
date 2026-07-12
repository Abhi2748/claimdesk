import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const typesRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(typesRoot, "../..");

try {
  execSync("git diff --exit-code -- apps/ai/openapi.json packages/types/src/api.ts", {
    cwd: repoRoot,
    stdio: "inherit",
  });
} catch {
  console.error(
    "\nContract types are stale — run `pnpm gen:types` and commit the result.\n"
  );
  process.exit(1);
}

import { execSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePython } from "./resolve-python.mjs";

const typesRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(typesRoot, "../..");
const aiRoot = resolve(repoRoot, "apps", "ai");

const python = resolvePython(aiRoot);

const dump = spawnSync(python, ["scripts/dump_openapi.py"], {
  cwd: aiRoot,
  stdio: "inherit",
});
if (dump.status !== 0) {
  process.exit(dump.status ?? 1);
}

execSync("openapi-typescript ../../apps/ai/openapi.json -o ./src/api.ts", {
  cwd: typesRoot,
  stdio: "inherit",
});

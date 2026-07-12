import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const typesRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(typesRoot, "../..");
const aiRoot = resolve(repoRoot, "apps", "ai");

const venvPython =
  process.platform === "win32"
    ? join(aiRoot, ".venv", "Scripts", "python.exe")
    : join(aiRoot, ".venv", "bin", "python");

const python = existsSync(venvPython) ? venvPython : "python";

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

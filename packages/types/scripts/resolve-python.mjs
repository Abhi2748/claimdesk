import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve a Python interpreter for OpenAPI generation.
 * Prefers apps/ai/.venv, then python3/python on PATH.
 */
export function resolvePython(aiRoot) {
  const venvPython =
    process.platform === "win32"
      ? join(aiRoot, ".venv", "Scripts", "python.exe")
      : join(aiRoot, ".venv", "bin", "python");

  const candidates = [venvPython, "python3", "python"];

  for (const candidate of candidates) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (existsSync(candidate)) {
        return candidate;
      }
      continue;
    }

    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (probe.status === 0) {
      return candidate;
    }
  }

  throw new Error(
    "Python interpreter not found. Create apps/ai/.venv or install python3 on PATH."
  );
}

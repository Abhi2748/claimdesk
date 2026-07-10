import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { LabData } from "@/eval/lab-types";

export function loadLabData(): LabData | null {
  const path = resolve(process.cwd(), "eval/lab-data.json");
  if (!existsSync(path)) {
    return null;
  }
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as LabData;
}

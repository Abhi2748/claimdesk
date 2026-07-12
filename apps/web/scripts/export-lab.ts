import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "../eval/env";
import type {
  LabData,
  LabQuestionRow,
  LabScoreboardRow,
  LabStrategyResult,
} from "../eval/lab-types";
import {
  fetchValidSections,
  median,
  resolveDocumentId,
  scoreQuestion,
  type EvalStatus,
  type GoldenFile,
  type GoldenQuestion,
} from "../eval/scoring";
import { answerPolicyQuestion } from "../lib/qa/pipeline";
import type { NavStep, PolicyCitation, PolicyQAResult } from "../lib/qa/types";
import { answerPolicyQuestionTree } from "../lib/tree/navigate";
import type { TocNode, TocTree } from "../types/toc";

loadEnvLocal();

const DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function indexNodes(
  nodes: TocNode[],
  map = new Map<string, TocNode>()
): Map<string, TocNode> {
  for (const node of nodes) {
    map.set(node.nodeId, node);
    indexNodes(node.nodes, map);
  }
  return map;
}

function navigationBreadcrumb(
  path: NavStep[],
  nodeIndex: Map<string, TocNode>
): string {
  const parts: string[] = [];
  for (const step of path) {
    const pick = step.pickedNodeIds[0];
    if (!pick) continue;
    const node = nodeIndex.get(pick);
    if (node) {
      parts.push(node.sectionLabel ?? node.title);
    }
  }
  return parts.join(" → ");
}

function toLabCitations(citations: PolicyCitation[]) {
  return citations.map((c) => ({
    sectionLabel: c.sectionLabel,
    pageStart: c.pageStart,
    pageEnd: c.pageEnd,
  }));
}

function resultFromRun(
  q: GoldenQuestion,
  validSections: Set<string>,
  latencyMs: number,
  result: PolicyQAResult | null,
  error: string | null,
  nodeIndex: Map<string, TocNode>,
  isTree: boolean
): LabStrategyResult {
  if (error || !result) {
    return {
      answer: "",
      refused: true,
      status: "FAIL",
      notes: error ?? "Unknown error",
      latencyMs,
      topSimilarity: null,
      navigationPath: [],
      navigationBreadcrumb: "",
      citations: [],
    };
  }

  const { status, notes } = scoreQuestion(q, result.answer, validSections);
  const path = result.navigationPath ?? [];

  return {
    answer: result.answer,
    refused: result.refused,
    status,
    notes,
    latencyMs,
    topSimilarity: isTree ? null : result.topSimilarity,
    navigationPath: path,
    navigationBreadcrumb: isTree ? navigationBreadcrumb(path, nodeIndex) : "",
    citations: toLabCitations(result.retrievedChunks),
  };
}

function oracleStatus(vector: EvalStatus, tree: EvalStatus): EvalStatus {
  if (vector === "PASS" || tree === "PASS") return "PASS";
  if (vector === "SEVERE" || tree === "SEVERE") return "SEVERE";
  return "FAIL";
}

function computeScoreboardRow(
  statuses: EvalStatus[],
  latencies: number[],
  trapStatuses: EvalStatus[]
): LabScoreboardRow {
  const totalCount = statuses.length;
  const passCount = statuses.filter((s) => s === "PASS").length;
  const severeCount = statuses.filter((s) => s === "SEVERE").length;
  const trapPass = trapStatuses.filter((s) => s === "PASS").length;

  return {
    passRate: totalCount === 0 ? 0 : passCount / totalCount,
    trapCatchRate:
      trapStatuses.length === 0 ? 0 : trapPass / trapStatuses.length,
    severeCount,
    medianLatencyMs: median(latencies),
    passCount,
    totalCount,
  };
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = requireEnv("EVAL_USER_EMAIL");
  const password = requireEnv("EVAL_USER_PASSWORD");

  const supabase = createClient(url, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) {
    throw new Error(`Sign-in failed: ${authError.message}`);
  }

  const documentId = await resolveDocumentId(supabase);
  const validSections = await fetchValidSections(supabase, documentId);

  const { data: docMeta } = await supabase
    .from("documents")
    .select("title, toc_tree")
    .eq("id", documentId)
    .single();

  const doc = docMeta as { title: string; toc_tree: TocTree | null } | null;
  const nodeIndex =
    doc?.toc_tree?.nodes != null
      ? indexNodes(doc.toc_tree.nodes)
      : new Map<string, TocNode>();

  const goldenPath = resolve(process.cwd(), "eval/golden.json");
  const golden = JSON.parse(readFileSync(goldenPath, "utf-8")) as GoldenFile;
  const documentTitle =
    (golden.document.title as string | undefined) ?? doc?.title ?? "Policy";

  console.log(
    `Exporting lab data for ${golden.questions.length} questions (vector + tree) — doc ${documentId}\n`
  );

  const questions: LabQuestionRow[] = [];
  const vectorStatuses: EvalStatus[] = [];
  const treeStatuses: EvalStatus[] = [];
  const oracleStatuses: EvalStatus[] = [];
  const vectorLatencies: number[] = [];
  const treeLatencies: number[] = [];
  const oracleLatencies: number[] = [];
  const vectorTrapStatuses: EvalStatus[] = [];
  const treeTrapStatuses: EvalStatus[] = [];
  const oracleTrapStatuses: EvalStatus[] = [];

  for (let i = 0; i < golden.questions.length; i++) {
    const q = golden.questions[i]!;
    console.log(`Q${q.id}…`);

    const vectorStart = Date.now();
    let vectorResult: PolicyQAResult | null = null;
    let vectorError: string | null = null;
    try {
      vectorResult = await answerPolicyQuestion(
        supabase,
        documentId,
        q.question
      );
    } catch (err) {
      vectorError = err instanceof Error ? err.message : "Unknown error";
    }
    const vectorLatency = Date.now() - vectorStart;
    const vector = resultFromRun(
      q,
      validSections,
      vectorLatency,
      vectorResult,
      vectorError,
      nodeIndex,
      false
    );

    const treeStart = Date.now();
    let treeResult: PolicyQAResult | null = null;
    let treeError: string | null = null;
    try {
      treeResult = await answerPolicyQuestionTree(
        supabase,
        documentId,
        q.question
      );
    } catch (err) {
      treeError = err instanceof Error ? err.message : "Unknown error";
    }
    const treeLatency = Date.now() - treeStart;
    const tree = resultFromRun(
      q,
      validSections,
      treeLatency,
      treeResult,
      treeError,
      nodeIndex,
      true
    );

    vectorStatuses.push(vector.status);
    treeStatuses.push(tree.status);
    vectorLatencies.push(vectorLatency);
    treeLatencies.push(treeLatency);

    const hybrid = oracleStatus(vector.status, tree.status);
    oracleStatuses.push(hybrid);
    oracleLatencies.push(Math.max(vectorLatency, treeLatency));

    if (q.trap_notes) {
      vectorTrapStatuses.push(vector.status);
      treeTrapStatuses.push(tree.status);
      oracleTrapStatuses.push(hybrid);
    }

    questions.push({
      id: q.id,
      difficulty: q.difficulty,
      question: q.question,
      trap_notes: q.trap_notes,
      must_cite: q.must_cite,
      must_refuse: q.must_refuse,
      vector,
      tree,
    });

    if (i < golden.questions.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const labData: LabData = {
    generatedAt: new Date().toISOString(),
    documentId,
    documentTitle,
    questions,
    scoreboard: {
      vector: computeScoreboardRow(
        vectorStatuses,
        vectorLatencies,
        vectorTrapStatuses
      ),
      tree: computeScoreboardRow(treeStatuses, treeLatencies, treeTrapStatuses),
      oracle_hybrid: computeScoreboardRow(
        oracleStatuses,
        oracleLatencies,
        oracleTrapStatuses
      ),
    },
  };

  const outPath = resolve(process.cwd(), "eval/lab-data.json");
  writeFileSync(outPath, JSON.stringify(labData, null, 2), "utf-8");

  console.log(`\nWrote ${outPath}`);
  console.log(
    `Vector: ${labData.scoreboard.vector.passCount}/${labData.scoreboard.vector.totalCount} PASS`
  );
  console.log(
    `Tree: ${labData.scoreboard.tree.passCount}/${labData.scoreboard.tree.totalCount} PASS`
  );
  console.log(
    `Oracle hybrid: ${labData.scoreboard.oracle_hybrid.passCount}/${labData.scoreboard.oracle_hybrid.totalCount} PASS`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

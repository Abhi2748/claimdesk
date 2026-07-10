import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ANTHROPIC_MODEL,
  generatePolicyAnswerFromPassages,
} from "@/lib/anthropic";
import { REFUSAL_MESSAGE } from "@/lib/qa/constants";
import type { NavStep, PolicyCitation, PolicyQAResult } from "@/lib/qa/types";
import {
  TREE_MAX_HOPS,
  TREE_MAX_PASSAGES,
  TREE_MAX_SECTIONS,
} from "@/lib/retrieval-config";
import type { Chunk } from "@/types/database";
import type { TocNode, TocTree } from "@/types/toc";

const NAV_SYSTEM_PROMPT = `You are navigating a document table-of-contents to find sections that might answer an insurance policy question.

You will receive the question and a list of candidate sections (nodeId, sectionLabel, title, summary only — not full text).

Return ONLY valid JSON matching this schema (no prose, no markdown fences):
{ "picks": string[], "done": boolean, "reasoning": string }

Rules:
- picks: the 0–2 nodeIds from the candidate list most likely to CONTAIN the answer.
- CRITICAL: If NONE of these sections could plausibly contain the answer, return picks: [] — do not guess. It is correct to select nothing.
- Prefer the MOST SPECIFIC section that directly answers the question. If a candidate node has children, do NOT stop there unless the node's own summary fully answers the question — descend into the child whose summary best matches. Only select a parent node when the answer genuinely spans several of its children.
- done: true only when the picked section(s) are specific enough to answer — typically leaf-level sections whose summaries directly cover the topic. Set done: false if you are pointing at a parent and the answer likely lives in a more specific child.
- reasoning: one brief sentence explaining your choice.`;

interface NavigatorResponse {
  picks: string[];
  done: boolean;
  reasoning: string;
}

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function stripMarkdownFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  }
  return text.trim();
}

function indexNodes(nodes: TocNode[], map = new Map<string, TocNode>()): Map<string, TocNode> {
  for (const node of nodes) {
    map.set(node.nodeId, node);
    indexNodes(node.nodes, map);
  }
  return map;
}

function formatFrontier(nodes: TocNode[]): string {
  return nodes
    .map((n) => {
      const label = n.sectionLabel ?? "(none)";
      return `- ${n.nodeId} | ${label} | ${n.title} | ${n.summary}`;
    })
    .join("\n");
}

function isLeaf(node: TocNode): boolean {
  return node.nodes.length === 0;
}

function treeRefusal(navigationPath: NavStep[]): PolicyQAResult {
  return {
    answer: REFUSAL_MESSAGE,
    citations: [],
    retrievedChunks: [],
    refused: true,
    topSimilarity: null,
    strategy: "tree",
    navigationPath,
  };
}

async function navigateTree(
  question: string,
  topLevelNodes: TocNode[],
  nodeIndex: Map<string, TocNode>
): Promise<{ selected: TocNode[]; navigationPath: NavStep[] }> {
  const navigationPath: NavStep[] = [];
  let frontier = topLevelNodes;
  let lastPicked: TocNode[] = [];

  for (let hop = 1; hop <= TREE_MAX_HOPS; hop++) {
    if (frontier.length === 0) {
      break;
    }

    const consideredNodeIds = frontier.map((n) => n.nodeId);
    const anthropic = getAnthropic();

    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: NAV_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\n\nCandidate sections:\n${formatFrontier(frontier)}`,
        },
      ],
    });

    const block = message.content.find((b) => b.type === "text");
    const rawText = block?.type === "text" ? block.text : "";

    let picks: string[] = [];
    let done = false;
    let reasoning = "";

    try {
      const parsed = JSON.parse(stripMarkdownFences(rawText)) as NavigatorResponse;
      picks = Array.isArray(parsed.picks)
        ? parsed.picks.filter((id): id is string => typeof id === "string")
        : [];
      done = Boolean(parsed.done);
      reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
    } catch {
      picks = [];
      done = false;
      reasoning = "Failed to parse navigator response.";
    }

    navigationPath.push({
      hop,
      consideredNodeIds,
      pickedNodeIds: picks,
      reasoning,
    });

    if (picks.length === 0) {
      return { selected: [], navigationPath };
    }

    const pickedNodes = picks
      .map((id) => nodeIndex.get(id))
      .filter((n): n is TocNode => n !== undefined);

    if (pickedNodes.length === 0) {
      return { selected: [], navigationPath };
    }

    lastPicked = pickedNodes;

    const allLeaves = pickedNodes.every(isLeaf);
    const anyHasChildren = pickedNodes.some((n) => !isLeaf(n));

    // Stop only at leaf nodes. Ignore done while any pick still has children.
    if (allLeaves || (done && !anyHasChildren)) {
      return {
        selected: pickedNodes.slice(0, TREE_MAX_SECTIONS),
        navigationPath,
      };
    }

    const nextFrontier: TocNode[] = [];
    for (const node of pickedNodes) {
      nextFrontier.push(...node.nodes);
    }

    if (nextFrontier.length === 0) {
      return {
        selected: pickedNodes.slice(0, TREE_MAX_SECTIONS),
        navigationPath,
      };
    }

    frontier = nextFrontier;
  }

  return {
    selected: lastPicked.slice(0, TREE_MAX_SECTIONS),
    navigationPath,
  };
}

function pageRangesOverlap(
  chunkStart: number | null,
  chunkEnd: number | null,
  nodeStart: number,
  nodeEnd: number
): boolean {
  if (chunkStart === null) return false;
  const cEnd = chunkEnd ?? chunkStart;
  return chunkStart <= nodeEnd && cEnd >= nodeStart;
}

type ChunkRow = Pick<
  Chunk,
  "id" | "section_label" | "page_start" | "page_end" | "content"
> & { labelToken: string };

function deriveLabelToken(sectionLabel: string | null): string {
  return (sectionLabel ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Parent prefix for range/list labels; null → skip label matching (fallback only). */
function deriveMatchBase(sectionLabel: string | null): string | null {
  const label = (sectionLabel ?? "").trim();
  if (!label) return null;

  if (/[–,\-]/.test(label)) {
    const parts = label.split(".");
    if (parts.length <= 1) return null;
    const base = parts.slice(0, -1).join(".");
    return base || null;
  }

  return label;
}

function chunkMatchesLabel(labelToken: string, matchBase: string): boolean {
  if (!labelToken || !matchBase) return false;
  const token = labelToken.toUpperCase();
  const base = matchBase.toUpperCase();
  return token === base || token.startsWith(`${base}.`);
}

function chunkToCitation(chunk: ChunkRow): PolicyCitation {
  return {
    id: chunk.id,
    sectionLabel: chunk.section_label ?? "Section",
    pageStart: chunk.page_start,
    pageEnd: chunk.page_end,
    content: chunk.content,
    similarity: 1,
  };
}

function chunksMatchingByLabel(
  allChunks: ChunkRow[],
  matchBase: string
): ChunkRow[] {
  return allChunks.filter((c) => chunkMatchesLabel(c.labelToken, matchBase));
}

function chunksMatchingByPageOverlap(
  allChunks: ChunkRow[],
  node: TocNode
): ChunkRow[] {
  return allChunks.filter((c) =>
    pageRangesOverlap(
      c.page_start,
      c.page_end,
      node.pageStart,
      node.pageEnd
    )
  );
}

async function fetchPassagesForNodes(
  supabase: SupabaseClient,
  documentId: string,
  nodes: TocNode[]
): Promise<PolicyCitation[]> {
  const { data, error } = await supabase
    .from("chunks")
    .select("id, section_label, page_start, page_end, content")
    .eq("document_id", documentId)
    .order("page_start", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load chunks: ${error.message}`);
  }

  const allChunks: ChunkRow[] = ((data ?? []) as Pick<
    Chunk,
    "id" | "section_label" | "page_start" | "page_end" | "content"
  >[]).map((chunk) => ({
    ...chunk,
    labelToken: deriveLabelToken(chunk.section_label),
  }));

  const selectedIds = new Set<number>();

  for (const node of nodes) {
    const matchBase = deriveMatchBase(node.sectionLabel);
    let nodeChunks: ChunkRow[] = [];

    if (matchBase) {
      nodeChunks = chunksMatchingByLabel(allChunks, matchBase);
    }

    if (nodeChunks.length === 0) {
      nodeChunks = chunksMatchingByPageOverlap(allChunks, node);
    }

    for (const chunk of nodeChunks) {
      selectedIds.add(chunk.id);
    }
  }

  return allChunks
    .filter((c) => selectedIds.has(c.id))
    .slice(0, TREE_MAX_PASSAGES)
    .map(chunkToCitation);
}

function isValidTocTree(value: unknown): value is TocTree {
  if (!value || typeof value !== "object") return false;
  const tree = value as TocTree;
  return Array.isArray(tree.nodes) && tree.nodes.length > 0;
}

export async function answerPolicyQuestionTree(
  supabase: SupabaseClient,
  documentId: string,
  question: string
): Promise<PolicyQAResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question is required.");
  }

  const { data: docData, error: docError } = await supabase
    .from("documents")
    .select("toc_tree")
    .eq("id", documentId)
    .single();

  if (docError) {
    throw new Error(`Failed to load document: ${docError.message}`);
  }

  const tocTree = (docData as { toc_tree: unknown } | null)?.toc_tree;

  if (!isValidTocTree(tocTree)) {
    return treeRefusal([]);
  }

  const nodeIndex = indexNodes(tocTree.nodes);
  const { selected, navigationPath } = await navigateTree(
    trimmed,
    tocTree.nodes,
    nodeIndex
  );

  if (selected.length === 0) {
    return treeRefusal(navigationPath);
  }

  const retrievedChunks = await fetchPassagesForNodes(
    supabase,
    documentId,
    selected
  );

  if (retrievedChunks.length === 0) {
    return treeRefusal(navigationPath);
  }

  const passages = retrievedChunks.map((c, i) => ({
    index: i + 1,
    sectionLabel: c.sectionLabel,
    pageStart: c.pageStart,
    pageEnd: c.pageEnd,
    content: c.content,
  }));

  const answer = await generatePolicyAnswerFromPassages(trimmed, passages);
  const refused = answer === REFUSAL_MESSAGE;

  return {
    answer,
    citations: refused ? [] : retrievedChunks,
    retrievedChunks,
    refused,
    topSimilarity: null,
    strategy: "tree",
    navigationPath,
  };
}

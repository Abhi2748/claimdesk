import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ANTHROPIC_MODEL } from "@/lib/anthropic";
import type { Chunk } from "@/types/database";
import type { TocNode, TocTree, TocValidationResult } from "@/types/toc";

export const TOC_TREE_PROMPT_VERSION = "v1";

const TOC_EXTRACT_SYSTEM_PROMPT = `You are a legal document structure analyst. Given the full text of an insurance policy document with printed page markers, produce a hierarchical table-of-contents tree that mirrors the document's own section structure.

Output ONLY valid JSON matching this schema (no prose, no markdown fences):
{
  "docDescription": "One sentence describing the document type and edition",
  "nodes": [
    {
      "nodeId": "0001",
      "sectionLabel": "I" or "III.B.8" or null,
      "title": "Section title as it appears in the document",
      "pageStart": 1,
      "pageEnd": 3,
      "summary": "One sentence summarizing what this section covers.",
      "nodes": []
    }
  ]
}

Rules:
- Build 2–4 levels deep following the document's real hierarchy (for NFIP SFIP: Agreement, Definitions, Coverages, Exclusions, Conditions, etc.).
- Assign nodeId values as zero-padded four-digit strings in depth-first order ("0001", "0002", …). Each nodeId must be unique.
- Use PRINTED page numbers from the [page N] markers in the input — the same numbers used in legal citations [Section, p.N].
- sectionLabel: use the document's own section numbering/lettering when present (e.g. "IV.14", "VII.O", "III.C.2.a"); null only when no label exists.
- pageStart and pageEnd must span the pages where that section's content appears; child ranges must fall within their parent.
- Every node must have a non-empty title and a one-sentence summary.
- Include all major sections; omit page footers and boilerplate that are not structural sections.`;

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

export interface ReconstructedDoc {
  text: string;
  minPage: number;
  maxPage: number;
}

export async function reconstructDocText(
  supabase: SupabaseClient,
  documentId: string
): Promise<ReconstructedDoc> {
  const { data, error } = await supabase
    .from("chunks")
    .select("id, page_start, content")
    .eq("document_id", documentId)
    .order("page_start", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load chunks: ${error.message}`);
  }

  const chunks = (data ?? []) as Pick<Chunk, "id" | "page_start" | "content">[];
  if (chunks.length === 0) {
    throw new Error("No chunks found for document.");
  }

  chunks.sort((a, b) => {
    if (a.page_start == null && b.page_start == null) return a.id - b.id;
    if (a.page_start == null) return 1;
    if (b.page_start == null) return -1;
    if (a.page_start !== b.page_start) return a.page_start - b.page_start;
    return a.id - b.id;
  });

  const pages = chunks
    .map((c) => c.page_start)
    .filter((p): p is number => p !== null);

  if (pages.length === 0) {
    throw new Error("No chunks with printed page numbers found.");
  }

  const minPage = Math.min(...pages);
  const maxPage = Math.max(...pages);

  const parts: string[] = [];
  for (const chunk of chunks) {
    const page = chunk.page_start ?? minPage;
    parts.push(`[page ${page}]\n${chunk.content}`);
  }

  return {
    text: parts.join("\n\n"),
    minPage,
    maxPage,
  };
}

function stripMarkdownFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  }
  return text.trim();
}

interface ClaudeTocPayload {
  docDescription?: string;
  nodes?: TocNode[];
}

export async function extractTocTree(text: string): Promise<TocTree> {
  const anthropic = getAnthropic();

  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 16384,
    system: TOC_EXTRACT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract the table-of-contents tree for this document:\n\n${text}`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text response from model.");
  }

  const cleaned = stripMarkdownFences(block.text);
  let parsed: ClaudeTocPayload;
  try {
    parsed = JSON.parse(cleaned) as ClaudeTocPayload;
  } catch {
    throw new Error("Model response was not valid JSON.");
  }

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error("Model JSON missing nodes array.");
  }

  return {
    docDescription: parsed.docDescription?.trim() ?? "",
    nodes: parsed.nodes,
    model: ANTHROPIC_MODEL,
    promptVersion: TOC_TREE_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

function countNodes(nodes: TocNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countNodes(node.nodes);
  }
  return count;
}

function maxDepth(nodes: TocNode[], depth = 1): number {
  if (nodes.length === 0) return 0;
  let max = depth;
  for (const node of nodes) {
    max = Math.max(max, maxDepth(node.nodes, depth + 1));
  }
  return max;
}

export function treeStats(tree: TocTree): {
  totalNodes: number;
  maxDepth: number;
  pageSpan: { start: number; end: number } | null;
} {
  const totalNodes = countNodes(tree.nodes);
  const depth = maxDepth(tree.nodes);

  let start = Infinity;
  let end = -Infinity;

  function walk(nodes: TocNode[]) {
    for (const node of nodes) {
      start = Math.min(start, node.pageStart);
      end = Math.max(end, node.pageEnd);
      walk(node.nodes);
    }
  }

  walk(tree.nodes);

  return {
    totalNodes,
    maxDepth: depth,
    pageSpan: start === Infinity ? null : { start, end },
  };
}

export function validateTocTree(
  tree: TocTree,
  minPage: number,
  maxPage: number
): TocValidationResult {
  const errors: string[] = [];
  const nodeIds = new Set<string>();

  if (!tree.nodes || tree.nodes.length === 0) {
    errors.push("Root must have at least one node.");
    return { ok: false, errors };
  }

  function walk(
    nodes: TocNode[],
    parentRange: { start: number; end: number } | null,
    path: string
  ) {
    for (const node of nodes) {
      const label = `${path}/${node.nodeId}`;

      if (!node.nodeId?.trim()) {
        errors.push(`${label}: missing nodeId`);
      } else if (nodeIds.has(node.nodeId)) {
        errors.push(`Duplicate nodeId: ${node.nodeId}`);
      } else {
        nodeIds.add(node.nodeId);
      }

      if (!node.title?.trim()) {
        errors.push(`${label}: empty title`);
      }

      if (!node.summary?.trim()) {
        errors.push(`${label}: empty summary`);
      }

      if (
        typeof node.pageStart !== "number" ||
        typeof node.pageEnd !== "number" ||
        Number.isNaN(node.pageStart) ||
        Number.isNaN(node.pageEnd)
      ) {
        errors.push(`${label}: pageStart and pageEnd must be numbers`);
      } else {
        if (node.pageStart > node.pageEnd) {
          errors.push(
            `${label}: pageStart (${node.pageStart}) > pageEnd (${node.pageEnd})`
          );
        }
        if (node.pageStart < minPage || node.pageEnd > maxPage) {
          errors.push(
            `${label}: page range [${node.pageStart}, ${node.pageEnd}] outside document bounds [${minPage}, ${maxPage}]`
          );
        }
        if (parentRange) {
          if (
            node.pageStart < parentRange.start ||
            node.pageEnd > parentRange.end
          ) {
            errors.push(
              `${label}: page range [${node.pageStart}, ${node.pageEnd}] outside parent [${parentRange.start}, ${parentRange.end}]`
            );
          }
        }
      }

      if (!Array.isArray(node.nodes)) {
        errors.push(`${label}: nodes must be an array`);
      } else {
        walk(
          node.nodes,
          typeof node.pageStart === "number" && typeof node.pageEnd === "number"
            ? { start: node.pageStart, end: node.pageEnd }
            : parentRange,
          label
        );
      }
    }
  }

  walk(tree.nodes, null, "root");

  return { ok: errors.length === 0, errors };
}

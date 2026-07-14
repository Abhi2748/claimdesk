import {
  CHUNK_OVERLAP_TOKENS,
  CHUNK_TARGET_TOKENS,
} from "@/lib/retrieval-config";

export interface PolicyChunk {
  sectionLabel: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
}

const ROMAN_SECTION =
  /^(I{1,3}|IV|V|VI{0,3}|IX|X|XI|XII)\.\s+(.+)$/;
const LETTER_SUBSECTION = /^([A-Z])\.\s+(.+)$/;
const NUMBER_SUBSECTION = /^(\d+)\.\s+(.+)$/;
/** Third-level lettered items e.g. "a. Sandbags, Supplies, and Labor" under III.C.2 */
const SUB_LETTER_SUBSECTION = /^([a-z])\.\s+(.+)$/;
/** Printed page footers e.g. "NFIP DWELLING FORM SFIP PAGE 3 OF 30" */
const PAGE_FOOTER = /PAGE\s+(\d+)\s+OF\s+(\d+)/i;

const ROMAN_TO_INT: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

const CHARS_PER_TOKEN = 4;
/**
 * Drop heading-only or whitespace stubs that pollute retrieval and the ToC
 * tree. Overridable via CHUNK_MIN_CONTENT_CHARS for the Block 2.2 chunking-knob
 * ablation leg only — unset in every live/frozen path, so the default (50)
 * is what production and the frozen F-122 eval always use.
 */
const MIN_CHUNK_CONTENT_CHARS = process.env.CHUNK_MIN_CONTENT_CHARS
  ? Number(process.env.CHUNK_MIN_CONTENT_CHARS)
  : 50;

export function romanToInt(numeral: string): number | null {
  return ROMAN_TO_INT[numeral] ?? null;
}

/** Major section titles in NFIP policies are ALL CAPS; subsections are Title Case. */
export function isAllCapsTitle(title: string): boolean {
  const alpha = title.replace(/[^A-Za-z]/g, "");
  if (!alpha) return true;
  return alpha === alpha.toUpperCase();
}

/**
 * Major Roman-numeral heading: must be the sequential successor of the current
 * major section AND use an ALL CAPS title (e.g. "VII. GENERAL CONDITIONS").
 */
export function isValidMajorSection(
  numeral: string,
  title: string,
  currentMajor: number | null
): boolean {
  const candidate = romanToInt(numeral);
  if (candidate === null) return false;

  if (currentMajor === null) {
    if (candidate !== 1) return false;
  } else if (candidate !== currentMajor + 1) {
    return false;
  }

  return isAllCapsTitle(title);
}

interface LineWithPage {
  text: string;
  page: number | null;
}

interface SectionDraft {
  sectionLabel: string;
  lines: LineWithPage[];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function parsePrintedPageNumber(pageText: string): number | null {
  const match = pageText.match(PAGE_FOOTER);
  return match ? parseInt(match[1]!, 10) : null;
}

export function parsePrintedPageTotal(pageText: string): number | null {
  const match = pageText.match(PAGE_FOOTER);
  return match ? parseInt(match[2]!, 10) : null;
}

export function stripPageFooters(text: string): string {
  return text
    .split("\n")
    .filter((line) => !PAGE_FOOTER.test(line))
    .join("\n");
}

export function countPagesWithFooters(pages: string[]): number {
  return pages.filter((page) => parsePrintedPageNumber(page ?? "") !== null)
    .length;
}

export function resolveDocumentTotalPages(
  pages: string[],
  pdfTotalPages: number
): number {
  let fromFooter: number | null = null;
  for (const page of pages) {
    const total = parsePrintedPageTotal(page ?? "");
    if (total !== null) {
      fromFooter = total;
    }
  }
  return fromFooter ?? pdfTotalPages;
}

function aggregatePageRange(lines: LineWithPage[]): {
  pageStart: number | null;
  pageEnd: number | null;
} {
  const pages = lines
    .map((l) => l.page)
    .filter((p): p is number => p !== null);
  if (pages.length === 0) {
    return { pageStart: null, pageEnd: null };
  }
  return { pageStart: Math.min(...pages), pageEnd: Math.max(...pages) };
}

function pagesToLines(pages: string[]): LineWithPage[] {
  const lines: LineWithPage[] = [];
  for (const rawPage of pages) {
    const printedPage = parsePrintedPageNumber(rawPage ?? "");
    const cleaned = stripPageFooters(rawPage ?? "");
    for (const line of cleaned.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) {
        lines.push({ text: trimmed, page: printedPage });
      }
    }
  }
  return lines;
}

function linesToChunk(
  sectionLabel: string | null,
  lines: LineWithPage[]
): PolicyChunk | null {
  if (lines.length === 0) return null;
  const content = lines.map((l) => l.text).join("\n").trim();
  if (!content || content.length < MIN_CHUNK_CONTENT_CHARS) return null;
  const { pageStart, pageEnd } = aggregatePageRange(lines);
  return { sectionLabel, pageStart, pageEnd, content };
}

function splitByHeadings(lines: LineWithPage[]): SectionDraft[] {
  const sections: SectionDraft[] = [];
  let roman: string | null = null;
  let letter: string | null = null;
  let number: string | null = null;
  let subLetter: string | null = null;
  let currentLabel = "Preamble";
  let currentLines: LineWithPage[] = [];

  function flush() {
    if (currentLines.length > 0) {
      sections.push({ sectionLabel: currentLabel, lines: [...currentLines] });
      currentLines = [];
    }
  }

  function buildLabel(title?: string): string {
    const parts: string[] = [];
    if (roman) parts.push(roman);
    if (letter) parts.push(letter);
    if (number) parts.push(number);
    if (subLetter) parts.push(subLetter);
    const prefix = parts.join(".");
    if (title && prefix) return `${prefix} ${title}`;
    if (prefix) return prefix;
    return title ?? "Section";
  }

  for (const line of lines) {
    const romanMatch = line.text.match(ROMAN_SECTION);
    if (romanMatch) {
      const numeral = romanMatch[1]!;
      const title = romanMatch[2]!.trim();
      const currentMajor = roman ? romanToInt(roman) : null;

      if (isValidMajorSection(numeral, title, currentMajor)) {
        flush();
        roman = numeral;
        letter = null;
        number = null;
        subLetter = null;
        currentLabel = buildLabel(title);
        currentLines.push(line);
        continue;
      }
    }

    const letterMatch = line.text.match(LETTER_SUBSECTION);
    if (letterMatch && roman) {
      flush();
      letter = letterMatch[1]!;
      number = null;
      subLetter = null;
      currentLabel = buildLabel(letterMatch[2]!.trim());
      currentLines.push(line);
      continue;
    }

    const numberMatch = line.text.match(NUMBER_SUBSECTION);
    if (numberMatch && roman) {
      flush();
      number = numberMatch[1]!;
      subLetter = null;
      currentLabel = buildLabel(numberMatch[2]!.trim());
      currentLines.push(line);
      continue;
    }

    const subLetterMatch = line.text.match(SUB_LETTER_SUBSECTION);
    if (subLetterMatch && roman && number) {
      flush();
      subLetter = subLetterMatch[1]!;
      currentLabel = buildLabel(subLetterMatch[2]!.trim());
      currentLines.push(line);
      continue;
    }

    currentLines.push(line);
  }

  flush();
  return sections;
}

function pageRangeForSlice(
  lines: LineWithPage[],
  sliceStart: number,
  sliceEnd: number
): { pageStart: number | null; pageEnd: number | null } {
  let charCount = 0;
  const overlapping: number[] = [];

  for (const line of lines) {
    const lineStart = charCount;
    charCount += line.text.length + 1;
    if (charCount > sliceStart && lineStart < sliceEnd && line.page !== null) {
      overlapping.push(line.page);
    }
  }

  if (overlapping.length === 0) {
    return { pageStart: null, pageEnd: null };
  }
  return {
    pageStart: Math.min(...overlapping),
    pageEnd: Math.max(...overlapping),
  };
}

function splitByTokens(
  sectionLabel: string | null,
  lines: LineWithPage[]
): PolicyChunk[] {
  const fullText = lines.map((l) => l.text).join("\n");
  const targetChars = CHUNK_TARGET_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN;

  if (fullText.length <= targetChars) {
    const chunk = linesToChunk(sectionLabel, lines);
    return chunk ? [chunk] : [];
  }

  const chunks: PolicyChunk[] = [];
  let start = 0;

  while (start < fullText.length) {
    let end = Math.min(start + targetChars, fullText.length);
    if (end < fullText.length) {
      const breakAt = fullText.lastIndexOf("\n", end);
      if (breakAt > start + targetChars * 0.5) {
        end = breakAt;
      }
    }

    const slice = fullText.slice(start, end).trim();
    if (slice.length >= MIN_CHUNK_CONTENT_CHARS) {
      const { pageStart, pageEnd } = pageRangeForSlice(
        lines,
        start,
        start + slice.length
      );
      chunks.push({ sectionLabel, pageStart, pageEnd, content: slice });
    }

    if (end >= fullText.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

function splitLargeSection(section: SectionDraft): PolicyChunk[] {
  const content = section.lines.map((l) => l.text).join("\n");
  if (estimateTokens(content) <= CHUNK_TARGET_TOKENS) {
    const chunk = linesToChunk(section.sectionLabel, section.lines);
    return chunk ? [chunk] : [];
  }
  return splitByTokens(section.sectionLabel, section.lines);
}

export function chunkPolicyText(pages: string[]): PolicyChunk[] {
  const lines = pagesToLines(pages);
  if (lines.length === 0) return [];

  const sections = splitByHeadings(lines);
  const hasHeadings =
    sections.length > 1 ||
    (sections.length === 1 && sections[0]!.sectionLabel !== "Preamble");

  if (!hasHeadings) {
    return splitByTokens(null, lines);
  }

  const chunks: PolicyChunk[] = [];
  for (const section of sections) {
    chunks.push(...splitLargeSection(section));
  }

  return chunks.filter((c) => c.content.trim().length >= MIN_CHUNK_CONTENT_CHARS);
}

/** Highest printed policy page found in the PDF, for document.page_count. */
export function maxPrintedPageNumber(pages: string[]): number | null {
  let max: number | null = null;
  for (const page of pages) {
    const n = parsePrintedPageNumber(page ?? "");
    if (n !== null && (max === null || n > max)) {
      max = n;
    }
  }
  return max;
}

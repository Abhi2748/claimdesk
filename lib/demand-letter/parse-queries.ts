/** Defensively parse a JSON string array from model output (strips code fences). */
export function parseRetrievalQueries(raw: string): string[] {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  text = text.trim();

  const parsed: unknown = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Retrieval plan did not return a JSON array.");
  }

  const queries = parsed
    .filter((item): item is string => typeof item === "string")
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && q.split(/\s+/).length <= 12);

  if (queries.length === 0) {
    throw new Error("Retrieval plan returned no valid queries.");
  }

  return queries.slice(0, 5);
}

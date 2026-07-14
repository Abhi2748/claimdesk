export const REFUSAL_MESSAGE = "I can't find this in the policy.";

/**
 * The model sometimes emits the exact REFUSAL_MESSAGE as an opening
 * sentence, then appends unsolicited explanation for why it refused —
 * violating the system prompt's "reply with exactly" instruction without
 * changing its underlying refuse/answer decision. Collapse that case to the
 * canonical string so the refusal contract (exact-match scoring, no
 * citations attached) holds regardless of the model's verbosity.
 */
export function normalizeRefusalAnswer(rawAnswer: string): string {
  const trimmed = rawAnswer.trim();
  if (trimmed !== REFUSAL_MESSAGE && trimmed.startsWith(REFUSAL_MESSAGE)) {
    return REFUSAL_MESSAGE;
  }
  return trimmed;
}

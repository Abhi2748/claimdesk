/** Parse FastAPI/AI error bodies into a short user-facing message. */
export function friendlyAiError(
  status: number,
  bodyText: string,
  fallback: string
): string {
  try {
    const parsed = JSON.parse(bodyText) as {
      detail?:
        | string
        | { code?: string; message?: string; details?: string[] };
    };
    const detail = parsed.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail.trim();
    }
    if (
      detail &&
      typeof detail === "object" &&
      typeof detail.message === "string" &&
      detail.message.trim()
    ) {
      return detail.message.trim();
    }
  } catch {
    // non-JSON body — fall through
  }

  if (status === 401) return "You must be signed in.";
  if (status === 422 || status === 400) {
    return "That input isn't valid. Please shorten or rephrase and try again.";
  }
  if (status === 408 || status === 504) {
    return "The request timed out. Please try again.";
  }
  if (status === 502 || status === 503) {
    return "The AI service is temporarily unavailable. Please try again.";
  }
  return fallback;
}

export async function readAiErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const text = await response.text();
  return friendlyAiError(response.status, text, fallback);
}

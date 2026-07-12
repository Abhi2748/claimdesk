import type { PolicyQARequest, PolicyQAResponse } from "@claimdesk/types";

export async function askPolicyQuestion(
  baseUrl: string,
  accessToken: string,
  req: PolicyQARequest
): Promise<PolicyQAResponse> {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const response = await fetch(`${normalizedBase}/qa/answer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error(
      `Policy QA request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<PolicyQAResponse>;
}

import type {
  CoverageAnalyzeAcceptedResponse,
  CoverageAnalyzeRequest,
  PolicyQAMatterRequest,
  PolicyQAMatterResponse,
  PolicyQARequest,
  PolicyQAResponse,
} from "@claimdesk/types";
import { readAiErrorMessage } from "./errors";

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
      await readAiErrorMessage(
        response,
        "Policy Q&A failed. Please try again."
      )
    );
  }

  return response.json() as Promise<PolicyQAResponse>;
}

export async function askMatterQuestion(
  baseUrl: string,
  accessToken: string,
  req: PolicyQAMatterRequest
): Promise<PolicyQAMatterResponse> {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const response = await fetch(`${normalizedBase}/qa/matter`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error(
      await readAiErrorMessage(
        response,
        "Matter Q&A failed. Please try again."
      )
    );
  }

  return response.json() as Promise<PolicyQAMatterResponse>;
}

export async function analyzeCoverage(
  baseUrl: string,
  accessToken: string,
  req: CoverageAnalyzeRequest
): Promise<CoverageAnalyzeAcceptedResponse> {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const response = await fetch(`${normalizedBase}/coverage/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error(
      await readAiErrorMessage(
        response,
        "Coverage analysis could not be started. Please try again."
      )
    );
  }

  return response.json() as Promise<CoverageAnalyzeAcceptedResponse>;
}

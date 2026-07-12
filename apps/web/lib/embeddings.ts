import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

let client: OpenAI | null = null;

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openai = getOpenAI();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

export function embeddingToVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

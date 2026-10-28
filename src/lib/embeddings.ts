import { measure } from './reliability';

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ??
  "hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0";

export async function generateEmbedding(
  text: string,
  signal?: AbortSignal
): Promise<number[]> {
  return measure('embedding',async()=>{
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error("Embedding generation failed");
  }

  const data = await response.json();
  const embedding = data.embeddings?.[0];

  if (
    !Array.isArray(embedding) ||
    embedding.length !== 768 ||
    !embedding.every(
      (value: unknown) =>
        typeof value === "number" && Number.isFinite(value)
    )
  ) {
    throw new Error("Invalid embedding returned by model");
  }

  return embedding;
  });
}

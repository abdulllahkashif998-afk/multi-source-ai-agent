import { z } from "zod";
import type { DocumentSearchResult } from "./search-documents";
import { CitationVerificationError, type CitationVerificationReason } from "./chat-errors";

export const INSUFFICIENT_EVIDENCE =
  "I don't have enough information in the retrieved documents to answer that question.";

export const groundedAnswerSchema = z.object({
  answerable: z.boolean(),
  statements: z.array(z.object({
    text: z.string().trim().min(1).max(2000),
    citations: z.array(z.object({
      sourceId: z.string().min(1),
      quote: z.string().trim().min(1).max(2000),
    })).min(1).max(3),
  })).max(8),
});

export type GeneratedAnswer = z.infer<typeof groundedAnswerSchema>;

export interface EvidenceSource {
  id: string;
  documentId: string;
  chunkId: string;
  filename: string;
  chunkIndex: number;
  pageNumber: number | null;
  similarity: number | null;
  retrievalMode?: 'semantic' | 'hybrid';
  keywordRank?: number;
  semanticRank?: number;
  rrfScore?: number;
  text: string;
}

export function selectEvidence(
  results: DocumentSearchResult[],
  minSimilarity: number
): EvidenceSource[] {
  return results.filter((row) =>
    ((typeof row.similarity === 'number' && Number.isFinite(row.similarity) && row.similarity >= minSimilarity) || (row.retrieval_mode === 'hybrid' && Number.isInteger(row.keyword_rank) && row.keyword_rank! > 0)) &&
    row.chunk_text.trim().length > 0
  ).slice(0, 3).map((row, index) => ({
    id: `S${index + 1}`,
    documentId: String(row.document_id),
    chunkId: String(row.chunk_id),
    filename: row.filename,
    chunkIndex: row.chunk_index,
    pageNumber: row.page_number,
    similarity: row.similarity,
    ...(row.retrieval_mode ? {retrievalMode:row.retrieval_mode} : {}),
    ...(row.keyword_rank ? {keywordRank:row.keyword_rank} : {}),
    ...(row.semantic_rank ? {semanticRank:row.semantic_rank} : {}),
    ...(row.rrf_score ? {rrfScore:row.rrf_score} : {}),
    // Bound context size while preserving an exact substring of original text.
    text: row.chunk_text.slice(0, 6000),
  }));
}

export function insufficientEvidence() {
  return { grounded: false, answer: INSUFFICIENT_EVIDENCE, sources: [] };
}

export function validateGroundedAnswer(
  value: unknown,
  evidence: EvidenceSource[]
) {
  const parsed = groundedAnswerSchema.safeParse(value);
  const unsupported = (reason:CitationVerificationReason) => new CitationVerificationError(reason);
  if (!parsed.success) throw unsupported('citation_invalid_shape');
  const answer = parsed.data;
  if (!answer.answerable) return insufficientEvidence();
  if (answer.statements.length === 0) throw unsupported('citation_empty_statements');

  const quotesBySource = new Map<string, Set<string>>();
  const paragraphs = answer.statements.map((statement) => {
    // Citation markers are assigned by the server, never by generated prose.
    if (/\[[^\]]*\]/.test(statement.text)) throw unsupported('citation_marker_in_statement');
    const ids = new Set<string>();
    for (const citation of statement.citations) {
      const source = evidence.find((item) => item.id === citation.sourceId);
      if (!source) throw unsupported('citation_unknown_source');
      if (!source.text.includes(citation.quote)) throw unsupported('citation_quote_not_in_source');
      ids.add(source.id);
      const quotes = quotesBySource.get(source.id) ?? new Set<string>();
      quotes.add(citation.quote);
      quotesBySource.set(source.id, quotes);
    }
    return `${statement.text} ${[...ids].map((id) => `[${id}]`).join(" ")}`;
  });

  return {
    grounded: true,
    answer: paragraphs.join("\n\n"),
    sources: evidence.filter((source) => quotesBySource.has(source.id)).map((source) => ({
      ...source,
      quotes: [...quotesBySource.get(source.id)!],
    })),
  };
}

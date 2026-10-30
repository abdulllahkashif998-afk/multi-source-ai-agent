import { measure } from './reliability';
import { timedQuery } from './db';
import { requireUserId } from "./identity";
import { fuseCandidates, type RankedCandidate } from "./hybrid-ranking";
import pool from "@/src/lib/db";
import { generateEmbedding } from "@/src/lib/embeddings";

export interface DocumentSearchResult {
  document_id: string;
  chunk_id: string;
  filename: string;
  chunk_index: number;
  page_number: number | null;
  chunk_text: string;
  similarity: number | null;
  retrieval_mode?: 'semantic' | 'hybrid';
  semantic_rank?: number;
  keyword_rank?: number;
  rrf_score?: number;
}

export async function searchDocuments(
  question: string,
  signal?: AbortSignal,
  options?: { mode?: 'semantic' | 'hybrid'; filename?: string }
): Promise<DocumentSearchResult[]> {
  return measure('retrieval',async()=>{
  const userId=requireUserId();
  const mode=options?.mode ?? process.env.DOCUMENT_SEARCH_MODE ?? 'hybrid';
  if(mode!=='semantic' && mode!=='hybrid') throw new Error('Invalid document search mode');
  const minSimilarity=Number(process.env.RAG_MIN_SIMILARITY ?? '0.5');
  if(!Number.isFinite(minSimilarity) || minSimilarity<0 || minSimilarity>1 || process.env.RAG_MIN_SIMILARITY?.trim()==='') throw new Error('Invalid retrieval cutoff');
  signal?.throwIfAborted();
  const filename=options?.filename;
  if(filename!==undefined&&(typeof filename!=='string'||!filename.trim()||filename.length>255||filename.includes('/')||filename.includes('\\')||/[\u0000-\u001f]/.test(filename)))throw new Error('Invalid document filename scope');
  const embedding = await generateEmbedding(question, signal);

  // pg supports a per-query timeout, although its QueryConfig type omits it.
  const semanticQuery = {
    text: `SELECT
       dc.document_id,
       dc.id AS chunk_id,
       d.filename,
       dc.chunk_index,
       dc.page_number,
       dc.chunk_text,
       1 - (dc.embedding <=> $1::vector) AS similarity
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE d.status = 'ready'
       AND d.user_id = $2
       AND ($3::text IS NULL OR lower(d.filename)=lower($3))
       AND dc.embedding IS NOT NULL
     ORDER BY dc.embedding <=> $1::vector, dc.id
     LIMIT 3`,
    // Identity comes exclusively from the verified server session scope.
    values: [JSON.stringify(embedding), userId, filename??null],
    query_timeout: 10_000,
  };
  if(mode==='semantic') {
    const result=await timedQuery(()=>pool.query<DocumentSearchResult>(semanticQuery));
    signal?.throwIfAborted();
    return result.rows.map(row=>({...row,retrieval_mode:'semantic'}));
  }
  const query={
    text: `WITH scoped AS NOT MATERIALIZED (
      SELECT dc.document_id, dc.id AS chunk_id, d.filename, dc.chunk_index,
             dc.page_number, dc.chunk_text, dc.embedding
      FROM document_chunks dc JOIN documents d ON d.id = dc.document_id
      WHERE d.status = 'ready' AND d.user_id = $2
        AND ($4::text IS NULL OR lower(d.filename)=lower($4))
    ), semantic AS (
      SELECT *, 1 - (embedding <=> $1::vector) AS similarity,
             row_number() OVER (ORDER BY embedding <=> $1::vector, chunk_id)::int AS branch_rank
      FROM scoped WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector, chunk_id LIMIT 20
    ), keyword AS (
      SELECT *, 1 - (embedding <=> $1::vector) AS similarity,
             row_number() OVER (ORDER BY ts_rank_cd(to_tsvector('english', chunk_text), to_tsquery('english', replace(plainto_tsquery('english', $3)::text, ' & ', ' | '))) DESC, chunk_id)::int AS branch_rank
      FROM scoped WHERE to_tsvector('english', chunk_text) @@ to_tsquery('english', replace(plainto_tsquery('english', $3)::text, ' & ', ' | '))
      ORDER BY ts_rank_cd(to_tsvector('english', chunk_text), to_tsquery('english', replace(plainto_tsquery('english', $3)::text, ' & ', ' | '))) DESC, chunk_id LIMIT 20
    )
    SELECT document_id,chunk_id,filename,chunk_index,page_number,chunk_text,similarity,branch_rank,'semantic' AS branch FROM semantic
    UNION ALL
    SELECT document_id,chunk_id,filename,chunk_index,page_number,chunk_text,similarity,branch_rank,'keyword' AS branch FROM keyword`,
    values:[JSON.stringify(embedding),userId,question,filename??null],
    query_timeout:10_000,
  };
  const result=await timedQuery(()=>pool.query<RankedCandidate>(query));
  signal?.throwIfAborted();
  return fuseCandidates(result.rows,minSimilarity);
  });
}

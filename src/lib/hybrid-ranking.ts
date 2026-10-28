import type { DocumentSearchResult } from './search-documents';
export type RankedCandidate = DocumentSearchResult & { branch: 'semantic' | 'keyword'; branch_rank: number };
export function fuseCandidates(candidates: RankedCandidate[], minSimilarity: number): DocumentSearchResult[] {
 const chunks=new Map<string,DocumentSearchResult>();
 for(const candidate of candidates) {
   if (!Number.isInteger(candidate.branch_rank) || candidate.branch_rank<1) continue;
   if(candidate.branch==='semantic' && !(typeof candidate.similarity==='number' && Number.isFinite(candidate.similarity) && candidate.similarity>=minSimilarity)) continue;
   const key=String(candidate.chunk_id);
   const existing=chunks.get(key);
   const row=existing ?? {document_id:candidate.document_id,chunk_id:candidate.chunk_id,filename:candidate.filename,chunk_index:candidate.chunk_index,page_number:candidate.page_number,chunk_text:candidate.chunk_text,similarity:candidate.similarity,retrieval_mode:'hybrid' as const};
   const field=candidate.branch==='semantic'?'semantic_rank':'keyword_rank';
   row[field]=Math.min(row[field]??Infinity,candidate.branch_rank);
   row.rrf_score=(row.semantic_rank ? 1/(60+row.semantic_rank):0)+(row.keyword_rank ? 1/(60+row.keyword_rank):0);
   chunks.set(key,row);
 }
 // Rank-only reranking: RRF, strongest branch rank, keyword rank, numeric chunk ID.
 // Scores from cosine and ts_rank are deliberately not added together.
 return [...chunks.values()].sort((a,b)=>(b.rrf_score!-a.rrf_score!) || (Math.min(a.semantic_rank??Infinity,a.keyword_rank??Infinity)-Math.min(b.semantic_rank??Infinity,b.keyword_rank??Infinity)) || ((a.keyword_rank??Infinity)-(b.keyword_rank??Infinity)) || (BigInt(a.chunk_id)<BigInt(b.chunk_id)?-1:BigInt(a.chunk_id)>BigInt(b.chunk_id)?1:0)).slice(0,3);
}

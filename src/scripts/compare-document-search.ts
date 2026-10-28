import { runWithIdentity } from '../lib/identity';
import { searchDocuments } from '../lib/search-documents';
import { selectEvidence } from '../lib/rag-answer';
import pool from '../lib/db';
async function main() {
 const question=process.argv[2];
 if(!question?.trim()) throw new Error('Provide a question argument');
 for(const mode of ['semantic','hybrid'] as const) {
   const start=performance.now();
   const results=await searchDocuments(question,AbortSignal.timeout(30_000),{mode});
   const evidence=selectEvidence(results,Number(process.env.RAG_MIN_SIMILARITY??'0.5'));
   console.log(JSON.stringify({mode,ms:Math.round(performance.now()-start),sources:evidence.map(s=>({chunkId:s.chunkId,filename:s.filename,similarity:s.similarity,semanticRank:s.semanticRank,keywordRank:s.keywordRank,rrfScore:s.rrfScore}))}));
 }
}
const operatorUserId=process.argv[3];
(operatorUserId?runWithIdentity(operatorUserId,main):Promise.reject(new Error('Provide an explicit operator user ID as the third argument.'))).catch(()=>{console.error('Comparison failed; check services and server configuration.');process.exitCode=1;}).finally(()=>pool.end());

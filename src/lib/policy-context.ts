import 'server-only';
import pool,{timedQuery} from './db';
import {requireUserId} from './identity';
import type {DocumentSearchResult} from './search-documents';

// Complete, bounded context for one active owned document. Unlike retrieval,
// applicability checks must not depend on a top-K similarity ranking.
export async function loadPolicyContext(filename:string,signal?:AbortSignal):Promise<DocumentSearchResult[]>{
 if(!filename||filename.length>255||/[\\/\u0000-\u001f]/.test(filename))throw Error('Invalid policy scope');
 signal?.throwIfAborted();
 const query={
  text:`WITH owned AS (SELECT id,filename FROM documents WHERE user_id=$1 AND status='ready' AND lower(filename)=lower($2))
   SELECT c.document_id::text,c.id::text AS chunk_id,d.filename,c.chunk_index,c.page_number,c.chunk_text,
   1::float AS similarity,(SELECT count(*)::text FROM owned) AS document_count
   FROM owned d JOIN document_chunks c ON c.document_id=d.id
   ORDER BY c.chunk_index,c.id LIMIT 101`,
  values:[requireUserId(),filename],query_timeout:5000,
 };
 const result=await timedQuery(()=>pool.query<DocumentSearchResult&{document_count:string}>(query));
 signal?.throwIfAborted();
 if(result.rows.length>100||result.rows.some(r=>r.document_count!=='1')||result.rows.reduce((n,r)=>n+r.chunk_text.length,0)>256000)throw Error('Policy context unavailable');
 return result.rows.map(({document_count,...row})=>{void document_count;return row;});
}

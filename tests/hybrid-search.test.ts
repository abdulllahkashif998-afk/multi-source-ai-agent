import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { test, sessionHeaders, sessionRow } from './test-context';
import { fuseCandidates, type RankedCandidate } from '../src/lib/hybrid-ranking';
import { selectEvidence, validateGroundedAnswer } from '../src/lib/rag-answer';
import { searchDocuments } from '../src/lib/search-documents';
import pool from '../src/lib/db';
const row: RankedCandidate={document_id:'1',chunk_id:'10',filename:'fictional.docx',chunk_index:2,page_number:4,chunk_text:'Invoice ZX-2048 was approved.',similarity:0.8,branch:'semantic',branch_rank:1};
test('paraphrase semantic matches remain eligible without keywords',()=>{
 assert.equal(fuseCandidates([row],0.5)[0].semantic_rank,1);
});
test('keyword identifiers survive weak or missing semantic similarity and retain citation metadata',()=>{
 for(const similarity of [0.1,null]) {
 const results=fuseCandidates([{...row,similarity,branch:'keyword'}],0.5);
 const evidence=selectEvidence(results,0.5);
 assert.equal(evidence.length,1);assert.equal(evidence[0].pageNumber,4);assert.equal(evidence[0].chunkIndex,2);assert.equal(evidence[0].chunkId,'10');
 const result=validateGroundedAnswer({answerable:true,statements:[{text:'The invoice was approved.',citations:[{sourceId:'S1',quote:row.chunk_text}]}]},evidence);
 assert.equal(result.grounded,true);
 }
});
test('RRF deduplicates within and across branches and rewards agreement',()=>{
 const result=fuseCandidates([row,row,{...row,branch:'keyword',branch_rank:2},{...row,chunk_id:'11',branch_rank:1}],0.5);
 assert.equal(result.length,2);assert.equal(result[0].chunk_id,'10');assert.equal(result[0].rrf_score,1/61+1/62);
});
test('ranking is deterministic across input order, with numeric bigint tie breaks',()=>{
 const rows=[row,{...row,chunk_id:'2'},{...row,chunk_id:'9007199254740993'}];
 assert.deepEqual(fuseCandidates(rows,0.5).map(r=>r.chunk_id),['2','10','9007199254740993']);
 assert.deepEqual(fuseCandidates([...rows].reverse(),0.5),fuseCandidates(rows,0.5));
});
test('empty and weak semantic candidates do not manufacture evidence',()=>{
 assert.deepEqual(fuseCandidates([],0.5),[]);
 assert.deepEqual(fuseCandidates([{...row,similarity:0.1}],0.5),[]);
});
test('hybrid SQL scopes both branches through ready owned documents and parameterizes text',async()=>{
 let config: {text:string;values:unknown[]}|undefined;
 mock.method(globalThis,'fetch',async()=>Response.json({embeddings:[Array(768).fill(0.1)]}));
 mock.method(pool,'query',async(q:typeof config)=>{config=q;return {rows:[]};});
 try {
 assert.deepEqual(await searchDocuments("ZX-2048'; DROP TABLE users; --",undefined,{mode:'hybrid'}),[]);
 assert.match(config!.text,/WITH scoped AS NOT MATERIALIZED/);
 assert.match(config!.text,/d.status = 'ready' AND d.user_id = \$2/);
 assert.equal((config!.text.match(/FROM scoped/g)||[]).length,2);
 assert.equal(config!.values[1],'1');assert.ok(!config!.text.includes('DROP TABLE'));
 assert.match(config!.text,/to_tsvector/);assert.match(config!.text,/LIMIT 20/);
 } finally{mock.restoreAll();}
});
test('semantic comparison mode preserves legacy search and does not query full text',async()=>{
 let sql='';mock.method(globalThis,'fetch',async()=>Response.json({embeddings:[Array(768).fill(0.1)]}));
 mock.method(pool,'query',async(q:{text:string})=>{sql=q.text;return {rows:[row]};});
 try{const result=await searchDocuments('a paraphrase',undefined,{mode:'semantic'});assert.equal(result[0].retrieval_mode,'semantic');assert.ok(!sql.includes('to_tsvector'));assert.match(sql,/LIMIT 3/);}finally{mock.restoreAll();}
});
test('PostgreSQL integration: exact keywords, owner/status exclusion and semantic comparison', {skip:process.env.RUN_SEARCH_DB_TESTS!=='1'}, async()=>{
 const client=await pool.connect();
 const embedding=[1,...Array(767).fill(0)];
 const other=[0,1,...Array(766).fill(0)];
 try {
 await client.query('BEGIN');
 // Private temporary tables shadow the real ones for this connection only.
 await client.query('CREATE TEMP TABLE documents (LIKE public.documents) ON COMMIT DROP');
 await client.query('CREATE TEMP TABLE document_chunks (LIKE public.document_chunks) ON COMMIT DROP');
 for(let id=1;id<=5;id++) {
 await client.query('INSERT INTO documents(id,user_id,filename,file_path,file_hash,status,version) VALUES($1,$2,$3,$4,$5,$6,1)',[id,id===3?2:1,`fictional-${id}.docx`,'fictional',`hash${id}`,id===4?'processing':id===5?'deleted':'ready']);
 await client.query('INSERT INTO document_chunks(id,document_id,chunk_index,chunk_text,embedding,page_number) VALUES($1,$1,0,$2,$3::vector,4)',[id,id===1?'Workers can rest for twenty days.':'Invoice ZX-2048 approved.',JSON.stringify(id===2?other:embedding)]);
 }
 mock.method(globalThis,'fetch',async()=>Response.json({embeddings:[embedding]}));
 mock.method(pool,'query',async(q:Parameters<typeof client.query>[0])=>client.query(q));
 const hybrid=await searchDocuments('What about ZX-2048?',undefined,{mode:'hybrid'});
 assert.equal(hybrid[0].chunk_id,'2');
 assert.deepEqual(new Set(hybrid.map(r=>r.document_id)),new Set(['1','2']));
 assert.equal(selectEvidence(hybrid,0.5).find(r=>r.chunkId==='2')?.pageNumber,4);
 const semantic=selectEvidence(await searchDocuments('annual vacation allowance',undefined,{mode:'semantic'}),0.5);
 assert.deepEqual(semantic.map(r=>r.chunkId),['1']);
 assert.ok(!hybrid.some(r=>['3','4','5'].includes(r.document_id)));
 } finally {mock.restoreAll();await client.query('ROLLBACK');client.release(true);}
});
test('Day 5 HTTP route and Day 6 tool retain low-cosine keyword evidence',async()=>{
 const {POST}=await import('../app/api/chat/route');
 const {createAgentSession}=await import('../src/lib/agent-tools');
 const oldKey=process.env.GOOGLE_GENERATIVE_AI_API_KEY;const oldNode=process.env.NODE_ENV;
 Object.assign(process.env,{GOOGLE_GENERATIVE_AI_API_KEY:'fictional-test-key',NODE_ENV:'test'});
 mock.method(pool,'query',async(q:{text:string}|string)=>(typeof q==='string'?q:q.text).startsWith('SELECT s.user_id')?{rows:[sessionRow]}:({rows:[{...row,branch:'keyword',similarity:0.1}]}));
 mock.method(globalThis,'fetch',async(input:string|URL|Request)=>String(input).endsWith('/api/embed')?Response.json({embeddings:[Array(768).fill(0.1)]}):Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({answerable:true,statements:[{text:'The invoice was approved.',citations:[{sourceId:'S1',quoteId:'Q1'}]}]})}]},finishReason:'STOP',index:0}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:10,totalTokenCount:20}}));
 try {
 const response=await POST(new Request('http://localhost/api/chat',{method:'POST',headers:{'content-type':'application/json',...sessionHeaders},body:JSON.stringify({question:'ZX-2048?'})}));
 assert.equal(response.status,200);assert.equal((await response.json()).grounded,true);
 const session=createAgentSession({search:(q,s)=>searchDocuments(q,s,{mode:'hybrid'}),discover:async()=>[],query:async()=>[]},new AbortController().signal,0.5);
 await session.execute('searchDocuments',{question:'ZX-2048?'});
 assert.equal(session.evidence().documents.length,1);
 assert.equal(session.finalize({answerable:true,statements:[{text:'Approved.',citations:[{sourceId:'D1',quote:'ZX-2048 was approved.'}]}]}).grounded,true);
 }finally{mock.restoreAll();for(const [key,value] of Object.entries({GOOGLE_GENERATIVE_AI_API_KEY:oldKey,NODE_ENV:oldNode})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

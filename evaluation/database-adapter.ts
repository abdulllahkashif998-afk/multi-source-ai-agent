import {generateEmbedding} from '../src/lib/embeddings';
import {searchDocuments} from '../src/lib/search-documents';
import {createChatHandler} from '../src/lib/chat-handler';
import {generateEvidenceAnswer,getChatConfig} from '../src/lib/gemini';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {withRequest} from '../src/lib/reliability';
import {runWithIdentity} from '../src/lib/identity';
import {discoverDatasets,queryDataset} from '../src/lib/generic-csv';
import {documents,corpusDocuments,owner} from './fixtures';
import {withFixtureDatabase} from './isolation';
import type {Adapter,Context} from './runner';
export async function captureStages<T>(context:Context,work:()=>Promise<T>){
 const original=console.info;
 console.info=(...args:unknown[])=>{
  if(args[0]==='[reliability]'&&typeof args[1]==='string'){
   try{const event=JSON.parse(args[1]);if(typeof event.stage==='string'&&typeof event.durationMs==='number'&&typeof event.outcome==='string')context.stage({stage:event.stage,durationMs:event.durationMs,outcome:event.outcome,tool:event.tool,requestId:typeof event.requestId==='string'&&/^[0-9a-f-]{36}$/.test(event.requestId)?event.requestId:undefined});}catch{/* Discard malformed diagnostics. */}
  }
 };
 try{return await work();}finally{console.info=original;}
}
export async function databaseAdapter(mode:'retrieval'|'live',retrievalMode:'semantic'|'hybrid',signal:AbortSignal):Promise<Adapter>{
 if(mode==='live'&&process.env.ALLOW_LIVE_AI_EVAL!=='1')throw Error('Explicit live evaluation opt-in required');
 const embeddings=new Map<string,number[]>();
 // Cached once per corpus/run, using the existing configured BGE implementation.
 for(const document of documents){signal.throwIfAborted();if(!embeddings.has(document.text))embeddings.set(document.text,await generateEmbedding(document.text,signal));}
 return async(c,context,parent)=>runWithIdentity(owner,()=>withFixtureDatabase(c,embeddings,()=>captureStages(context,async()=>{
  const allowed=new Set(corpusDocuments(c.corpus).map(d=>String(d.chunkId)));
  const scopedSearch=async(question:string,signal:AbortSignal,mode:'semantic'|'hybrid')=>{const rows=await searchDocuments(question,signal,{mode});if(rows.some(row=>!allowed.has(row.chunk_id)))throw Error('Fixture document scope violation');return rows;};
  if(c.category!=='csv')for(const searchMode of ['semantic','hybrid'] as const){const start=performance.now();const rows=await scopedSearch(c.question,parent,searchMode);context.retrieval({mode:searchMode,ranked:rows.map(r=>r.chunk_id),durationMs:performance.now()-start});}
  if(mode==='retrieval')return;
  parent.throwIfAborted();const start=performance.now();
  const request=new Request('http://evaluation.invalid/answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:c.question}),signal:parent});
  let completed=false;try{await withRequest(request,async()=>{
   if(c.system==='chat'){
    const response=await createChatHandler({getConfig:getChatConfig,search:(question,s)=>scopedSearch(question,s,retrievalMode),generate:generateEvidenceAnswer})(request);
    if(!response.ok){const data=await response.json();throw Object.assign(new Error('Evaluation answer failed'),{name:response.status===504?'TimeoutError':'ChatError',status:response.status,code:typeof data.code==='string'?data.code:undefined});}
    context.answer(await response.json());return Response.json({ok:true});
   }
   const signal=AbortSignal.any([parent,AbortSignal.timeout(60_000)]);
   const answer=await answerWithAgent(c.question,signal,{search:(question,s)=>scopedSearch(question,s,retrievalMode),discover:s=>discoverDatasets(owner,s),query:(plan,s)=>queryDataset(owner,plan,s)});
   context.answer(answer);return Response.json({ok:true});
  });
  completed=true;}finally{context.stage({stage:'answer-end-to-end',durationMs:performance.now()-start,outcome:completed?'ok':'error'});}
 })));
}

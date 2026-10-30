import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGroqQuota,memoryQuotaStore,GROQ_LIMITS,RateLimitError} from '../src/lib/groq-quota';
import {reserveBeforeDeadline} from '../src/lib/quota-admission';
import {createGroqTransport,withGroqTransport} from '../src/lib/groq-transport';
import {withProviderDeadline} from '../src/lib/provider-deadline';
import {rateLimitGuidance} from '../src/lib/rate-limit-guidance';
import {createChatHandler} from '../src/lib/chat-handler';
import {generateEvidenceAnswer} from '../src/lib/gemini';
import {runWithIdentity} from '../src/lib/identity';
const settings=(patch:Partial<typeof GROQ_LIMITS>)=>({...GROQ_LIMITS,...patch});
const flush=()=>new Promise<void>(r=>setImmediate(r));
test('TPM and RPM wait to exact safe expiry without reserving while sleeping',async()=>{
 for(const kind of ['tpm','rpm']){
  let now=0,sleeps=0;const store=memoryQuotaStore(),q=createGroqQuota(store,()=>now,settings(kind==='tpm'?{tpm:100}:{rpm:1}));const seed=await q.reserve(80);await q.settle(seed,80);now=59000;
  const id=await reserveBeforeDeadline(q,30,{deadline:62000,signal:new AbortController().signal,now:()=>now,sleep:async ms=>{sleeps++;assert.equal(ms,1000);await store.transact(s=>assert.equal(s.entries.filter(e=>e.pending).length,0));now+=ms;}});
  assert.ok(id);assert.equal(now,60000);assert.equal(sleeps,1);
 }
});
test('header allowance and cooldown are honored together and daily limits never sleep',async()=>{
 let now=0;const q=createGroqQuota(memoryQuotaStore(),()=>now);const seed=await q.reserve(100);await q.settle(seed,1,new Headers({'x-ratelimit-remaining-tokens':'1','x-ratelimit-reset-tokens':'1s'}));await q.cooldown(61000);now=59000;
 await reserveBeforeDeadline(q,2,{deadline:65000,signal:new AbortController().signal,now:()=>now,sleep:async ms=>{assert.equal(ms,2000);now+=ms;}});assert.equal(now,61000);
 for(const limit of [{rpd:1},{tpd:100}]){const daily=createGroqQuota(memoryQuotaStore(),()=>0,settings(limit)),id=await daily.reserve(80);await daily.settle(id,80);await assert.rejects(reserveBeforeDeadline(daily,30,{deadline:999999,signal:new AbortController().signal,now:()=>0,sleep:async()=>assert.fail('No daily-limit waiting')}),e=>e instanceof RateLimitError&&['rpd','tpd'].includes(e.quotaReason)&&e.retryAfterSeconds===86400);}
});
test('known expiry beyond deadline returns 429 with safe retry guidance, cancellation does not reserve',async()=>{
 let now=0;const store=memoryQuotaStore(),q=createGroqQuota(store,()=>now,settings({tpm:100})),id=await q.reserve(80);await q.settle(id,80);now=59000;
 let error:unknown;try{await reserveBeforeDeadline(q,30,{deadline:59500,signal:new AbortController().signal,now:()=>now,sleep:async()=>assert.fail('Impossible deadline must not sleep')});}catch(e){error=e;}
 assert.ok(error instanceof RateLimitError);assert.deepEqual(rateLimitGuidance(error).headers,{'Retry-After':'1'});assert.equal(rateLimitGuidance(error).body.rateLimitOrigin,'local');
 const controller=new AbortController();await assert.rejects(reserveBeforeDeadline(q,30,{deadline:62000,signal:controller.signal,now:()=>now,sleep:async()=>{controller.abort();controller.signal.throwIfAborted();}}),{name:'AbortError'});
 await store.transact(s=>assert.equal(s.entries.length,1));
});
test('pending work is rechecked at bounded intervals; deadline and unknown charge are preserved',async()=>{
 let now=0,sleeps=0;const store=memoryQuotaStore(),q=createGroqQuota(store,()=>now,settings({tpm:100}));await q.reserve(80);
 await assert.rejects(reserveBeforeDeadline(q,30,{deadline:2500,signal:new AbortController().signal,now:()=>now,sleep:async ms=>{sleeps++;assert.equal(ms,1000);now+=ms;}}),{status:429});assert.equal(sleeps,2);await store.transact(s=>{assert.equal(s.entries.length,1);assert.equal(s.entries[0].pending,true);});
});
test('concurrent waiters recheck atomically and a settled refund can release capacity early',async()=>{
 let now=0;const store=memoryQuotaStore(),q=createGroqQuota(store,()=>now,settings({tpm:100}));const seed=await q.reserve(100);await q.settle(seed,100);now=59000;
 const waits:Array<{at:number;resolve:()=>void}>=[];const options={deadline:65000,signal:new AbortController().signal,now:()=>now,sleep:(ms:number)=>new Promise<void>(resolve=>waits.push({at:now+ms,resolve}))};
 const a=reserveBeforeDeadline(q,60,options),b=reserveBeforeDeadline(q,60,options);await flush();assert.equal(waits.length,2);
 now=60000;waits.splice(0).forEach(w=>w.resolve());await flush();const first=await a;assert.equal(waits.length,1);await store.transact(s=>assert.equal(s.entries.filter(e=>e.pending).length,1));await q.settle(first,0);now=61000;waits.splice(0).forEach(w=>w.resolve());const second=await b;assert.ok(second);await q.settle(second,60);
});
test('RAG questions share real transport admission waiting and preserve verified PDF/DOCX citations',async()=>{
 const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional',GROQ_MODEL:'openai/gpt-oss-120b'});
 let now=0,calls=0,slept=0;const store=memoryQuotaStore(),q=createGroqQuota(store,()=>now);const seed=await q.reserve(8000);await q.settle(seed,8000);now=59000;
 let fact='Fictional leave allowance is 18 days.';const provider=createGroqTransport({rpm:12,quota:q,clock:{now:()=>now,sleep:async ms=>{slept+=ms;await store.transact(s=>assert.equal(s.entries.filter(e=>e.pending).length,0));now+=ms;}},fetch:async()=>{calls++;return Response.json({id:'fixture',created:1,model:'openai/gpt-oss-120b',choices:[{index:0,message:{role:'assistant',content:JSON.stringify({answerable:true,statements:[{text:fact,citations:[{sourceId:'S1',quoteId:'Q1'}]}]})},finish_reason:'stop'}],usage:{total_tokens:100}});}});
 try{for(const [index,question]of ['Explain the leave allowance.','What is the returns period?','State the reimbursement ceiling.'].entries()){
  fact=['Fictional leave allowance is 18 days.','Returns are accepted within 21 days.','The reimbursement ceiling is 85 credits.'][index];const handler=createChatHandler({getConfig:()=>({minSimilarity:.5}),search:async()=>[{document_id:'1',chunk_id:'2',filename:index%2?'fictional.docx':'fictional.pdf',chunk_index:0,page_number:1,chunk_text:fact,similarity:.9}],generate:generateEvidenceAnswer});
  const response=await runWithIdentity('1',()=>withGroqTransport(provider,()=>handler(new Request('http://fixture/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question})}))));assert.equal(response.status,200);const body=await response.json();assert.equal(body.grounded,true);assert.ok(body.answer.includes('[S1]'));assert.equal(body.sources[0].quotes.every((q:string)=>body.sources[0].text.includes(q)),true);
 }assert.equal(calls,3);assert.ok(slept>=1000);
 const missing=createChatHandler({getConfig:()=>({minSimilarity:.5}),search:async()=>[],generate:async()=>assert.fail('No provider for absent evidence')});assert.equal((await (await missing(new Request('http://fixture/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'Unknown office?'})}))).json()).grounded,false);
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
test('stage deadline reserves response time and yields local 429 without any provider dispatch',async()=>{
 let now=0,calls=0;const q=createGroqQuota(memoryQuotaStore(),()=>now),id=await q.reserve(8000);await q.settle(id,8000);now=59000;
 const transport=createGroqTransport({rpm:12,quota:q,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async()=>{calls++;return Response.json({});}});
 await assert.rejects(withProviderDeadline(Date.now()+10500,()=>transport('https://api.groq.com/openai/v1/chat/completions',{body:JSON.stringify({max_tokens:100,messages:[]})})),{status:429,rateLimitOrigin:'local'});assert.equal(calls,0);
});
test('both API modes expose safe local/provider origin and Retry-After without raw admission details',async()=>{
 const {mock}=await import('node:test'),{POST}=await import('../app/api/agent/route'),{default:pool}=await import('../src/lib/db'),{sessionHeaders,sessionRow}=await import('./test-context');
 const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL','NODE_ENV','APP_ORIGIN'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional',GROQ_MODEL:'openai/gpt-oss-120b',NODE_ENV:'test',APP_ORIGIN:'http://localhost:3000'});
 const auth=mock.method(pool,'query',async()=>({rows:[sessionRow]})),connect=mock.method(pool,'connect',async()=>({query:async()=>({rows:[]}),release:()=>{}}));
 try{for(const origin of ['local','provider'] as const){const failure=new RateLimitError(origin,origin==='local'?'tpd':'provider_429',120);
  const request=()=>new Request('http://localhost:3000/api/agent',{method:'POST',headers:{...sessionHeaders,'Content-Type':'application/json'},body:JSON.stringify({question:'Explain available fictional evidence.'})});
  const rag=createChatHandler({getConfig:()=>({minSimilarity:.5}),search:async()=>[{document_id:'1',chunk_id:'2',filename:'fixture.pdf',chunk_index:0,page_number:1,chunk_text:'Fictional evidence.',similarity:.9}],generate:async()=>{throw failure;}});
  for(const response of [await rag(request()),await withGroqTransport(async()=>{throw failure;},()=>POST(request()))]){assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'120');const body=await response.json();assert.equal(body.code,'PROVIDER_RATE_LIMITED');assert.equal(body.rateLimitOrigin,origin);assert.equal(body.retryAfterSeconds,120);assert.equal('admission' in body,false);}
 }}finally{auth.mock.restore();connect.mock.restore();for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});

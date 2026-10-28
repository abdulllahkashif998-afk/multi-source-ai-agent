import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {createProviderTransport} from '../src/lib/provider-transport';
import {safeError,withRequest} from '../src/lib/reliability';
import {createChatHandler} from '../src/lib/chat-handler';
import {ChatError} from '../src/lib/chat-errors';
import {generateEmbedding} from '../src/lib/embeddings';
import {searchDocuments} from '../src/lib/search-documents';
import {createAgentSession} from '../src/lib/agent-tools';
import {createAgentTrace} from '../src/lib/agent-diagnostics';
import {authenticated} from '../src/lib/auth';
import {runWithIdentity} from '../src/lib/identity';
import pool from '../src/lib/db';
export type OperationalStage='authentication'|'database'|'embedding'|'retrieval'|'tools'|'provider'|'generation';
export interface FaultResult {id:string;stage:OperationalStage;kind:'simulated';passed:boolean;observed:Record<string,unknown>;error?:ReturnType<typeof safeError>}
const secret='fictional-sensitive-content-never-log';
const request=()=>new Request('http://evaluation.invalid/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'Fictional minimum target?'})});
const row={document_id:'1',chunk_id:'101',filename:'team-policy.docx',chunk_index:0,page_number:null,chunk_text:'The minimum target is 15 units.',similarity:.9};
function transport(provider:'gemini'|'groq',responses:Array<Response|Error>,rpm=12){
 let now=0;const starts:number[]=[];
 const fetch=createProviderTransport({provider,rpm,clock:{now:()=>now,sleep:async(ms,signal)=>{signal?.throwIfAborted();now+=ms;}},fetch:async()=>{starts.push(now);const next=responses.shift();if(next instanceof Error)throw next;assert.ok(next);return next;}});
 return {fetch,starts,advance:(value:number)=>{now=value;}};
}
export async function runFaultScenarios(){
 const results:FaultResult[]=[],lines:string[]=[];const originalInfo=console.info,originalFetch=globalThis.fetch;
 console.info=(...args:unknown[])=>{lines.push(args.join(' '));};
 globalThis.fetch=async()=>{throw Error('Fault suite blocks all network');};
 async function scenario(id:string,stage:OperationalStage,work:()=>Promise<Record<string,unknown>>){
 try{results.push({id,stage,kind:'simulated',passed:true,observed:await work()});}catch(error){results.push({id,stage,kind:'simulated',passed:false,observed:{},error:safeError(error)});}
 }
 try{
 for(const provider of ['gemini','groq'] as const){
 await scenario(`${provider}-429-recovery`,'provider',async()=>{const f=transport(provider,[new Response(secret,{status:429,headers:{'Retry-After':'6'}}),Response.json({ok:true}),Response.json({ok:true})]);assert.equal((await f.fetch('https://provider.invalid')).status,200);await f.fetch('https://provider.invalid');assert.deepEqual(f.starts,[0,6000,11000]);return {attempts:3,simulatedStartsMs:f.starts,recovery:true};});
 await scenario(`${provider}-persistent-429`,'provider',async()=>{const f=transport(provider,[new Response(secret,{status:429}),new Response(secret,{status:429})]);await assert.rejects(f.fetch('https://provider.invalid'),{code:'PROVIDER_RATE_LIMITED',status:429});assert.equal(f.starts.length,2);return {attempts:2,safeStatus:429};});
 await scenario(`${provider}-long-cooldown`,'provider',async()=>{const f=transport(provider,[new Response(secret,{status:429,headers:{'Retry-After':'120'}})]);await assert.rejects(f.fetch('https://provider.invalid'),{status:429});await assert.rejects(f.fetch('https://provider.invalid'),{status:429});assert.equal(f.starts.length,1);return {attempts:1,subsequentCallRejected:true};});
 for(const status of [403,503])await scenario(`${provider}-${status}-no-retry`,'provider',async()=>{const f=transport(provider,[new Response(secret,{status})]);assert.equal((await f.fetch('https://provider.invalid')).status,status);assert.equal(f.starts.length,1);return {attempts:1,transportStatus:status};});
 await scenario(`${provider}-connection-no-retry`,'provider',async()=>{const f=transport(provider,[Object.assign(Error(secret),{code:'ECONNRESET'})]);await assert.rejects(f.fetch('https://provider.invalid'));assert.equal(f.starts.length,1);return {attempts:1,retried:false};});
 await scenario(`${provider}-deadline-prevents-retry`,'provider',async()=>{let now=0,calls=0;const fetch=createProviderTransport({provider,rpm:12,clock:{now:()=>now,sleep:async(ms)=>{now+=ms;}},fetch:async()=>{calls++;now=29000;return new Response('',{status:429});}});await assert.rejects(fetch('https://provider.invalid'),{status:429});assert.equal(calls,1);return {attempts:1,simulatedElapsedMs:now};});
 await scenario(`${provider}-cancel-before-call`,'provider',async()=>{const f=transport(provider,[]);await assert.rejects(f.fetch('https://provider.invalid',{signal:AbortSignal.abort()}));assert.equal(f.starts.length,0);return {attempts:0};});
 await scenario(`${provider}-bounded-queue-cancellation`,'provider',async()=>{
 let calls=0;const fetch=createProviderTransport({provider,rpm:12,clock:{now:()=>0,sleep:async(_ms,signal)=>new Promise<void>((_,reject)=>{signal?.addEventListener('abort',()=>reject(signal.reason),{once:true});})},fetch:async()=>{calls++;return Response.json({ok:true});}});
 await fetch('https://provider.invalid');const controller=new AbortController();const pending=Array.from({length:8},()=>fetch('https://provider.invalid',{signal:controller.signal}));
 await assert.rejects(fetch('https://provider.invalid'),{status:429});controller.abort();const ended=await Promise.allSettled(pending);assert.ok(ended.every(r=>r.status==='rejected'));assert.equal(calls,1);return {pending:8,overflowStatus:429,cancelled:8,attempts:1};
 });
 await scenario(`${provider}-queue-wait-budget`,'provider',async()=>{const f=transport(provider,[Response.json({ok:true})],6);await f.fetch('https://provider.invalid');await assert.rejects(f.fetch('https://provider.invalid'),{status:429});assert.equal(f.starts.length,1);return {rpm:6,requiredSpacingMs:10000,queueWaitBudgetMs:10000,attempts:1,rejectedAtBudgetBoundary:true};});
 }
 await scenario('gemini-confirmed-access-denial','provider',async()=>{const f=transport('gemini',[Response.json({error:{code:403,status:'PERMISSION_DENIED',message:`The Gemini API free tier is not available for this project. ${secret}`}},{status:403})]);await assert.rejects(f.fetch('https://provider.invalid'),{code:'PROVIDER_BILLING_REQUIRED',status:503});return {attempts:f.starts.length,safeStatus:503};});
 await scenario('request-context-deadline','provider',async()=>{const f=transport('groq',[]);await withRequest(request(),async()=>{
 // Advance the injected clock to the final 500 ms of the real request deadline.
 f.advance(Date.now()+59500);await assert.rejects(f.fetch('https://provider.invalid'),{status:429});return Response.json({ok:true});});assert.equal(f.starts.length,0);return {attempts:0,rejectedBeforeRequestDeadline:true};});
 await scenario('missing-session-stops-handler','authentication',async()=>{let invoked=false;const response=await authenticated(async()=>{invoked=true;return Response.json({ok:true});})(request());assert.equal(response.status,401);assert.equal(invoked,false);assert.match(response.headers.get('X-Request-ID')!,/^[0-9a-f-]{36}$/);return {status:401,downstreamInvoked:false};});
 await scenario('ollama-unavailable-chat-error','embedding',async()=>{globalThis.fetch=async()=>{throw Object.assign(Error(secret),{code:'ECONNREFUSED'});};try{
 const response=await createChatHandler({getConfig:()=>({minSimilarity:.5}),search:async(_q,s)=>{await generateEmbedding('Fictional text',s);return [];},generate:async()=>assert.fail('no generation after embedding error')})(request());assert.equal(response.status,503);const data=await response.json();assert.equal(data.code,'RETRIEVAL_FAILED');assert.ok(!JSON.stringify(data).includes(secret));return {status:503,code:data.code};}finally{globalThis.fetch=async()=>{throw Error('Network blocked');};}});
 await scenario('postgres-unavailable-retrieval-error','database',async()=>{globalThis.fetch=async()=>Response.json({embeddings:[Array(768).fill(.1)]});const q=mock.method(pool,'query',async()=>{throw Object.assign(Error(secret),{code:'ECONNREFUSED'});});try{
 const response=await runWithIdentity('900001',()=>createChatHandler({getConfig:()=>({minSimilarity:.5}),search:(q,s)=>searchDocuments(q,s),generate:async()=>assert.fail('no generation after SQL error')})(request()));const body=await response.json();assert.equal(response.status,503);assert.equal(body.code,'RETRIEVAL_FAILED');assert.ok(!JSON.stringify(body).includes(secret));return {status:503,code:body.code};
 }finally{q.mock.restore();globalThis.fetch=async()=>{throw Error('Network blocked');};}});
 await scenario('retrieval-cancel-before-work','retrieval',async()=>{let called=false;globalThis.fetch=async()=>{called=true;return Response.json({});};try{await assert.rejects(runWithIdentity('900001',()=>searchDocuments('Question',AbortSignal.abort())));assert.equal(called,false);return {embeddingInvoked:false};}finally{globalThis.fetch=async()=>{throw Error('Network blocked');};}});
 await scenario('embedding-timeout-propagation','embedding',async()=>{globalThis.fetch=async(_url,init)=>{assert.ok(init?.signal);throw new DOMException(secret,'TimeoutError');};try{const response=await createChatHandler({getConfig:()=>({minSimilarity:.5}),search:async(_q,s)=>{await generateEmbedding('Fictional',s);return [];},generate:async()=>assert.fail('no generation')})(request());assert.equal(response.status,504);const data=await response.json();assert.equal(data.code,'CHAT_TIMEOUT');assert.ok(!JSON.stringify(data).includes(secret));return {status:504,code:data.code,timeoutInjected:true};}finally{globalThis.fetch=async()=>{throw Error('Network blocked');};}});
 for(const failure of [new ChatError('PROVIDER_RATE_LIMITED','The answer service is busy. Please retry shortly.',429),Object.assign(Error(secret),{statusCode:403}),Object.assign(Error(secret),{statusCode:503}),new DOMException(secret,'TimeoutError')])await scenario(`generation-${failure instanceof ChatError?429:'statusCode' in failure?failure.statusCode:'timeout'}`,'generation',async()=>{const response=await createChatHandler({getConfig:()=>({minSimilarity:.5}),search:async()=>[row],generate:async()=>{throw failure;}})(request());const data=await response.json();const expected=failure instanceof ChatError?429:failure.name==='TimeoutError'?504:502;assert.equal(response.status,expected);assert.ok(!JSON.stringify(data).includes(secret));return {status:response.status,code:data.code};});
 await scenario('tool-invalid-sort-recovery','tools',async()=>{let queries=0;const trace=createAgentTrace();const session=createAgentSession({search:async()=>[],discover:async()=>[{id:'201',filename:'fictional.csv',row_count:1,columns:[{name:'amount',type:'number'}]}],query:async()=>{queries++;return [{value:15}];}},new AbortController().signal,.5,trace);
 await session.execute('discoverDatasets',{});await session.execute('inspectDataset',{datasetId:'201'});const bad=await session.execute('queryDataset',{datasetId:'201',aggregate:{op:'sum',column:'amount'},sort:{column:'amount',direction:'asc'}});assert.ok('error' in bad);
 const ok=await session.execute('queryDataset',{datasetId:'201',aggregate:{op:'sum',column:'amount'},sort:{column:'value',direction:'asc'}});assert.ok(!('error' in ok));trace.flush('grounded');assert.equal(queries,1);assert.ok(trace.events.some(e=>e.stage==='tool'&&e.outcome==='error'));assert.ok(trace.events.some(e=>e.stage==='tool'&&e.outcome==='ok'&&e.tool==='queryDataset'));return {backendQueries:1,recovered:true};});
 await scenario('tool-call-budget-and-cancellation','tools',async()=>{const services={search:async()=>[],discover:async()=>[],query:async()=>[]};const session=createAgentSession(services,new AbortController().signal,.5);for(let i=0;i<10;i++)await session.execute('unknown',{});await assert.rejects(session.execute('unknown',{}));const cancelled=createAgentSession(services,AbortSignal.abort(),.5);await assert.rejects(cancelled.execute('discoverDatasets',{}));return {budget:10,eleventhRejected:true,cancelled:true};});
 await scenario('safe-logs-and-classification','generation',async()=>{assert.ok(!lines.join('\n').includes(secret));return {sensitiveSentinelAbsent:true,records:lines.length};});
 return results;
 }finally{console.info=originalInfo;globalThis.fetch=originalFetch;}
}

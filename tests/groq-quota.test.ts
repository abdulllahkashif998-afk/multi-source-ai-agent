import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createGroqQuota,memoryQuotaStore,estimateGroqTokens,GROQ_LIMITS,RateLimitError} from '../src/lib/groq-quota';
import {fileQuotaStore} from '../src/lib/groq-quota-store';
import {createGroqTransport} from '../src/lib/groq-transport';
import {withRequest,safeError} from '../src/lib/reliability';
const limits=(patch:Partial<typeof GROQ_LIMITS>={})=>({...GROQ_LIMITS,...patch});
const body=JSON.stringify({model:'openai/gpt-oss-20b',messages:[{role:'user',content:'A fictional question.'}],max_completion_tokens:3000});
test('model-compatible token estimation includes full JSON, framing and requested output',()=>{
 assert.ok(estimateGroqTokens(body)>3000);assert.ok(estimateGroqTokens(body)<5000);
 assert.throws(()=>estimateGroqTokens('not JSON'));assert.throws(()=>estimateGroqTokens(JSON.stringify({max_tokens:99999})),{status:429});
});
test('all four budgets account for pending work, settle usage and reset conservatively',async()=>{
 for(const [reason,cap,amount,count] of [['rpm',{rpm:1},1,1],['tpm',{tpm:10},6,1],['rpd',{rpd:1},1,1],['tpd',{tpd:10},6,1]] as const){
  let now=0;const q=createGroqQuota(memoryQuotaStore(),()=>now,limits(cap));const ids=[];for(let i=0;i<count;i++)ids.push(await q.reserve(amount));
  await assert.rejects(q.reserve(amount),(error:unknown)=>error instanceof RateLimitError&&error.quotaReason===reason);
  for(const id of ids)await q.settle(id,amount);
  now=reason.endsWith('pd')?86400001:60001;assert.ok(await q.reserve(amount));
 }
});
test('reported usage refunds unused reservations; unknown and abandoned usage retain conservative charge',async()=>{
 let now=0;const q=createGroqQuota(memoryQuotaStore(),()=>now,limits({tpm:100,tpd:120}));const a=await q.reserve(80);await q.settle(a,10);const b=await q.reserve(80);await q.settle(b,null);await assert.rejects(q.reserve(20),{quotaReason:'tpm'});
 now=60001;await assert.rejects(q.reserve(40),{quotaReason:'tpd'});
 const store=memoryQuotaStore(),pending=createGroqQuota(store,()=>now,limits({tpm:100}));await pending.reserve(80);now+=60001;await assert.rejects(pending.reserve(30),{quotaReason:'tpm'});now+=30000;await assert.rejects(pending.reserve(30),{quotaReason:'tpm'});now+=60001;assert.ok(await pending.reserve(30));
});
test('pre-dispatch cancellation releases request/token reservations; actual overrun blocks later work',async()=>{
 const q=createGroqQuota(memoryQuotaStore(),()=>0,limits({rpm:1,tpm:100}));const id=await q.reserve(90);await q.settle(id,null,undefined,false);const next=await q.reserve(90);await q.settle(next,120);await assert.rejects(q.reserve(1),{status:429});
});
test('provider remaining headers and cooldown constrain future admission without inventing day tokens',async()=>{
 let now=0;const q=createGroqQuota(memoryQuotaStore(),()=>now);const id=await q.reserve(100);await q.settle(id,10,new Headers({'x-ratelimit-remaining-tokens':'20','x-ratelimit-reset-tokens':'1m','x-ratelimit-remaining-requests':'100'}));await assert.rejects(q.reserve(30),{quotaReason:'tpm'});
 now=60001;await q.cooldown(now+5000);await assert.rejects(q.reserve(1),{quotaReason:'cooldown'});now+=5000;assert.ok(await q.reserve(1));
 const empty=await q.reserve(1);await q.settle(empty,1,new Headers({'x-ratelimit-remaining-requests':'0'}));await assert.rejects(q.reserve(1),{quotaReason:'rpd'});
});
test('clock rollback does not reset accrued limits',async()=>{
 let now=100000;const q=createGroqQuota(memoryQuotaStore(),()=>now,limits({rpd:1}));const id=await q.reserve(1);await q.settle(id,1);now=0;await assert.rejects(q.reserve(1),{quotaReason:'rpd'});
});
test('file ledger survives new instances and serializes concurrent reservations',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'quota-ledger-'));
 try{const qs=[createGroqQuota(fileQuotaStore(dir),()=>0,limits({rpd:1})),createGroqQuota(fileQuotaStore(dir),()=>0,limits({rpd:1}))];const results=await Promise.allSettled(qs.map(q=>q.reserve(5)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const restarted=createGroqQuota(fileQuotaStore(dir),()=>0,limits({rpd:1}));await assert.rejects(restarted.reserve(5),{quotaReason:'rpd'});assert.ok(!JSON.stringify(JSON.parse(await readFile(path.join(dir,'ledger.json'),'utf8'))).includes('question'));}finally{await rm(dir,{recursive:true,force:true});}
});
test('independent worker processes share one admission decision',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'quota-workers-'));
 try{const script=`import {createGroqQuota,GROQ_LIMITS} from './src/lib/groq-quota.ts';import {fileQuotaStore} from './src/lib/groq-quota-store.ts';try{await createGroqQuota(fileQuotaStore(${JSON.stringify(dir)}),()=>0,{...GROQ_LIMITS,rpd:1}).reserve(10);console.log('allowed');}catch(e){if(e.quotaReason!=='rpd')throw e;console.log('blocked');}`;const run=promisify(execFile);const outputs=await Promise.all([1,2].map(()=>run(process.execPath,['--conditions=react-server','--import','tsx','--input-type=module','-e',script])));assert.deepEqual(outputs.map(o=>o.stdout.trim()).sort(),['allowed','blocked']);}finally{await rm(dir,{recursive:true,force:true});}
});
test('corrupt state or stranded lock fails closed with safe errors',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'quota-corrupt-'));
 try{await writeFile(path.join(dir,'ledger.json'),'private invalid state');await assert.rejects(createGroqQuota(fileQuotaStore(dir)).reserve(1),error=>{assert.ok(!String(error).includes('private'));return true;});await rm(path.join(dir,'ledger.json'));await mkdir(path.join(dir,'ledger.lock'));await assert.rejects(createGroqQuota(fileQuotaStore(dir)).reserve(1),{status:503});}finally{await rm(dir,{recursive:true,force:true});}
});
test('transport reserves actual attempts, reports usage and keeps body intact',async()=>{
 let now=0,calls=0;const store=memoryQuotaStore(),quota=createGroqQuota(store,()=>now);const transport=createGroqTransport({rpm:12,quota,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async()=>{calls++;return Response.json({usage:{total_tokens:35},answer:'fictional'});}});
 await withRequest(new Request('http://localhost/api/agent'),async()=>{const r=await transport('https://api.groq.com/openai/v1/chat/completions',{method:'POST',body});assert.equal((await r.json()).answer,'fictional');return Response.json({ok:true});});assert.equal(calls,1);await store.transact(s=>{assert.equal(s.entries[0].charged,35);});
});
test('local quota errors differ from provider 429; no extra attempts for exhausted headers',async()=>{
 let now=0,calls=0;const transport=createGroqTransport({rpm:12,quota:createGroqQuota(memoryQuotaStore(),()=>now),clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'1','x-ratelimit-remaining-tokens':'0'}});}});
 await assert.rejects(transport('https://api.groq.com/openai/v1/chat/completions',{method:'POST',body}),error=>{assert.equal(safeError(error).rateLimitOrigin,'provider');return true;});assert.equal(calls,1);
 const blocked=createGroqTransport({rpm:12,quota:createGroqQuota(memoryQuotaStore(),()=>0,limits({tpm:1})),fetch:async()=>assert.fail('no HTTP when locally denied')});await assert.rejects(blocked('https://api.groq.com/openai/v1/chat/completions',{method:'POST',body}),error=>{assert.equal(safeError(error).rateLimitOrigin,'local');return true;});
});
test('active requests remain inside the cap until their HTTP promises settle',async()=>{
 let now=0;const release:Array<()=>void>=[];const transport=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async()=>new Promise<Response>(r=>release.push(()=>r(Response.json({ok:true}))))});
 const pending=[];for(let i=0;i<8;i++){pending.push(transport('https://provider.invalid'));now+=5000;}
 await assert.rejects(transport('https://provider.invalid'),{rateLimitOrigin:'local'});assert.equal(release.length,8);release.forEach(r=>r());await Promise.all(pending);
});
test('production Groq fetch uses the durable ledger, without a quota bypass environment flag',async()=>{
 const {groqFetch}=await import('../src/lib/groq-transport');const dir=await mkdtemp(path.join(tmpdir(),'quota-production-'));const previous=process.env.GROQ_QUOTA_DIRECTORY,oldRPM=process.env.GROQ_REQUESTS_PER_MINUTE,original=globalThis.fetch;
 process.env.GROQ_QUOTA_DIRECTORY=dir;process.env.GROQ_REQUESTS_PER_MINUTE='12';let calls=0;
 globalThis.fetch=async()=>{calls++;const persisted=JSON.parse(await readFile(path.join(dir,'ledger.json'),'utf8'));assert.equal(persisted.entries.filter((e:{pending:boolean})=>e.pending).length,1);return Response.json({usage:{total_tokens:123}});};
 try{await groqFetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',body});assert.equal(calls,1);const persisted=JSON.parse(await readFile(path.join(dir,'ledger.json'),'utf8'));assert.equal(persisted.entries[0].charged,123);assert.equal(persisted.entries[0].pending,false);}finally{globalThis.fetch=original;if(previous===undefined)delete process.env.GROQ_QUOTA_DIRECTORY;else process.env.GROQ_QUOTA_DIRECTORY=previous;if(oldRPM===undefined)delete process.env.GROQ_REQUESTS_PER_MINUTE;else process.env.GROQ_REQUESTS_PER_MINUTE=oldRPM;await rm(dir,{recursive:true,force:true});}
});
test('cancelled non-cooperative HTTP stops promptly and preserves its unknown pending charge',async()=>{
 const store=memoryQuotaStore(),controller=new AbortController();let started!:()=>void;const start=new Promise<void>(r=>started=r);const transport=createGroqTransport({rpm:12,quota:createGroqQuota(store),fetch:async()=>{started();return new Promise<Response>(()=>{});}});
 const pending=transport('https://api.groq.com/openai/v1/chat/completions',{method:'POST',body,signal:controller.signal});await start;controller.abort();await assert.rejects(pending,{name:'AbortError'});await store.transact(s=>{assert.equal(s.entries.length,1);assert.equal(s.entries[0].charged,null);});
});
test('safe metrics distinguish logical model calls, HTTP retries and unknown usage',async()=>{
 const {modelInvocation}=await import('../src/lib/provider-usage');const output:string[]=[];const original=console.info;console.info=(...args)=>output.push(args.join(' '));let now=0,calls=0;
 try{const transport=createGroqTransport({rpm:12,quota:createGroqQuota(memoryQuotaStore(),()=>now),clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async()=>++calls===1?new Response('private raw error',{status:429,headers:{'retry-after':'1'}}):Response.json({usage:{total_tokens:35},private:'private response content'})});await withRequest(new Request('http://localhost/private'),async()=>{modelInvocation('groq','generation');await transport('https://api.groq.com/openai/v1/chat/completions',{method:'POST',body});return Response.json({ok:true});});const events=output.map(line=>JSON.parse(line.slice('[reliability] '.length)));const usage=events.filter(e=>e.stage==='provider-usage').at(-1);assert.equal(usage.providerAttemptCount,2);assert.equal(usage.modelCallCount,1);assert.equal(usage.requestReportedTokens,35);assert.equal(usage.requestUnknownUsageCalls,1);assert.ok(!output.join('').includes('private'));}finally{console.info=original;}
});
test('an initialized ledger losing its state file does not silently reset daily allowance',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'quota-loss-'));
 try{await createGroqQuota(fileQuotaStore(dir)).reserve(10);await rm(path.join(dir,'ledger.json'));await assert.rejects(createGroqQuota(fileQuotaStore(dir)).reserve(10),{status:503});}finally{await rm(dir,{recursive:true,force:true});}
});
test('the cap includes callers still waiting for quota admission, before any HTTP dispatch',async()=>{
 const admissions:Array<()=>void>=[];let calls=0;const controller=new AbortController();
 const quota={reserve:async()=>new Promise<ReturnType<typeof randomUUID>>(r=>admissions.push(()=>r(randomUUID()))),settle:async()=>{},cooldown:async()=>{}};
 const transport=createGroqTransport({rpm:12,quota,clock:{now:()=>0,sleep:async()=>{}},fetch:async()=>{calls++;return Response.json({usage:{total_tokens:1}});}});
 const pending=Array.from({length:8},()=>transport('https://api.groq.com/openai/v1/chat/completions',{method:'POST',body,signal:controller.signal}));await assert.rejects(transport('https://api.groq.com/openai/v1/chat/completions',{method:'POST',body}),{rateLimitOrigin:'local'});assert.equal(calls,0);assert.equal(admissions.length,8);controller.abort();admissions.forEach(r=>r());const results=await Promise.allSettled(pending);assert.ok(results.every(r=>r.status==='rejected'));assert.equal(calls,0);
});
test('quota error retained by a previous module generation remains a safe HTTP 429 at authenticated agent boundary',async()=>{
 const {groqFetch,withGroqTransport}=await import('../src/lib/groq-transport');
 const {ChatError}=await import('../src/lib/chat-errors');
 // Simulate the old constructor held by the global development transport.
 const stale=Object.assign(new Error('private arbitrary message'),{name:'ChatError',code:'PROVIDER_RATE_LIMITED',status:429,rateLimitOrigin:'local',quotaReason:'tpm'});
 assert.equal(stale instanceof ChatError,false);
 await withGroqTransport(async()=>{throw stale;},async()=>{
  await assert.rejects(groqFetch('https://api.groq.com/openai/v1/chat/completions'),e=>e instanceof ChatError&&e.status===429&&e.code==='PROVIDER_RATE_LIMITED'&&!e.message.includes('private'));
 });
 const {mock}=await import('node:test'),{POST}=await import('../app/api/agent/route'),{default:pool}=await import('../src/lib/db'),{sessionHeaders,sessionRow}=await import('./test-context');
 const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL','APP_ORIGIN','NODE_ENV'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional',GROQ_MODEL:'openai/gpt-oss-20b',APP_ORIGIN:'http://localhost:3000',NODE_ENV:'test'});
 const auth=mock.method(pool,'query',async()=>({rows:[sessionRow]}));
 try{await withGroqTransport(async()=>{throw stale;},async()=>{
  const response=await POST(new Request('http://localhost:3000/api/agent',{method:'POST',headers:{...sessionHeaders,'Content-Type':'application/json'},body:JSON.stringify({question:'Explain a fictional concept.'})}));
  assert.equal(response.status,429);assert.ok(response.headers.get('X-Request-ID'));const body=await response.json();assert.equal(body.code,'PROVIDER_RATE_LIMITED');assert.ok(!JSON.stringify(body).includes('private'));
 });}finally{auth.mock.restore();for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});

import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {runFaultScenarios} from '../evaluation/reliability-scenarios';
import {performanceOptions,timingSummary,wallClockPacing,type Timing} from '../evaluation/performance-reliability';
import {generateEmbedding} from '../src/lib/embeddings';
import {retrievalOnlyNetwork} from '../evaluation/retrieval-quality';
test('embedding requests without caller signal still have the existing 15-second service deadline',async()=>{
 const deadlines:number[]=[];const original=AbortSignal.timeout;const t=mock.method(AbortSignal,'timeout',(ms:number)=>{deadlines.push(ms);return original(ms);});
 const f=mock.method(globalThis,'fetch',async(_input:unknown,init?:RequestInit)=>{assert.ok(init?.signal instanceof AbortSignal,'optional callers must not wait indefinitely');return Response.json({embeddings:[Array(768).fill(.1)]});});
 try{assert.equal((await generateEmbedding('Fictional fixture')).length,768);assert.ok(deadlines.includes(15000));}finally{f.mock.restore();t.mock.restore();}
});
test('caller cancellation reaches embedding transport and malformed results are rejected',async()=>{
 const controller=new AbortController();const f=mock.method(globalThis,'fetch',async(_input:unknown,init?:RequestInit)=>{assert.ok(init?.signal);controller.abort();init!.signal!.throwIfAborted();return Response.json({});});
 try{await assert.rejects(generateEmbedding('Fictional',controller.signal),{name:'AbortError'});}finally{f.mock.restore();}
 for(const data of [{embeddings:[[1,2]]},{embeddings:[Array(768).fill('private-content')]},{embeddings:[Array(768).fill(null)]}]){const bad=mock.method(globalThis,'fetch',async()=>Response.json(data));try{await assert.rejects(generateEmbedding('Fictional',new AbortController().signal),/Invalid embedding/);}finally{bad.mock.restore();}}
});
test('latency distributions exclude failures and preserve honest sample counts',()=>{
 const rows:Timing[]=[1,2,3,4,100].map((ms,i)=>({component:'retrieval',iteration:i,durationMs:ms,ok:true,stages:[]}));rows.push({component:'retrieval',iteration:5,durationMs:999,ok:false,stages:[]});
 const r=timingSummary(rows).retrieval;assert.equal(r.attempted,6);assert.equal(r.failed,1);assert.equal(r.latencyMs.n,5);assert.equal(r.latencyMs.p50,3);assert.equal(r.latencyMs.p95,100);assert.equal(r.latencyMs.min,1);assert.equal(r.latencyMs.max,100);assert.deepEqual(timingSummary([]),{});
});
test('serial benchmark CLI is offline by default and rejects unbounded samples and unsafe paths',()=>{
 assert.equal(performanceOptions([]).mode,'offline');assert.equal(performanceOptions(['--mode','local','--samples','30']).samples,30);
 for(const args of [['--mode','live'],['--samples','0'],['--samples','1000'],['--samples','1.5'],['--out','storage'],['--out','docs/evaluation'],['--mode','offline','--mode','local'],['--unexpected','x']])assert.throws(()=>performanceOptions(args));
});
test('bounded fault matrix verifies both providers, cancellations, safe API errors, tools and restores shared state',async()=>{
 const f=globalThis.fetch,q= (await import('../src/lib/db')).default.query,info=console.info;
 const rows=await runFaultScenarios();assert.equal(rows.length,34);assert.ok(rows.every(r=>r.passed),JSON.stringify(rows.filter(r=>!r.passed)));assert.ok(rows.every(r=>r.kind==='simulated'));assert.ok(!JSON.stringify(rows).includes('fictional-sensitive-content-never-log'));assert.deepEqual(new Set(rows.map(r=>r.stage)),new Set(['provider','authentication','embedding','database','retrieval','generation','tools']));assert.equal(globalThis.fetch,f);assert.equal(console.info,info);assert.equal((await import('../src/lib/db')).default.query,q);
});
test('local benchmark HTTP guard blocks live providers and restores fetch after failure',async()=>{
 const original=globalThis.fetch;await assert.rejects(retrievalOnlyNetwork(async()=>fetch('https://api.groq.com/openai/v1/chat/completions')));assert.equal(globalThis.fetch,original);
});
test('real timer pacing uses injected responses, validates quota and honors early cancellation',async()=>{
 await assert.rejects(wallClockPacing('groq',30,new AbortController().signal));await assert.rejects(wallClockPacing('groq',12,AbortSignal.abort()),{name:'AbortError'});
});
test('real PostgreSQL statement timeout permits safe recovery and fixture cleanup',{skip:process.env.RUN_EVAL_DB_TESTS!=='1'},async()=>{
 const {withFixtureDatabase}=await import('../evaluation/isolation');const {cases,documents,owner}=await import('../evaluation/fixtures');const {runWithIdentity}=await import('../src/lib/identity');const {default:pool}=await import('../src/lib/db');const {queryDataset}=await import('../src/lib/generic-csv');
 const embeddings=new Map(documents.map(d=>[d.text,[1,...Array(767).fill(0)]]));const originalQuery=pool.query,originalConnect=pool.connect;let timedOut=false;
 await runWithIdentity(owner,()=>withFixtureDatabase(cases[0],embeddings,async()=>{
  await pool.query('SAVEPOINT performance_timeout_probe');
  try{await pool.query("SET LOCAL statement_timeout='20ms'");await assert.rejects(pool.query('SELECT pg_sleep(0.1)'),(error:unknown)=>{assert.equal((error as {code:string}).code,'57014');timedOut=true;return true;});}
  finally{await pool.query('ROLLBACK TO SAVEPOINT performance_timeout_probe');await pool.query('RELEASE SAVEPOINT performance_timeout_probe');}
  assert.deepEqual(await queryDataset(owner,{datasetId:'201',aggregate:{op:'count'}}),[{value:5}]);
 }));
 assert.equal(timedOut,true);assert.equal(pool.query,originalQuery);assert.equal(pool.connect,originalConnect);
});

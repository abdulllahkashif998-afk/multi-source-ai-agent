import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {cases,documents,datasets,owner} from '../evaluation/fixtures';
import {retrievalMetrics,distribution,mean,scoreAnswer,type EvalAnswer} from '../evaluation/metrics';
import {runEvaluation,summarize,type Adapter} from '../evaluation/runner';
import {mockAdapter} from '../evaluation/mock-adapter';
import {parseOptions} from '../evaluation/options';
import {redactSecrets,writeReports} from '../evaluation/report';
const c=cases[0],document=documents[0];
function valid():EvalAnswer{return {grounded:true,answer:'The minimum target is 15 units. [S1]',sources:[{id:'S1',filename:document.filename,documentId:document.id,chunkId:document.chunkId,text:document.text,quotes:[document.text]}]};}
test('evaluation corpus has exactly the requested category counts and deterministic source labels',()=>{
 assert.equal(cases.length,25);assert.equal(new Set(cases.map(c=>c.id)).size,25);
 assert.deepEqual(Object.fromEntries(['document','csv','combined','insufficient','ambiguous'].map(category=>[category,cases.filter(c=>c.category===category).length])),{document:6,csv:6,combined:6,insufficient:4,ambiguous:3});
 for(const c of cases){assert.ok(c.expectedAnswer);for(const id of c.relevantChunks)assert.ok(documents.some(d=>d.chunkId===id));for(const ref of c.expectedSources)assert.ok(ref.startsWith('doc:')||datasets.some(d=>ref===`csv:${d.id}`));}
});
test('Recall@K and Precision@K use unique hits and the correct denominators',()=>{
 const r=retrievalMetrics(['101','102','103'],['101','103','104'],2);assert.equal(r.recall,1/3);assert.equal(r.precision,.5);
 assert.equal(retrievalMetrics(['101','101','102'],['101','102'],2).precision,.5);assert.equal(retrievalMetrics(['101'],['101'],3).precision,1/3);assert.equal(retrievalMetrics([],['101'],3).recall,0);
});
test('retrieval edge cases distinguish no labels from no results and reject invalid K',()=>{
 assert.equal(retrievalMetrics(['x'],[],3).recall,null);assert.equal(retrievalMetrics([],[],3).precision,null);assert.equal(retrievalMetrics([],['a'],3).precision,0);assert.equal(retrievalMetrics(['a'],['a','a'],1).recall,1);
 for(const k of [0,-1,NaN,1.5])assert.throws(()=>retrievalMetrics([],[],k));
});
test('latency percentiles use nearest rank and missing observations are not zero',()=>{
 assert.deepEqual(distribution([]),{n:0,min:null,p50:null,p95:null,max:null,mean:null});const d=distribution([100,1,2,3,4]);assert.equal(d.p50,3);assert.equal(d.p95,100);assert.equal(distribution([NaN,-1,Infinity,5]).n,1);assert.deepEqual(mean([null,null]),{n:0,value:null});assert.deepEqual(mean([null,.5,1]),{n:2,value:.75});
});
test('valid exact quotes and numeric facts never imply automatic semantic correctness',()=>{
 const result=scoreAnswer(c,valid());assert.equal(result.automatedStatus,'pass');assert.equal(result.status,'needs-review');assert.equal(result.quoteValidity,1);assert.equal(result.sourceRecall,1);assert.equal(result.numeric[0].correct,true);
 const negated=valid();negated.answer='The minimum target is 15 units, but this requirement does not apply. [S1]';assert.equal(scoreAnswer(c,negated).status,'needs-review');
});
test('numeric checks enforce tolerances, sign and whole values; unfamiliar language needs review',()=>{
 for(const value of [150,-15,15.01]){const answer=valid();answer.answer=`The minimum target is ${value} units. [S1]`;assert.ok(scoreAnswer(c,answer).failures.includes('numeric_value_mismatch'));}
 const within=valid();within.answer='The minimum target is 15.0000001 units. [S1]';assert.equal(scoreAnswer(c,within).numeric[0].correct,true);
 const alternate=valid();alternate.answer='Fifteen units are required. [S1]';assert.equal(scoreAnswer(c,alternate).numeric[0].correct,null);assert.equal(scoreAnswer(c,alternate).status,'needs-review');alternate.answer='The minimum target is fifteen units. [S1]';assert.equal(scoreAnswer(c,alternate).numeric[0].correct,null,'citation IDs must not be extracted as numeric claims');
});
test('unknown markers, uncited sources and duplicate source IDs fail',()=>{
 const unknown=valid();unknown.answer='The minimum target is 15 units. [S99]';assert.equal(scoreAnswer(c,unknown).status,'fail');
 const duplicate=valid();duplicate.sources.push({...duplicate.sources[0]});assert.equal(scoreAnswer(c,duplicate).status,'fail');
 const uncited=valid();uncited.answer='The minimum target is 15 units.';assert.equal(scoreAnswer(c,uncited).status,'fail');
});
test('document provenance and quotes are checked against canonical fixtures rather than reported text alone',()=>{
 const forged=valid();forged.sources[0].text='Fictional fabricated policy';forged.sources[0].quotes=['Fictional fabricated policy'];assert.ok(scoreAnswer(c,forged).failures.includes('invalid_document_provenance'));
 const wrong=valid();wrong.sources[0].quotes=['Not in original document'];assert.ok(scoreAnswer(c,wrong).failures.includes('quote_not_in_evidence'));
 const page=valid();page.sources[0].pageNumber=99;assert.equal(scoreAnswer(c,page).status,'fail');
 const namespace=valid();namespace.sources[0].id='C1';namespace.answer='The minimum target is 15 units. [C1]';assert.equal(scoreAnswer(c,namespace).status,'fail');
 const foreign=valid();foreign.sources[0].documentId='91';assert.equal(scoreAnswer(c,foreign).status,'fail');
});
test('CSV sources verify known structured-plan results independently and reject SQL plans',async()=>{
 const csv=cases.find(c=>c.id==='csv-02')!;const results=await runEvaluation([csv],mockAdapter);const answer=results[0].answer as EvalAnswer;assert.equal(scoreAnswer(csv,answer).automatedStatus,'pass');
 const forged=structuredClone(answer);forged.sources[0].rows=[{value:999}];forged.sources[0].text=JSON.stringify(forged.sources[0].rows);forged.sources[0].quotes=[forged.sources[0].text];assert.ok(scoreAnswer(csv,forged).failures.includes('csv_result_mismatch'));
 const sql=structuredClone(answer);sql.sources[0].plan={datasetId:'201',sql:'SELECT 1'};assert.ok(scoreAnswer(csv,sql).failures.includes('invalid_csv_plan'));
});
test('combined answers require both expected document and CSV identities',async()=>{
 const combined=cases.find(c=>c.id==='combined-01')!;const [result]=await runEvaluation([combined],mockAdapter);const answer=result.answer as EvalAnswer;assert.equal(scoreAnswer(combined,answer).sourceRecall,1);answer.sources=answer.sources.filter(s=>s.type!=='csv');assert.ok(scoreAnswer(combined,answer).failures.includes('missing_required_source'));
});
test('canonical missing-evidence refusal passes its contract; conflict refusal still needs review',()=>{
 const refusal={grounded:false,answer:"I don't have enough evidence from the available documents and datasets to answer that question.",sources:[]};const missing=cases.find(c=>c.id==='missing-01')!,conflict=cases.find(c=>c.id==='conflict-01')!;
 assert.equal(scoreAnswer(missing,refusal).status,'pass');assert.equal(scoreAnswer(conflict,refusal).status,'needs-review');assert.equal(scoreAnswer(missing,valid()).status,'fail');
 assert.equal(scoreAnswer(missing,{...refusal,answer:'The target is 999.'}).status,'needs-review');assert.equal(scoreAnswer(missing,{...refusal,answer:'The target is 999.'}).refusalCorrect,false);
 const conflicting=documents.filter(d=>['1','7'].includes(d.id));const clarification={grounded:true,answer:'These policies disagree; which applies? [D1] [D2]',sources:conflicting.map((d,i)=>({id:`D${i+1}`,type:'document',documentId:d.id,chunkId:d.chunkId,filename:d.filename,text:d.text,quotes:[d.text]}))};assert.equal(scoreAnswer(conflict,clarification).status,'needs-review');
});
test('unsupported output shapes and unexpected abstentions fail closed',()=>{
 for(const value of [null,{answer:'something'},[],{success:false,grounded:false,answer:'No',sources:[]}])assert.equal(scoreAnswer(c,value).status,'fail');
 assert.equal(scoreAnswer(c,{grounded:false,answer:'No evidence',sources:[]}).status,'fail');
});
test('runner preserves partial retrieval/stage results across provider failures and continues',async()=>{
 const adapter:Adapter=async(test,context)=>{context.retrieval({mode:'semantic',ranked:['101'],durationMs:3});context.stage({stage:'planning-groq',durationMs:5,outcome:'error'});if(test.id===c.id)throw Object.assign(new Error('private API key and body'),{name:'AI_APICallError',statusCode:429});context.answer(valid());};
 const results=await runEvaluation([c,{...c,id:'continued'}],adapter);assert.equal(results[0].status,'fail');assert.equal(results[0].error?.httpStatus,429);assert.equal(results[0].retrieval.length,1);assert.equal(results[0].stages.length,1);assert.equal(results[1].score?.automatedStatus,'pass');assert.ok(!JSON.stringify(results).includes('private API key'));assert.equal(summarize(results).failureRate,.5);
});
test('timeouts, not-run cases and missing stages have honest denominators',async()=>{
 const timeout:Adapter=async()=>{throw new DOMException('private message','TimeoutError');};const timed=await runEvaluation([c],timeout);assert.equal(summarize(timed).timeoutRate,1);assert.equal(timed[0].answerDurationMs,null);
 const controller=new AbortController();const abort:Adapter=async(_c,context)=>{context.answer(valid());controller.abort();};const rows=await runEvaluation([c,{...c,id:'not-run'}],abort,{signal:controller.signal});const summary=summarize(rows);assert.equal(summary.executed,1);assert.equal(summary.notRun,1);assert.equal(summary.fail,0);assert.equal(summary.pass,0);assert.equal(summary.needsReview,1);
});
test('default mock run makes no network calls and labels all free-text answers for review',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>assert.fail('mock must be quota-free and offline');try{const results=await runEvaluation(cases,mockAdapter);const summary=summarize(results);assert.equal(summary.executed,25);assert.equal(summary.fail,0);assert.equal(summary.pass,4);assert.equal(summary.needsReview,21);assert.equal(summary.retrieval.semantic.latencyMs.n,0);}finally{globalThis.fetch=original;}
});
test('live opt-in is explicit and cannot be enabled by configured provider credentials alone',()=>{
 assert.equal(parseOptions([],{}).mode,'mock');assert.throws(()=>parseOptions(['--mode','live'],{GROQ_API_KEY:'configured'}));assert.throws(()=>parseOptions(['--mode','live','--cases','doc-01'],{}));assert.throws(()=>parseOptions(['--mode','live'],{ALLOW_LIVE_AI_EVAL:'1'}));assert.equal(parseOptions(['--mode','live','--cases','doc-01,doc-02'],{ALLOW_LIVE_AI_EVAL:'1'}).selected.length,1);
});
test('CLI rejects unknown/duplicate flags, invalid IDs, excess K and unsafe report destinations',()=>{
 for(const args of [['--mode','bad'],['--out','storage/uploads'],['--cases','unknown'],['--cases','doc-01,doc-01'],['--k','4'],['--limit','0'],['--mode','mock','--mode','live'],['--wat','x']])assert.throws(()=>parseOptions(args,{}));assert.equal(parseOptions(['--mode','retrieval'],{}).selected.length,19);assert.throws(()=>parseOptions(['--mode','retrieval','--cases','csv-01'],{}));
});
test('reports retain partial results, redact configured secrets and mark mock scope',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'eval-report-'));try{
 const results=await runEvaluation([c],mockAdapter);const metadata={schemaVersion:1 as const,mode:'mock' as const,qualityClaimsAllowed:false,fixtureHash:'hash',generatedAt:'fictional-secret-key',k:3,answerRetrievalMode:'hybrid' as const,node:'test',setupDurationMs:0,selectedCases:[c.id],interrupted:false};
 await writeReports(dir,metadata,results,['fictional-secret-key']);const report=await readFile(path.join(dir,'report.md'),'utf8'),data=await readFile(path.join(dir,'results.json'),'utf8');assert.ok(report.includes('NOT real AI'));assert.ok(!data.includes('fictional-secret-key'));assert.equal(JSON.parse(data).summary.needsReview,1);
 assert.equal(redactSecrets({key:'fictional-secret-key'},['fictional-secret-key']).key,'[REDACTED]');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('temporary evaluation tables and pool patches are cleaned even after an injected failure',{skip:process.env.RUN_EVAL_DB_TESTS!=='1'},async()=>{
 const {withFixtureDatabase}=await import('../evaluation/isolation');const {default:pool}=await import('../src/lib/db');const {runWithIdentity}=await import('../src/lib/identity');const {queryDataset}=await import('../src/lib/generic-csv');const originalQuery=pool.query,originalConnect=pool.connect;
 const before=(await pool.query('SELECT count(*)::int AS n FROM public.documents')).rows[0].n;
 const embeddings=new Map(documents.map(d=>[d.text,[1,...Array(767).fill(0)]]));
 await assert.rejects(runWithIdentity(owner,()=>withFixtureDatabase(c,embeddings,async()=>{
  const own=(await pool.query('SELECT count(*)::int AS n FROM documents')).rows[0].n;assert.ok(own>0);
  const rows=await Promise.all([queryDataset(owner,{datasetId:'201',aggregate:{op:'sum',column:'amount'}}),queryDataset(owner,{datasetId:'201',aggregate:{op:'count'}})]);assert.deepEqual(rows,[[{value:51}],[{value:5}]]);throw Error('injected fixture failure');
 })),/injected fixture failure/);
 assert.equal(pool.query,originalQuery);assert.equal(pool.connect,originalConnect);assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.documents')).rows[0].n,before);
});

test('database live adapter rejects missing opt-in before embedding or provider work',async()=>{
 const {databaseAdapter}=await import('../evaluation/database-adapter');const previous=process.env.ALLOW_LIVE_AI_EVAL;delete process.env.ALLOW_LIVE_AI_EVAL;
 const original=globalThis.fetch;globalThis.fetch=async()=>assert.fail('no network before opt-in');
 try{await assert.rejects(databaseAdapter('live','hybrid',new AbortController().signal),/opt-in/);}finally{globalThis.fetch=original;if(previous!==undefined)process.env.ALLOW_LIVE_AI_EVAL=previous;}
});
test('fixture setup failure rolls back and releases without patching the shared pool',async()=>{
 const {withFixtureDatabase}=await import('../evaluation/isolation');const {default:pool}=await import('../src/lib/db');const calls:string[]=[];let released=false;
 const originalQuery=pool.query;
 const connect=mock.method(pool,'connect',(async()=>({query:async(sql:string)=>{calls.push(sql);if(sql.startsWith('CREATE TEMP'))throw Error('injected setup failure');return {rows:[]};},release:()=>{released=true;}})) as unknown as typeof pool.connect);
 try{await assert.rejects(withFixtureDatabase(c,new Map(),async()=>assert.fail('must not execute callback')),/injected setup failure/);assert.equal(released,true);assert.equal(calls.at(-1),'ROLLBACK');assert.equal(pool.query,originalQuery);}finally{connect.mock.restore();}
});

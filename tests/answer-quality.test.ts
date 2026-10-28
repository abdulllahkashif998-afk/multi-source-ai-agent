import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cases,documents} from '../evaluation/fixtures';
import {oracleQuery,sameRows,independentCombinedFacts} from '../evaluation/answer-oracle';
import {evaluateAnswer,answerSummary,fixtureHash,answerHash,reviewFileSchema,dimensions,type Review} from '../evaluation/answer-quality';
import {answerOptions,answerNetwork,runAnswerQuality} from '../evaluation/answer-quality-cli';
import {mockAdapter} from '../evaluation/mock-adapter';
import {runEvaluation,type CaseResult} from '../evaluation/runner';
import type {EvalAnswer} from '../evaluation/metrics';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
const first=cases[0];
async function result(id=first.id){return (await runEvaluation([cases.find(c=>c.id===id)!],mockAdapter))[0];}
function review(r:CaseResult):Review{return {caseId:r.id,fixtureHash,answerHash:answerHash(r.answer),reviewer:'Fictional test reviewer',notes:'Synthetic annotation for unit tests only; claim and source reviewed.',dimensions:Object.fromEntries(dimensions.map(d=>[d,'pass'])) as Review['dimensions']};}
test('independent CSV oracle agrees with every unchanged authored expected calculation',()=>{
 for(const c of cases)if(c.plan)assert.ok(sameRows(oracleQuery(c.plan),c.expectedRows!,Boolean(c.plan.sort)),c.id);
 for(const c of cases.filter(c=>c.category==='combined')){const derived=independentCombinedFacts(c.id)!;for(const f of c.facts)assert.ok(Math.abs(derived[f.label]-f.value)<=f.tolerance);}
 assert.equal(fixtureHash,'898bad9f79d136390190e4917e07a94812d79346ea82ff59b906a86c68258eec');
});
test('oracle checks unregistered valid filters, grouping, average, empty sums and ordered rows',()=>{
 assert.deepEqual(oracleQuery({datasetId:'201',filters:[{column:'amount',op:'gte',value:10}],aggregate:{op:'sum',column:'amount'},groupBy:['team']}),[{team:'Alpha',value:30}]);
 assert.deepEqual(oracleQuery({datasetId:'201',aggregate:{op:'avg',column:'amount'}}),[{value:10.2}]);
 const empty={datasetId:'201',filters:[{column:'amount',op:'gt',value:1000}]};
 assert.deepEqual(oracleQuery({...empty,aggregate:{op:'sum',column:'amount'}}),[{value:null}]);assert.deepEqual(oracleQuery({...empty,aggregate:{op:'count'}}),[{value:0}]);
 assert.equal(sameRows([{value:1},{value:2}],[{value:2},{value:1}],true),false);assert.equal(sameRows([{value:1},{value:2}],[{value:2},{value:1}],false),true);
 assert.equal(sameRows([{value:1},{value:1}],[{value:1}],false),false);assert.equal(sameRows([{value:1.00000001}],[{value:1}],false),true);assert.equal(sameRows([{value:1}],[{value:null}],false),false);
});
test('oracle rejects arbitrary SQL, foreign datasets, unknown columns and incompatible aggregates',()=>{
 for(const plan of [{datasetId:'999'}, {datasetId:'201',sql:'DROP TABLE documents'}, {datasetId:'201',filters:[{column:'no',op:'eq',value:1}]},{datasetId:'201',filters:[{column:'amount',op:'eq',value:'10'}]},{datasetId:'201',aggregate:{op:'sum',column:'team'}},{datasetId:'201',groupBy:['team']},{datasetId:'201',aggregate:{op:'count'},sort:{column:'amount',direction:'asc'}}])assert.throws(()=>oracleQuery(plan));
});
test('quote membership and correct numbers never automatically approve claim entailment',async()=>{
 const r=await result();(r.answer as EvalAnswer).answer='The minimum target is 15 units but nobody needs to comply. [S1]';const j=evaluateAnswer(first,r);assert.equal(j.status,'needs-review');assert.equal(j.automatic,'pass');assert.equal(j.human,'not-reviewed');
});
test('human reviews are bound to response and fixture; hard failures cannot be overridden',async()=>{
 const r=await result(),annotation=review(r);assert.equal(evaluateAnswer(first,r,annotation).status,'pass');
 assert.equal(evaluateAnswer(first,r,{...annotation,answerHash:'stale'}).human,'stale');assert.equal(evaluateAnswer(first,r,{...annotation,fixtureHash:'changed'}).status,'needs-review');
 const bad=structuredClone(r);(bad.answer as EvalAnswer).answer='The minimum target is 999 units. [S1]';assert.equal(evaluateAnswer(first,bad,review(bad)).status,'fail');
 const failing=review(r);failing.dimensions.groundedness='fail';const j=evaluateAnswer(first,r,failing);assert.equal(j.status,'fail');assert.ok(j.categories.includes('hallucination'));
 const uncertain=review(r);uncertain.dimensions.completeness='needs-review';assert.equal(evaluateAnswer(first,r,uncertain).status,'needs-review');
 assert.throws(()=>reviewFileSchema.parse([annotation,annotation]));
});
test('missing and fabricated citations, wrong quotes and inactive corpus references fail',async()=>{
 for(const mutate of [(a:EvalAnswer)=>{a.answer='Target is 15 units. [S99]';},(a:EvalAnswer)=>{a.sources=[];},(a:EvalAnswer)=>{a.sources[0].quotes=['made up'];},(a:EvalAnswer)=>{const d=documents[6];Object.assign(a.sources[0],{documentId:d.id,chunkId:d.chunkId,filename:d.filename,text:d.text,quotes:[d.text]});}]){const r=await result();mutate(r.answer as EvalAnswer);assert.equal(evaluateAnswer(first,r).status,'fail');}
});
test('independent oracle catches forged results for plans not registered in the benchmark',async()=>{
 const c=cases.find(c=>c.id==='csv-02')!,r=await result(c.id),a=r.answer as EvalAnswer,s=a.sources[0];s.plan={datasetId:'201',filters:[{column:'amount',op:'gt',value:10}],aggregate:{op:'sum',column:'amount'}};s.rows=[{value:51}];s.text=JSON.stringify(s.rows);s.quotes=[s.text];const j=evaluateAnswer(c,r);assert.ok(j.reasons.includes('independent_csv_result_mismatch'));assert.ok(j.categories.includes('calculation_error'));
 s.rows=[{value:20}];s.text=JSON.stringify(s.rows);s.quotes=[s.text];assert.equal(evaluateAnswer(c,r).checkedCSV[0].matches,true,'row truth does not establish that plan answers the question');
});
test('refusal, conflict and combined evidence outcomes retain honest uncertainty',async()=>{
 const missing=await result('missing-01');assert.equal(evaluateAnswer(cases.find(c=>c.id===missing.id)!,missing).status,'pass');
 const conflict=await result('conflict-01');assert.equal(evaluateAnswer(cases.find(c=>c.id===conflict.id)!,conflict).status,'needs-review');
 const combined=await result('combined-01');(combined.answer as EvalAnswer).sources=(combined.answer as EvalAnswer).sources.filter(s=>s.type!=='csv');const j=evaluateAnswer(cases.find(c=>c.id===combined.id)!,combined);assert.equal(j.status,'fail');assert.ok(j.suspects.includes('tool_selection_or_citation_omission_requires_trace_review'));
});
test('safe provider failures, partial retrieval and not-run cases have separate denominators',async()=>{
 const [r]=await runEvaluation([first],async(_c,ctx)=>{ctx.retrieval({mode:'hybrid',ranked:['101'],durationMs:1});throw Object.assign(Error('private credentials'),{name:'AI_APICallError',statusCode:429});});const j=evaluateAnswer(first,r);assert.ok(j.categories.includes('provider_failure'));assert.equal(j.status,'fail');const unrun={...r,executed:false,error:null};const summary=answerSummary([j,evaluateAnswer(first,unrun)]);assert.equal(summary.executed,1);assert.equal(summary.notRun,1);assert.ok(!JSON.stringify(j).includes('private credentials'));
});
test('Groq execution requires explicit opt-in, configured provider, explicit IDs and a small cap',()=>{
 const env={ALLOW_LIVE_AI_EVAL:'1',AI_PROVIDER:'groq'};assert.equal(answerOptions([],{}).mode,'mock');assert.throws(()=>answerOptions(['--mode','live','--cases','doc-01'],{AI_PROVIDER:'groq'}));assert.throws(()=>answerOptions(['--mode','live'],env));assert.throws(()=>answerOptions(['--mode','live','--cases','doc-01'],{...env,AI_PROVIDER:'gemini'}));assert.throws(()=>answerOptions(['--mode','live','--cases','doc-01,doc-02,doc-03,doc-04','--limit','4'],env));assert.equal(answerOptions(['--mode','live','--cases','doc-01'],env).selected.length,1);assert.throws(()=>answerOptions(['--input','saved.json','--mode','live','--cases','doc-01'],env));
});
test('network guard blocks offline/provider switching and caps actual attempts including retries',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({ok:true});};const stub=globalThis.fetch;
 try{await assert.rejects(answerNetwork(false,async()=>fetch('https://api.groq.com/openai/v1/chat/completions')));assert.equal(calls,0);assert.equal(globalThis.fetch,stub);
 await answerNetwork(true,async counts=>{await assert.rejects(fetch('https://generativelanguage.googleapis.com/v1beta/models'));for(let i=0;i<12;i++)await fetch('https://api.groq.com/openai/v1/chat/completions');await assert.rejects(fetch('https://api.groq.com/openai/v1/chat/completions'));assert.equal(counts.groqAttempts,12);});assert.equal(calls,12);assert.equal(globalThis.fetch,stub);
 }finally{globalThis.fetch=original;}
});
test('offline report and saved-result review never call providers and reject changed fixture hashes',async()=>{
 const dir=await mkdtemp(path.resolve('.evaluation-results/answer-test-'));const original=globalThis.fetch;globalThis.fetch=async()=>assert.fail('must remain offline');
 try{await runAnswerQuality(['--out',dir]);const bundle=JSON.parse(await readFile(path.join(dir,'results.json'),'utf8'));assert.equal(bundle.summary.executed,25);assert.equal(bundle.summary.pass,4);assert.equal(bundle.summary.needsReview,21);assert.equal(bundle.metadata.groqAttempts,0);
 await runAnswerQuality(['--input',path.join(dir,'results.json'),'--out',path.join(dir,'review')]);const replay=JSON.parse(await readFile(path.join(dir,'review/results.json'),'utf8'));assert.equal(replay.summary.automaticPass,25);
 bundle.metadata.fixtureHash='different';await writeFile(path.join(dir,'tampered.json'),JSON.stringify(bundle));await assert.rejects(runAnswerQuality(['--input',path.join(dir,'tampered.json'),'--out',path.join(dir,'rejected')]));
 assert.ok((await readFile(path.join(dir,'report.md'),'utf8')).includes('No real AI answer accuracy'));
 }finally{globalThis.fetch=original;await rm(dir,{recursive:true,force:true});}
});
test('saved evaluation failures retain allowlisted citation diagnostics without provider calls',async()=>{
 const {safeError}=await import('../src/lib/reliability');const {CitationVerificationError}=await import('../src/lib/chat-errors');
 const dir=await mkdtemp(path.resolve('.evaluation-results/citation-replay-')),previousExit=process.exitCode;
 const original=globalThis.fetch;globalThis.fetch=async()=>assert.fail('saved replay must remain offline');
 try{
 const file=path.join(dir,'input.json');await writeFile(file,JSON.stringify({metadata:{mode:'mock',fixtureHash,generatedAt:'2026-10-28'},results:[{id:first.id,executed:true,error:safeError(new CitationVerificationError('citation_quote_not_in_source')),durationMs:1,answerDurationMs:1}]}));
 await runAnswerQuality(['--input',file,'--out',path.join(dir,'output')]);const replay=JSON.parse(await readFile(path.join(dir,'output/results.json'),'utf8'));assert.equal(replay.results[0].error.reason,'citation_quote_not_in_source');assert.equal(replay.summary.fail,1);assert.equal(replay.metadata.groqAttempts,undefined);
 }finally{globalThis.fetch=original;process.exitCode=previousExit;await rm(dir,{recursive:true,force:true});}
});

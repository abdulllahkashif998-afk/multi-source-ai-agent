import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {runWithIdentity} from '../src/lib/identity';
import {createGroqTransport,withGroqTransport} from '../src/lib/groq-transport';
import {safeError} from '../src/lib/reliability';
import {cases,documents,datasets} from '../evaluation/fixtures';
import {prepareCSV,compileCSVQuery} from '../src/lib/generic-csv';
import {oracleQuery} from '../evaluation/answer-oracle';
import {evaluateAnswer} from '../evaluation/answer-quality';
import type {CaseResult} from '../evaluation/runner';

type Step={name:string;args:unknown};
async function scripted(id:string,steps:Step[],final:unknown,check:(planning:string,generation:string)=>void,rejectPlanning=false,forceGeneral=false){
 const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL','GROQ_REQUESTS_PER_MINUTE','RAG_MIN_SIMILARITY'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional-test-key',GROQ_MODEL:'openai/gpt-oss-20b',GROQ_REQUESTS_PER_MINUTE:'12',RAG_MIN_SIMILARITY:'.5'});
 let calls=0,planning='',generation='',queries=0;
 let now=0;
 const paced=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_input,init)=>{
  calls++;const body=JSON.parse(String(init?.body));const isFinal=Boolean(body.response_format);
  if(isFinal)generation=JSON.stringify(body.messages);else planning=JSON.stringify(body.messages);
  if(rejectPlanning)return Response.json({error:{code:'tool_use_failed',message:'Fictional private content',failed_generation:'private payload'}},{status:400});
  const step=isFinal?undefined:steps[calls-1];
  return Response.json({id:'fictional',created:1,model:'openai/gpt-oss-20b',choices:[{index:0,message:{role:'assistant',content:isFinal?JSON.stringify(final):step?null:'Evidence collected.',...(step?{tool_calls:[{id:`t${calls}`,type:'function',function:{name:step.name,arguments:JSON.stringify(step.args)}}]}:{})},finish_reason:step?'tool_calls':'stop'}]});
 }});
 const services={search:async()=>documents.filter(d=>id==='ambiguous-01'?d.id==='8':id.startsWith('conflict')?['1','7'].includes(d.id):d.id===(id==='combined-05'?'4':'1')).map(d=>({document_id:d.id,chunk_id:d.chunkId,filename:d.filename,chunk_index:d.index,page_number:d.page,chunk_text:d.text,similarity:.99})),discover:async()=>datasets.map(d=>({id:d.id,filename:d.filename,row_count:prepareCSV(d.csv).rows.length,columns:prepareCSV(d.csv).columns})),query:async(plan:unknown)=>{queries++;return oracleQuery(plan);}};
 try{
  const execute=()=>runWithIdentity('900001',()=>withGroqTransport(paced,()=>answerWithAgent(cases.find(c=>c.id===id)!.question+(forceGeneral?' Explain the supplied evidence.':''),new AbortController().signal,services)));
  if(rejectPlanning){await assert.rejects(execute(),error=>{const safe=safeError(error);assert.equal(safe.httpStatus,400);assert.equal(safe.providerCode,'tool_use_failed');assert.ok(!JSON.stringify(safe).includes('private'));return true;});assert.equal(calls,1);assert.equal(queries,0);return;}
  const result=await execute();check(planning,generation);return {result,calls,queries};
 }finally{for(const key of keys){const value=previous[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}

test('agent sends explicit conflict/applicability rules and preserves canonical refusal (scripted SDK)',async()=>{
 for(const id of ['conflict-01','ambiguous-01']){
  const answer=await scripted(id,[{name:'searchDocuments',args:{question:cases.find(c=>c.id===id)!.question}}],{answerable:false,statements:[]},(planning,generation)=>{
   assert.match(planning,/department, period and entity/);assert.match(planning,/explicit effective date or precedence rule/);
   assert.match(generation,/Never invent a rule that the higher/);assert.match(generation,/operative policy remains unresolved/);assert.match(generation,/unspecified person/);
  });assert.equal(answer!.result.grounded,false);assert.deepEqual(answer!.result.sources,[]);
 }
});
test('multi-source generation receives all operands and explicit completeness instructions (scripted SDK)',async()=>{
 for(const id of ['combined-04','combined-05']){
  const c=cases.find(c=>c.id===id)!,datasetId=id==='combined-04'?'201':'202';
  const answer=await scripted(id,[{name:'searchDocuments',args:{question:c.question}},{name:'discoverDatasets',args:{}},{name:'inspectDataset',args:{datasetId}},{name:'queryDataset',args:c.plan}],{answerable:true,statements:[{text:c.expectedAnswer,citations:[{sourceId:'D1',quoteId:'Q1'},{sourceId:'C1',quoteId:'Q2'}]}]},(planning,generation)=>{
   assert.match(planning,/every requested part/);assert.match(generation,/explicit calculated difference with units/);assert.match(generation,/shortfalls/);assert.match(generation,/strict versus inclusive/);assert.match(generation,/actual query values/);
  },false,true);assert.equal(answer!.queries,1);assert.equal(answer!.result.sources.length,2);assert.equal(answer!.result.grounded,true);assert.match(answer!.result.answer,id==='combined-04'?/9 units/:/120 credits/);
 }
});
test('csv-05 valid filter/sort uses installed SDK and backend plan validation without schema change (scripted)',async()=>{
 const c=cases.find(c=>c.id==='csv-05')!;
 const plan=c.plan!;compileCSVQuery(plan,prepareCSV(datasets[0].csv).columns);
 const answer=await scripted(c.id,[{name:'discoverDatasets',args:{}},{name:'inspectDataset',args:{datasetId:'201'}},{name:'queryDataset',args:plan}],{answerable:true,statements:[{text:c.expectedAnswer,citations:[{sourceId:'C1',quoteId:'Q1'}]}]},()=>{},false,true);
 assert.equal(answer!.queries,1);assert.deepEqual(answer!.result.sources[0].type,'csv');assert.equal(answer!.result.grounded,true);
});
test('provider HTTP 400 is not retried or converted to fabricated CSV evidence',async()=>{
 await scripted('csv-05',[],{},()=>{},true,true);
});
test('safe diagnostics retain only known provider codes and never raw provider payloads',()=>{
 for(const code of ['tool_use_failed','tool_call_validation_failed','json_validate_failed'])assert.equal(safeError({name:'AI_APICallError',statusCode:400,responseBody:JSON.stringify({error:{code,message:'secret',failed_generation:'secret'}})}).providerCode,code);
 for(const responseBody of ['invalid JSON',JSON.stringify({error:{code:'private-user-content',message:'secret'}}),'x'.repeat(8193)])assert.equal(safeError({statusCode:400,responseBody}).providerCode,undefined);
 assert.equal(safeError({statusCode:403,responseBody:'{"error":{"code":"tool_use_failed"}}'}).providerCode,undefined);
});
test('conflict-02 supplemental CSV fix preserves policy requirements, provenance and original history',async()=>{
 const saved=JSON.parse(await readFile('docs/evaluation/final-live/batch-03/cumulative-results.json','utf8'));
 const entry=saved.cases.find((x:{benchmark:{id:string}})=>x.benchmark.id==='conflict-02');
 const c=cases.find(c=>c.id==='conflict-02')!,result=entry.result as CaseResult;
 assert.ok(result.score!.failures.includes('irrelevant_or_unknown_source'),'historical result is unchanged');
 const reviewed=evaluateAnswer(c,result);assert.equal(reviewed.automatic,'pass');assert.equal(reviewed.status,'needs-review');assert.equal(reviewed.human,'not-reviewed');
 assert.equal(reviewed.checkedCSV[0].matches,true);
 const missing=structuredClone(result);(missing.answer as {sources:Array<{documentId?:string}>}).sources=(missing.answer as {sources:Array<{documentId?:string}>}).sources.filter(s=>s.documentId!=='7');assert.ok(evaluateAnswer(c,missing).reasons.includes('missing_required_source'));
 const forged=structuredClone(result);const csv=(forged.answer as {sources:Array<{type:string;rows:unknown[];text:string;quotes:string[]}>}).sources.find(s=>s.type==='csv')!;csv.rows=[{team:'Beta',value:999}];csv.text=JSON.stringify(csv.rows);csv.quotes=[csv.text];assert.ok(evaluateAnswer(c,forged).reasons.includes('independent_csv_result_mismatch'));
 const unrelated=structuredClone(result);const other=(unrelated.answer as {sources:Array<{type:string;datasetId?:string;filename:string;plan?:unknown;rows?:unknown[];text:string;quotes:string[]}>}).sources.find(s=>s.type==='csv')!;other.datasetId='202';other.filename='expenses.csv';other.plan={datasetId:'202'};other.rows=oracleQuery(other.plan);other.text=JSON.stringify(other.rows);other.quotes=[other.text];assert.ok(evaluateAnswer(c,unrelated).reasons.includes('irrelevant_or_unknown_source'));
 assert.deepEqual(c.expectedSources,[]);assert.equal(c.refuse,true);
});
test('csv-05 exact filter/sort is correct and owner-scoped on isolated PostgreSQL fixtures',{skip:process.env.RUN_EVAL_DB_TESTS!=='1'},async()=>{
 const {withFixtureDatabase}=await import('../evaluation/isolation');
 const {queryDataset}=await import('../src/lib/generic-csv');
 const c=cases.find(c=>c.id==='csv-05')!;
 const embeddings=new Map(documents.map(d=>[d.text,[1,...Array(767).fill(0)]]));
 await runWithIdentity('900001',()=>withFixtureDatabase(c,embeddings,async()=>{
  assert.deepEqual(await queryDataset('900001',c.plan),c.expectedRows);
  await assert.rejects(runWithIdentity('900002',()=>queryDataset('900002',c.plan)),/Dataset unavailable/);
 }));
});

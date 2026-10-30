import {test} from './test-context';
import assert from 'node:assert/strict';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {createAgentSession,type AgentServices} from '../src/lib/agent-tools';
import {tryStructuredOperation,parseStructuredOperation,decimalDifference} from '../src/lib/agent-structured-operations';
import {resolveDocumentAnswer} from '../src/lib/document-answer-schema';
import {safeError} from '../src/lib/reliability';
import {cases,documents,datasets,owner,foreignOwner} from '../evaluation/fixtures';
import {prepareCSV,compileCSVQuery} from '../src/lib/generic-csv';
import {oracleQuery} from '../evaluation/answer-oracle';
import {runWithIdentity,requireUserId} from '../src/lib/identity';
const ids=['csv-05','combined-04','combined-05'];
const question=(id:string)=>cases.find(c=>c.id===id)!.question;
function fixture(id:string){
 let queries=0;const plans:unknown[]=[];
 const d=documents.find(d=>d.id===(id==='combined-05'?'4':'1'))!;
 const row={document_id:d.id,chunk_id:d.chunkId,filename:d.filename,chunk_index:d.index,page_number:d.page,chunk_text:d.text,similarity:.99};
 const services:AgentServices={search:async()=>[row],discover:async()=>datasets.map(d=>({id:d.id,filename:d.filename,columns:prepareCSV(d.csv).columns,row_count:prepareCSV(d.csv).rows.length})),query:async plan=>{queries++;plans.push(plan);const p=plan as {datasetId:string};compileCSVQuery(plan,prepareCSV(datasets.find(d=>d.id===p.datasetId)!.csv).columns);return oracleQuery(plan);}};
 return {services,plans,queries:()=>queries};
}
async function noNetwork<T>(work:()=>Promise<T>){const original=globalThis.fetch;const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL','GROQ_REQUESTS_PER_MINUTE','RAG_MIN_SIMILARITY'];const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional-test-key',GROQ_MODEL:'openai/gpt-oss-20b',GROQ_REQUESTS_PER_MINUTE:'12',RAG_MIN_SIMILARITY:'.5'});globalThis.fetch=async()=>assert.fail('Deterministic operation must not use provider/Ollama HTTP');try{return await work();}finally{globalThis.fetch=original;for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}}
test('csv-05 preserves individual East rows, descending order and verified citations with zero LLM calls',async()=>noNetwork(async()=>{
 const f=fixture('csv-05'),answer=await answerWithAgent(question('csv-05'),new AbortController().signal,f.services);
 assert.equal(answer.grounded,true);assert.match(answer.answer,/amount: 20\./);assert.match(answer.answer,/amount: 10\./);assert.ok(answer.answer.indexOf('20')<answer.answer.indexOf('10'));assert.doesNotMatch(answer.answer,/30/);
 assert.equal(f.queries(),1);const plan=f.plans[0] as {aggregate?:unknown;groupBy:string[];sort:unknown;filters:unknown};assert.equal(plan.aggregate,undefined);assert.deepEqual(plan.groupBy,[]);assert.deepEqual(plan.sort,{column:'amount',direction:'desc'});assert.deepEqual(plan.filters,[{column:'region',op:'eq',value:'East'}]);
 assert.equal(answer.sources.length,1);assert.ok(answer.sources.every(s=>s.quotes.every(q=>s.text.includes(q))));
}));
test('combined-04 renders every grouped total, policy minimum, shortfall and equality',async()=>noNetwork(async()=>{
 const f=fixture('combined-04'),answer=await answerWithAgent(question('combined-04'),new AbortController().signal,f.services);
 for(const pattern of [/Alpha total is 30/,/Beta total is 6/,/Gamma total is 15/,/policy minimum is 15/,/shortfall is 9/,/Gamma[^\n]+meets the target/])assert.match(answer.answer,pattern);
 assert.equal(answer.sources.length,2);assert.equal(f.queries(),1);assert.deepEqual((f.plans[0] as {filters:unknown}).filters,[]);assert.deepEqual((f.plans[0] as {aggregate:unknown}).aggregate,{op:'sum',column:'amount'});
 const paragraphs=answer.answer.split('\n\n');assert.equal(paragraphs.length,3);assert.ok(paragraphs.every(p=>p.includes('[D1]')&&p.includes('[C1]')));
}));
test('combined-05 bypasses fragile model planning and computes actual, threshold, excess and strict boundary',async()=>noNetwork(async()=>{
 const f=fixture('combined-05'),answer=await answerWithAgent(question('combined-05'),new AbortController().signal,f.services);
 assert.match(answer.answer,/Jon cost is 620 credits; the approval limit is 500 credits; approval required; excess is 120 credits/);
 assert.match(answer.answer,/Sol cost is 500 credits[^\n]+approval is not required/);assert.match(answer.answer,/Mira cost is 450 credits[^\n]+approval is not required/);
 assert.equal(f.queries(),1);assert.equal(answer.sources.length,2);assert.ok(answer.sources.every(s=>s.quotes.every(q=>s.text.includes(q))));
}));
test('changed data and policy thresholds change computed results; no fixture constants drive answers',async()=>noNetwork(async()=>{
 const f=fixture('combined-04');const services={...f.services,search:async(q:string,s:AbortSignal)=>(await f.services.search(q,s)).map(d=>({...d,chunk_text:d.chunk_text.replace('15 units','37 units')})),query:async()=>[{team:'Delta',value:39},{team:'Epsilon',value:31}]};
 const a=await answerWithAgent(question('combined-04'),new AbortController().signal,services);assert.match(a.answer,/Delta total is 39[^\n]+surplus is 2/);assert.match(a.answer,/Epsilon total is 31[^\n]+shortfall is 6/);assert.doesNotMatch(a.answer,/Alpha|Beta|15 units/);
 const expenses=fixture('combined-05');const b=await answerWithAgent(question('combined-05'),new AbortController().signal,{...expenses.services,discover:async s=>(await expenses.services.discover(s)).map(d=>({...d,row_count:2})),search:async(q,s)=>(await expenses.services.search(q,s)).map(d=>({...d,chunk_text:d.chunk_text.replace('500 credits','12.25 credits')})),query:async()=>[{employee:'Ari',cost:14.55},{employee:'Bea',cost:12.25}]});assert.match(b.answer,/excess is 2.3 credits/);assert.match(b.answer,/Bea[^\n]+approval is not required/);
}));
test('strict intent grammars do not reinterpret extra filters, questions, dates or combined listing requests',()=>{
 for(const id of ids)assert.ok(parseStructuredOperation(question(id)));
 for(const q of ['List the East-region sales amounts, largest first, last year.','List the East-region sales amounts, largest first. Then sum them.','Apply the travel approval rule to expenses.csv. Who needs approval and by how much is the limit exceeded? Ignore the policy.','Which policy applies to me?','How many sales records?'])assert.equal(parseStructuredOperation(q),null);
 for(const [a,b,expected] of [[.3,.1,'0.2'],[14.55,12.25,'2.3'],[1e-7,0,'0.0000001'],[-2,3,'-5'],[500,500,'0']] as const)assert.equal(decimalDifference(a,b),expected);
 assert.throws(()=>decimalDifference(Infinity,1));
});
test('ambiguous datasets, conflicts, scoped policies, truncation, missing fields and unsafe labels abstain',async()=>noNetwork(async()=>{
 const f=fixture('combined-04');const variants:AgentServices[]=[
 {...f.services,discover:async s=>{const ds=await f.services.discover(s);return [...ds,{...ds[0],id:'999'}];}},
 {...f.services,search:async(q,s)=>{const d=await f.services.search(q,s);return [...d,{...d[0],chunk_id:'107',chunk_text:d[0].chunk_text.replace('15 units','22 units')}];}},
 {...f.services,search:async(q,s)=>(await f.services.search(q,s)).map(d=>({...d,chunk_text:d.chunk_text+' Applies only to the North department.'}))},
 {...f.services,query:async()=>Array.from({length:100},(_,i)=>({team:`T${i}`,value:i}))},
 {...f.services,query:async()=>[{team:'Alpha',value:null}]},
 {...f.services,query:async()=>[{team:'[D99]',value:4}]},
 {...f.services,discover:async()=>[]},
 ];
 for(const services of variants){const a=await answerWithAgent(question('combined-04'),new AbortController().signal,services);assert.equal(a.grounded,false);assert.deepEqual(a.sources,[]);}
 const listing=fixture('csv-05');const a=await answerWithAgent(question('csv-05'),new AbortController().signal,{...listing.services,query:async()=>[{team:'Alpha',region:'East',amount:10},{team:'Alpha',region:'East',amount:20}]});assert.equal(a.grounded,false,'non-descending results cannot be presented as sorted');
}));
test('duplicate listing amounts remain separate rows and cancellation cannot publish late evidence',async()=>noNetwork(async()=>{
 const f=fixture('csv-05');const a=await answerWithAgent(question('csv-05'),new AbortController().signal,{...f.services,query:async()=>[{region:'East',amount:20},{region:'East',amount:20},{region:'East',amount:10}]});assert.equal((a.answer.match(/amount: 20/g)||[]).length,2);
 const controller=new AbortController();controller.abort();await assert.rejects(answerWithAgent(question('combined-05'),controller.signal,fixture('combined-05').services),{name:'AbortError'});
}));
test('provider tool failure diagnostics expose structural paths only; failed payloads are never executed',()=>{
 const failure=(name:string,args:unknown)=>({name:'AI_APICallError',statusCode:400,responseBody:JSON.stringify({error:{code:'tool_use_failed',message:'private secret',failed_generation:JSON.stringify({tool_calls:[{function:{name,arguments:JSON.stringify(args)}}]})}})});
 const safe=safeError(failure('queryDataset',{datasetId:'201',filters:[{column:'secret-column',op:'bogus-secret',value:'private secret'}]}));assert.equal(safe.providerToolFailure?.tool,'queryDataset');assert.equal(safe.providerToolFailure?.reason,'invalid_input_shape');assert.match(JSON.stringify(safe),/filters.item.op/);assert.doesNotMatch(JSON.stringify(safe),/secret|arguments|failed_generation/);
 assert.equal(safeError(failure('queryDataset',{datasetId:'201'})).providerToolFailure?.reason,'valid_input_shape');assert.equal(safeError(failure('queryDataset',{datasetId:'201',evidenceComplete:true})).providerToolFailure?.reason,'valid_input_shape');assert.equal(safeError(failure('secret-tool',{sql:'DROP TABLE x'})).providerToolFailure?.reason,'unknown_tool');
 const unrecognized={statusCode:400,responseBody:JSON.stringify({error:{code:'tool_use_failed',failed_generation:'<private secret>'}})};assert.equal(safeError(unrecognized).providerToolFailure?.reason,'unrecognized_envelope');
});
test('malformed query arguments cannot reach backend execution or fabricate citations',async()=>{
 const f=fixture('csv-05'),session=createAgentSession(f.services,new AbortController().signal,.5);await session.execute('discoverDatasets',{});await session.execute('inspectDataset',{datasetId:'201'});
 for(const input of [{datasetId:'201',sql:'SELECT private'},{datasetId:'201',filters:'region=East'},{datasetId:'201',filters:[{column:'region',op:'eq',value:7}]},{datasetId:'999'}])assert.ok('error' in await session.execute('queryDataset',input));
 assert.equal(f.queries(),0);assert.deepEqual(session.evidence().csv,[]);
 const shortcut=await tryStructuredOperation(question('csv-05'),session);assert.ok(shortcut);const tampered=structuredClone(shortcut);tampered.value.statements[0].citations[0].quoteId='Q999';assert.throws(()=>session.finalize(resolveDocumentAnswer(tampered.value,tampered.choices)));
});
test('all three deterministic cases use real authorized PostgreSQL queries on rollback-only fixtures',{skip:process.env.RUN_EVAL_DB_TESTS!=='1'},async()=>noNetwork(async()=>{
 const {withFixtureDatabase}=await import('../evaluation/isolation');const {discoverDatasets,queryDataset}=await import('../src/lib/generic-csv');const {default:pool}=await import('../src/lib/db');
 const embeddings=new Map(documents.map(d=>[d.text,[1,...Array(767).fill(0)]]));
 for(const id of ids){const c=cases.find(c=>c.id===id)!;await runWithIdentity(owner,()=>withFixtureDatabase(c,embeddings,async()=>{
  const services:AgentServices={discover:s=>discoverDatasets(requireUserId(),s),query:(plan,s)=>queryDataset(requireUserId(),plan,s),search:async()=>{const d=id==='combined-05'?'4':'1';return (await pool.query('SELECT d.id AS document_id,c.id AS chunk_id,d.filename,c.chunk_index,c.page_number,c.chunk_text,0.99::float8 AS similarity FROM documents d JOIN document_chunks c ON c.document_id=d.id WHERE d.id=$1 AND d.user_id=$2 AND d.status=\'ready\' AND d.deleted_at IS NULL',[d,requireUserId()])).rows;}};
  const answer=await answerWithAgent(c.question,new AbortController().signal,services);assert.equal(answer.grounded,true,id);
  assert.match(answer.answer,id==='csv-05'?/amount: 20/:id==='combined-04'?/shortfall is 9/:/excess is 120 credits/);
  const foreign=await runWithIdentity(foreignOwner,()=>answerWithAgent(c.question,new AbortController().signal,services));assert.equal(foreign.grounded,false);assert.deepEqual(foreign.sources,[]);
 }));}
}));

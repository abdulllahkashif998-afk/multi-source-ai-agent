import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {createAgentSession,type Dataset} from '../src/lib/agent-tools';
import {parseRoleCountQuestion,tryStructuredRoleCount} from '../src/lib/agent-structured-count';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {createAgentBudget,AGENT_TOTAL_MS,AGENT_FINAL_RESERVE_MS} from '../src/lib/agent-budget';
import {runWithIdentity} from '../src/lib/identity';
import {withRequest,requestContext} from '../src/lib/reliability';
import {createGroqTransport,withGroqTransport} from '../src/lib/groq-transport';
const filename='users-import-template (1).csv',question=`How many students and teachers are listed in ${filename}?`;
const row={document_id:'1',chunk_id:'2',filename:'fictional.pdf',chunk_index:0,page_number:null,chunk_text:'Fictional policy: minimum is 20.',similarity:.9};
function fixture(students=158,teachers=51){
 const records=[...Array(students).fill('student'),...Array(teachers).fill('teacher'),...Array(60).fill('other')];
 const dataset:Dataset={id:'31',filename,columns:[{name:'role_name',type:'text'}],row_count:records.length};let queries=0,discoveries=0;
 const services={search:async()=>[row],discover:async()=>{discoveries++;return [dataset];},query:async(plan:unknown)=>{queries++;const p=plan as {datasetId:string;aggregate:unknown;groupBy:string[]};assert.equal(p.datasetId,'31');assert.deepEqual(p.aggregate,{op:'count'});assert.deepEqual(p.groupBy,['role_name']);const counts=new Map<string,number>();for(const role of records)counts.set(role,(counts.get(role)??0)+1);return [...counts].sort(([a],[b])=>a.localeCompare(b)).map(([role_name,value])=>({role_name,value}));}};
 return {dataset,services,queries:()=>queries,discoveries:()=>discoveries};
}
async function configured<T>(work:()=>Promise<T>){
 const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL','GROQ_REQUESTS_PER_MINUTE','RAG_MIN_SIMILARITY'] as const,previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional-test-key',GROQ_MODEL:'openai/gpt-oss-20b',GROQ_REQUESTS_PER_MINUTE:'12',RAG_MIN_SIMILARITY:'.5'});
 try{return await work();}finally{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
}
test('exact failed count question computes fictional data with zero provider requests and verified CSV references',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>assert.fail('deterministic count must not use Ollama/provider');
 try{await configured(async()=>{for(const [students,teachers] of [[158,51],[2,3]]){const f=fixture(students,teachers);const answer=await runWithIdentity('4',()=>answerWithAgent(question,new AbortController().signal,f.services));assert.equal(answer.grounded,true);assert.ok(answer.answer.includes(`${students} students and ${teachers} teachers`));assert.match(answer.answer,/\[C1\]/);assert.equal(f.queries(),1);assert.equal(f.discoveries(),1);const source=answer.sources[0];assert.ok('datasetId' in source&&'rows' in source);assert.equal(source.datasetId,'31');assert.equal(source.type,'csv');assert.ok(source.quotes.every(q=>source.text.includes(q)));assert.deepEqual(source.plan,{datasetId:'31',filters:[],groupBy:['role_name'],aggregate:{op:'count'},sort:{column:'role_name',direction:'asc'},limit:100});}});}finally{globalThis.fetch=original;}
});
test('structured count parser refuses filters, combined reasoning and unclear categories',()=>{
 assert.deepEqual(parseRoleCountQuestion(question),{filename,categories:['student','teacher']});
 for(const q of [`How many active students and teachers are listed in ${filename}?`,`How many students are listed in ${filename} according to policy.docx?`,`How many students and teachers are listed in ${filename} last year?`,`What is the policy?`,`How many customers are listed in ${filename}?`])assert.equal(parseRoleCountQuestion(q),null);
});
test('count shortcut does not guess duplicate datasets, role columns, absent categories or truncated data',async()=>{
 const f=fixture();const base=f.services;const scenarios=[{...base,discover:async()=>[f.dataset,{...f.dataset,id:'32'}]}, {...base,discover:async()=>[{...f.dataset,columns:[...f.dataset.columns,{name:'role',type:'text' as const}]}]}, {...base,discover:async()=>[{...f.dataset,filename:'foreign.csv'}]}, {...base,query:async()=>[{role_name:'teacher',value:269}]}, {...base,query:async()=>Array.from({length:100},(_,i)=>({role_name:`role-${i}`,value:1}))}];
 for(const services of scenarios){const s=createAgentSession(services,new AbortController().signal,.5);assert.equal(await tryStructuredRoleCount(question,s),null);}
});
test('request-local cache reuses discovery, identical searches and normalized plans without duplicating citations',async()=>{
 const f=fixture();let searches=0;const services={...f.services,search:async()=>{searches++;return [row];}};const s=createAgentSession(services,new AbortController().signal,.5);
 const first=await s.execute('searchDocuments',{question:'Same question'});await s.execute('searchDocuments',{question:'Same question'});assert.equal(searches,1);assert.equal(s.evidence().documents.length,1);assert.ok(first&&typeof first==='object'&&'sources' in first);
 await s.execute('discoverDatasets',{});await s.execute('discoverDatasets',{});await s.execute('inspectDataset',{datasetId:'31'});
 const a=await s.execute('queryDataset',{datasetId:'31',aggregate:{op:'count'},groupBy:['role_name']});const b=await s.execute('queryDataset',{groupBy:['role_name'],aggregate:{op:'count'},datasetId:'31',filters:[],limit:100});assert.deepEqual(a,b);assert.equal(f.queries(),1);assert.equal(f.discoveries(),1);assert.equal(s.evidence().csv.length,1);
 const other=createAgentSession(services,new AbortController().signal,.5);await other.execute('searchDocuments',{question:'Same question'});assert.equal(searches,2,'cache is never shared across sessions');
});
test('cache single-flight is mutation-safe and failures can recover',async()=>{
 let searches=0;const services={search:async()=>{searches++;if(searches===1)throw Error('Fictional outage');return [row];},discover:async()=>[],query:async()=>[]};const s=createAgentSession(services,new AbortController().signal,.5);
 assert.ok('error' in await s.execute('searchDocuments',{question:'Retry'}));const [a,b]=await Promise.all([s.execute('searchDocuments',{question:'Retry'}),s.execute('searchDocuments',{question:'Retry'})]);assert.deepEqual(a,b);assert.equal(searches,2);assert.ok('sources' in a);a.sources[0].text='Changed externally';const c=await s.execute('searchDocuments',{question:'Retry'});assert.ok('sources' in c);assert.equal(c.sources[0].text,row.chunk_text);assert.equal(s.evidence().documents[0].text,row.chunk_text);
});
test('cancelled non-cooperative tools stop waiting and never publish late evidence',async()=>{
 const controller=new AbortController();let resolve:(value:typeof row[])=>void=()=>{};
 const s=createAgentSession({search:async()=>new Promise<typeof row[]>(r=>{resolve=r;}),discover:async()=>[],query:async()=>[]},controller.signal,.5);
 const pending=s.execute('searchDocuments',{question:'Slow'});await new Promise(setImmediate);controller.abort();await assert.rejects(pending,{name:'AbortError'});resolve([row]);await new Promise(setImmediate);assert.equal(s.evidence().documents.length,0);
 const live=createAgentSession({search:async()=>[row],discover:async()=>[],query:async()=>[]},new AbortController().signal,.5);await assert.rejects(live.execute('searchDocuments',{question:'Child'},AbortSignal.abort()),{name:'AbortError'});assert.equal(live.evidence().documents.length,0);
});
test('validated count mistakes return safe corrective guidance and cannot execute SQL',async()=>{
 const f=fixture(),s=createAgentSession(f.services,new AbortController().signal,.5);await s.execute('discoverDatasets',{});await s.execute('inspectDataset',{datasetId:'31'});
 const invalid=await s.execute('queryDataset',{datasetId:'31',aggregate:{op:'count',column:'role_name'}});assert.ok('error' in invalid);assert.match(invalid.error??'',/without column/);assert.equal(f.queries(),0);
 await s.execute('queryDataset',{datasetId:'other',aggregate:{op:'count'}});assert.equal(f.queries(),0);
 await s.execute('queryDataset',{datasetId:'31',aggregate:{op:'count'},groupBy:['role_name']});assert.equal(f.queries(),1);
});
test('budget preserves the 60-second ceiling, reserves generation time and expires immediately when exhausted',async()=>{
 const b=createAgentBudget(new AbortController().signal,1000);assert.equal(b.deadline,1000+AGENT_TOTAL_MS);assert.equal(AGENT_FINAL_RESERVE_MS,15000);assert.equal(createAgentBudget(AbortSignal.abort()).signal.aborted,true);
 await withRequest(new Request('http://localhost/api/agent'),async()=>{const deadline=requestContext()!.deadline;const shortened=createAgentBudget(new AbortController().signal,deadline-1000);assert.equal(shortened.deadline,deadline);assert.equal(shortened.planningSignal.aborted,true);const expired=createAgentBudget(new AbortController().signal,deadline+1);assert.equal(expired.signal.aborted,true);return Response.json({ok:true});});
});
test('installed SDK planner can cross 30 simulated seconds while each step and whole request remain bounded',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:0});
 await configured(async()=>{let calls=0,queries=0;const steps=[{name:'discoverDatasets',args:{}},{name:'inspectDataset',args:{datasetId:'31'}},{name:'queryDataset',args:{datasetId:'31',aggregate:{op:'count',column:'role_name'}}},{name:'queryDataset',args:{datasetId:'31',aggregate:{op:'count'},groupBy:['role_name']}},{name:'queryDataset',args:{datasetId:'31',aggregate:{op:'count'},groupBy:['role_name']}},{name:'inspectDataset',args:{datasetId:'31'}}];
 const provider=createGroqTransport({rpm:12,clock:{now:Date.now,sleep:async(ms,signal)=>{signal?.throwIfAborted();t.mock.timers.tick(ms);}},fetch:async(_url,init)=>{calls++;t.mock.timers.tick(1000);const body=JSON.parse(String(init?.body)),final=!!body.response_format,step=final?undefined:steps[calls-1];return Response.json({id:'fictional',created:1,model:'openai/gpt-oss-20b',choices:[{index:0,message:{role:'assistant',content:final?JSON.stringify({answerable:true,statements:[{text:'The count is 2.',citations:[{sourceId:'C1',quoteId:'Q1'}]}]}):step?null:'Evidence gathered.',...(step?{tool_calls:[{id:`t${calls}`,type:'function',function:{name:step.name,arguments:JSON.stringify(step.args)}}]}:{})},finish_reason:step?'tool_calls':'stop'}]});}});
 const result=await runWithIdentity('4',()=>withGroqTransport(provider,()=>answerWithAgent('Compare category counts and explain the dataset.',new AbortController().signal,{search:async()=>[],discover:async()=>[{id:'31',filename:'fictional.csv',columns:[{name:'role_name',type:'text'}],row_count:2}],query:async()=>{queries++;return [{role_name:'student',value:2}];}})));
 assert.equal(result.grounded,true);assert.equal(calls,8);assert.equal(queries,1);assert.ok(Date.now()>30000&&Date.now()<45000);assert.equal(result.sources[0].id,'C1');
 });
});
test('one stalled model step is still cancelled at 30 seconds with no provider retry',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:0});
 await configured(async()=>{let calls=0;const provider=createGroqTransport({rpm:12,clock:{now:Date.now,sleep:async(ms)=>{t.mock.timers.tick(ms);}},fetch:async(_url,init)=>{calls++;t.mock.timers.tick(30001);init?.signal?.throwIfAborted();return Response.json({});}});
 await assert.rejects(runWithIdentity('4',()=>withGroqTransport(provider,()=>answerWithAgent('Explain a fictional document.',new AbortController().signal,{search:async()=>assert.fail('no tool after timed-out model'),discover:async()=>[],query:async()=>[]}))),{name:'TimeoutError'});assert.equal(calls,1);
 });
});
test('cancelled CSV service checks prevent a row query and still roll back/release',async()=>{
 const {default:pool}=await import('../src/lib/db');const {queryDataset}=await import('../src/lib/generic-csv');const controller=new AbortController();const calls:string[]=[];let released=false;
 const connection=mock.method(pool,'connect',async()=>({query:async(sql:string)=>{calls.push(sql);if(sql.startsWith('SELECT columns')){controller.abort();return {rows:[{columns:[{name:'role_name',type:'text'}]}]};}return {rows:[]};},release:()=>{released=true;}}));
 try{await assert.rejects(runWithIdentity('4',()=>queryDataset('4',{datasetId:'31',aggregate:{op:'count'}},controller.signal)),{name:'AbortError'});assert.ok(!calls.some(s=>s.includes('FROM generic_csv_rows')));assert.equal(calls.at(-1),'ROLLBACK');assert.equal(released,true);}finally{connection.mock.restore();}
});
test('authenticated count route keeps session, CSRF and owner checks before real service compilation',async()=>{
 const {POST}=await import('../app/api/agent/route');const {default:pool}=await import('../src/lib/db');const {sessionHeaders,sessionRow}=await import('./test-context');
 const originalFetch=globalThis.fetch,oldNode=process.env.NODE_ENV,oldOrigin=process.env.APP_ORIGIN;globalThis.fetch=async()=>assert.fail('no HTTP needed for deterministic answer');Object.assign(process.env,{NODE_ENV:'test',APP_ORIGIN:'http://localhost:3000'});
 let dataQueries=0,connections=0;const auth=mock.method(pool,'query',async(sql:unknown)=>{assert.ok(String(sql).startsWith('SELECT s.user_id'));return {rows:[sessionRow]};});
 const connection=mock.method(pool,'connect',async()=>{connections++;return {query:async(input:string|{text:string;values?:unknown[]},parameters?:unknown[])=>{const sql=typeof input==='string'?input:input.text;const values=typeof input==='string'?parameters:input.values;if(sql.includes('SELECT id,filename,columns,row_count')){assert.equal(String(values?.[0]),sessionRow.user_id);return {rows:[{id:'31',filename,columns:[{name:'role_name',type:'text'}],row_count:269}]};}if(sql.startsWith('SELECT columns')){assert.deepEqual(values,['31',sessionRow.user_id]);assert.match(sql,/user_id=\$2/);return {rows:[{columns:[{name:'role_name',type:'text'}]}]};}if(sql.includes('FROM generic_csv_rows')){dataQueries++;assert.equal(values?.[0],'31');assert.match(sql,/COUNT\(\*\)/);return {rows:[{data:{role_name:'other',value:60}},{data:{role_name:'student',value:158}},{data:{role_name:'teacher',value:51}}]};}return {rows:[]};},release:()=>{}};});
 try{await configured(async()=>{
 const request=(headers:Record<string,string>)=>new Request('http://localhost:3000/api/agent',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({question})});
 assert.equal((await POST(request({}))).status,401);assert.equal((await POST(request({...sessionHeaders,'X-CSRF-Token':''}))).status,403);assert.equal(connections,0);
 const response=await POST(request(sessionHeaders));assert.equal(response.status,200);assert.match(response.headers.get('X-Request-ID')!,/^[0-9a-f-]{36}$/);const body=await response.json();assert.equal(body.grounded,true);assert.match(body.answer,/158 students and 51 teachers/);assert.equal(dataQueries,1);
 });}finally{auth.mock.restore();connection.mock.restore();globalThis.fetch=originalFetch;for(const [k,v] of Object.entries({NODE_ENV:oldNode,APP_ORIGIN:oldOrigin})){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('exact count scenario executes against isolated real PostgreSQL fictional rows',{skip:process.env.RUN_EVAL_DB_TESTS!=='1'},async()=>{
 const {withFixtureDatabase}=await import('../evaluation/isolation');const {cases,documents,owner}=await import('../evaluation/fixtures');const {default:pool}=await import('../src/lib/db');
 const original=globalThis.fetch;globalThis.fetch=async()=>assert.fail('database acceptance must not call providers');const vectors=new Map(documents.map(d=>[d.text,[1,...Array(767).fill(0)]]));
 try{await configured(()=>runWithIdentity(owner,()=>withFixtureDatabase(cases[0],vectors,async()=>{
 const roles=[...Array(158).fill('student'),...Array(51).fill('teacher'),...Array(60).fill('other')];
 await pool.query("INSERT INTO generic_csv_datasets(id,user_id,filename,columns,status,row_count,created_at) VALUES(31,$1,$2,$3,'ready',$4,'2026-01-01T00:00:00Z')",[owner,filename,JSON.stringify([{name:'role_name',type:'text'}]),roles.length]);
 await pool.query('INSERT INTO generic_csv_rows(dataset_id,row_index,data) SELECT 31,ordinality-1,value FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY',[JSON.stringify(roles.map(role_name=>({role_name})))]);
 const result=await answerWithAgent(question,new AbortController().signal);assert.equal(result.grounded,true);assert.match(result.answer,/158 students and 51 teachers/);assert.equal(result.sources[0].id,'C1');assert.ok(result.sources[0].quotes.every(q=>result.sources[0].text.includes(q)));
 })));}finally{globalThis.fetch=original;}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePolicyContract,utcTimestamp} from '../src/lib/policy-predicates';
import {evaluatePolicyRecords} from '../src/lib/policy-record-evaluation';
import {prepareCSV} from '../src/lib/generic-csv';
import {createAgentSession,type AgentServices} from '../src/lib/agent-tools';
import {prepareAgentEvidence} from '../src/lib/agent-evidence-preparation';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {runWithIdentity,requireUserId} from '../src/lib/identity';
import {createGroqTransport,withGroqTransport} from '../src/lib/groq-transport';
import {cases,documents,owner,foreignOwner} from '../evaluation/fixtures';
const folder='docs/fixtures/northstar-applicability-lab/';
const source=readFileSync(folder+'policy-source.md','utf8');
const data=prepareCSV(readFileSync(folder+'Northstar_Applicability_Lab_Incidents.csv','utf8'));
const key=JSON.parse(readFileSync(folder+'answer-key.json','utf8'));
const filename='generic-policy.pdf';
function chunks(text=source){const result=[];for(let start=0;start<text.length;start+=400)result.push({document_id:'21',chunk_id:String(1000+start),filename,chunk_index:result.length,page_number:1,chunk_text:text.slice(start,start+500),similarity:1});return result;}
function fixture(text=source,rows:unknown[]=data.rows){const context=chunks(text),contract=parsePolicyContract(context);assert.ok(contract);let snapshots=0;
 const dataset={id:'101',filename:contract.dataset,columns:data.columns,row_count:rows.length};
 const services:AgentServices={policies:async()=>({documents:[{id:'21',filename}],truncated:false}),search:async(_q,_s,options)=>options?.completePolicy?context:[context[3]],discover:async()=>[dataset],query:async()=>assert.fail('Policy evaluation uses its single coherent snapshot'),snapshot:async()=>{snapshots++;return {dataset,rows};}};
 return {context,contract,dataset,services,snapshots:()=>snapshots};}
const question=`Using ${filename} and Northstar_Applicability_Lab_Incidents.csv, count confirmed first-response violations by priority.`;
test('explicit policy predicates classify fixture rows and reproduce independent expected sets',()=>{
 const f=fixture(),result=evaluatePolicyRecords(f.contract,data.columns,data.rows);
 for(const [status,expected] of [['applicable',key.scope.in_scope],['not_applicable',key.scope.outside_scope],['unknown',key.scope.unknown]] as const)assert.deepEqual(result.classified.filter(r=>r.scope===status).map(r=>r.identifier),expected);
 for(const [priority,ids] of Object.entries(key.first_response.late))assert.deepEqual(result.classified.filter(r=>r.priority===priority&&r.first_response==='late').map(r=>r.identifier),ids);
 assert.equal(result.rows.reduce((n,r)=>n+r.firstResponseLate,0),7);assert.equal(result.rows.reduce((n,r)=>n+r.resolutionLate,0),14);assert.equal(result.rows.reduce((n,r)=>n+r.unknownFirstResponse,0),1);
});
test('different field names, organization, dates, priority labels, numeric identifiers and explicit Boolean flags',()=>{
 const replacements:Record<string,string>={organization:'tenant',incident_at:'opened_utc',severity:'rank',ticket_id:'case_ref',response_hours:'latency',resolution_hours:'elapsed',scheduled_maintenance:'planned',maintenance_notice_hours:'notice','Northstar Fixture Operations':'Cedar Fictional Services','P1':'Critical','P2':'Elevated','P3':'Routine','2026-':'2035-','2027-':'2036-'};
 let text=source;for(const [a,b] of Object.entries(replacements))text=text.replaceAll(a,b);text=text.replaceAll('is yes','is true').replaceAll('is no,','is false,').replaceAll('at least 48','at least 12').replaceAll('Exactly 48','Exactly 12').replaceAll('below 48','below 12');
 const contract=parsePolicyContract(chunks(text));assert.ok(contract);
 const columns=data.columns.map(c=>({name:replacements[c.name]??c.name,type:c.name==='ticket_id'?'number' as const:c.name==='scheduled_maintenance'?'boolean' as const:c.type}));
 const rows=data.rows.map((r,i)=>Object.fromEntries(Object.entries(r).map(([name,v])=>[replacements[name]??name,name==='ticket_id'?i+1:name==='scheduled_maintenance'?v==='yes':name==='maintenance_notice_hours'?(v===48?12:v===24?6:v):typeof v==='string'?v.replaceAll('Northstar Fixture Operations','Cedar Fictional Services').replaceAll('2026-','2035-').replaceAll('2027-','2036-').replace(/^P1$/,'Critical').replace(/^P2$/,'Elevated').replace(/^P3$/,'Routine'):v])));
 const result=evaluatePolicyRecords(contract,columns,rows);assert.deepEqual(result.rows.map(r=>r.firstResponseLate),[2,2,3]);
});
test('strict UTC boundaries, unknown values, exclusions and equality are deterministic',()=>{
 const f=fixture(),base=data.rows[0];
 const inputs=[{...base,ticket_id:'start',incident_at:f.contract.period.startText,response_hours:1},{...base,ticket_id:'end',incident_at:f.contract.period.endText},{...base,ticket_id:'bad-date',incident_at:'2026-02-30T00:00:00Z'},{...base,ticket_id:'missing',organization:null},{...base,ticket_id:'known-out',organization:'Other',incident_at:null},{...base,ticket_id:'maintenance',response_hours:null,scheduled_maintenance:'yes',maintenance_notice_hours:48},{...base,ticket_id:'unknown-notice',scheduled_maintenance:'yes',maintenance_notice_hours:null,resolution_hours:9},{...base,ticket_id:'unknown-priority',severity:null}];
 const result=evaluatePolicyRecords(f.contract,data.columns,inputs);assert.deepEqual(result.classified.map(r=>r.scope),['applicable','not_applicable','unknown','unknown','not_applicable','applicable','applicable','applicable']);assert.equal(result.classified[0].first_response,'on_time');assert.equal(result.classified[5].first_response,'excluded');assert.equal(result.classified[6].first_response,'unknown');assert.equal(result.classified[6].resolution,'late');assert.equal(result.classified[7].first_response,'unknown');
 assert.equal(utcTimestamp('2026-10-01'),undefined);assert.equal(utcTimestamp('2026-10-01T00:00:00+00:00'),undefined);
 assert.throws(()=>evaluatePolicyRecords(f.contract,data.columns,[base,base]));assert.throws(()=>evaluatePolicyRecords(f.contract,data.columns,Array(100).fill(base)));assert.throws(()=>evaluatePolicyRecords(f.contract,data.columns.filter(c=>c.name!=='organization'),[base]));
});
test('unsupported or conflicting policy wording cannot become a supported contract',()=>{
 for(const text of [source+'\nP1 first-response deadline is 7 hours.',source+'\nEffective 1 January 2040.',source+'\nP1 deadlines differ on holidays.',source+'\nresponse_hours is measured in minutes.',source+'\nFirst-response deadlines differ by region.',source+'\nResolution targets for North region are different.',source.replace('on or after 2026','after 2026'),source.replace('is a known nonnegative number at least 48','is a known nonnegative number at least 72'),source.replace('organization equals','organization probably matches'),source.replace('Exactly 48 hours qualifies.','No unit supplied.')])assert.equal(parsePolicyContract(chunks(text)),undefined);
});
test('qualified summaries retain original citations, derived provenance and prevent arbitrary unconditional text',async()=>{
 const f=fixture(),s=createAgentSession(f.services,new AbortController().signal,.5,undefined,question);const prepared=await prepareAgentEvidence(question,s);assert.ok(prepared&&!prepared.blocked&&prepared.policyEvaluation);
 const result=s.renderPolicyCounts('first_response');assert.equal(result.grounded,true);assert.match(result.answer,/P1: 2 confirmed/);assert.match(result.answer,/P2: 2 confirmed/);assert.match(result.answer,/P3: 3 confirmed/);assert.match(result.answer,/not an unconditional complete total/);assert.match(result.answer,/2 records with unknown applicability, 1 unresolved/);assert.ok(result.sources.some(s=>s.type==='csv'));assert.ok(result.sources.some(s=>s.type==='document'));assert.ok(result.sources.every(s=>s.quotes.every(q=>s.text.includes(q))));assert.equal(f.snapshots(),1);const derived=result.sources.find(s=>s.type==='csv');assert.ok(derived&&'derivation' in derived);const provenance=derived.derivation as {kind:string;inputRows:unknown[];classifications:unknown[]};assert.equal(provenance.kind,'policy_applicability_counts');assert.equal(provenance.inputRows.length,25);assert.equal(provenance.classifications.length,25);
 const resolution=s.renderPolicyCounts('resolution');assert.match(resolution.answer,/Confirmed total: 14/);assert.equal(s.finalize({answerable:true,statements:[]}).grounded,false);
});
test('agent can select verified policy counts in one mocked model call without free-text count generation',async()=>{
 const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional',GROQ_MODEL:'openai/gpt-oss-120b'});let calls=0;
 try{const provider=createGroqTransport({rpm:12,fetch:async(_url,init)=>{calls++;const body=JSON.parse(String(init?.body));assert.ok(body.tools.some((t:{function:{name:string}})=>t.function.name==='policyCounts'));return Response.json({id:'fictional',created:1,model:body.model,choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[{id:'count',type:'function',function:{name:'policyCounts',arguments:JSON.stringify({metric:'first_response'})}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}});}});
  const result=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent(question,new AbortController().signal,fixture().services)));assert.equal(calls,1);assert.equal(result.grounded,true);assert.match(result.answer,/Confirmed total: 7/);
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
test('second policy explicitly linked to the same dataset and unavailable snapshots remain blocked',async()=>{
 const f=fixture();const services={...f.services,policies:async()=>({documents:[{id:'21',filename},{id:'22',filename:'conflicting-policy.pdf'}],truncated:false}),search:async(_q:string,_s:AbortSignal,o?:{filename:string;completePolicy?:boolean})=>o?.filename==='conflicting-policy.pdf'?f.context.map(r=>({...r,document_id:'22',filename:'conflicting-policy.pdf'})):o?.completePolicy?f.context:[f.context[3]]};
 assert.equal((await prepareAgentEvidence(question,createAgentSession(services,new AbortController().signal,.5,undefined,question)))?.blocked,true);
 assert.equal((await prepareAgentEvidence(question,createAgentSession({...f.services,snapshot:async()=>{throw Error('Unavailable');}},new AbortController().signal,.5,undefined,question)))?.blocked,true);
});
test('real repeatable-read snapshot and citations preserve ownership in isolated temporary tables',{skip:process.env.RUN_EVAL_DB_TESTS!=='1'},async()=>{
 const {withFixtureDatabase}=await import('../evaluation/isolation'),{default:pool}=await import('../src/lib/db'),{queryDatasetSnapshot,discoverDatasets,queryDataset}=await import('../src/lib/generic-csv'),{loadPolicyContext}=await import('../src/lib/policy-context');
 await runWithIdentity(owner,()=>withFixtureDatabase(cases[0],new Map(documents.map(d=>[d.text,[1,...Array(767).fill(0)]])),async()=>{
  await pool.query('UPDATE documents SET filename=$1 WHERE id=1',[filename]);await pool.query('DELETE FROM document_chunks WHERE document_id=1');
  for(const c of chunks())await pool.query('INSERT INTO document_chunks(id,document_id,chunk_index,chunk_text,page_number) VALUES($1,1,$2,$3,$4)',[Number(c.chunk_id),c.chunk_index,c.chunk_text,c.page_number]);
  await pool.query('UPDATE generic_csv_datasets SET filename=$1,columns=$2,row_count=25 WHERE id=201',[parsePolicyContract(chunks())!.dataset,JSON.stringify(data.columns)]);await pool.query('DELETE FROM generic_csv_rows WHERE dataset_id=201');for(const [index,row] of data.rows.entries())await pool.query('INSERT INTO generic_csv_rows(dataset_id,row_index,data) VALUES(201,$1,$2)',[index,JSON.stringify(row)]);
  const services:AgentServices={policies:async()=>({documents:[{id:'1',filename}],truncated:false}),search:(_q,s)=>loadPolicyContext(filename,s),discover:s=>discoverDatasets(requireUserId(),s),query:(p,s)=>queryDataset(requireUserId(),p,s),snapshot:(p,s)=>queryDatasetSnapshot(requireUserId(),p,s)};
  const session=createAgentSession(services,new AbortController().signal,.5,undefined,question);assert.equal((await prepareAgentEvidence(question,session))?.blocked,false);const result=session.renderPolicyCounts('first_response');assert.equal(result.grounded,true);assert.match(result.answer,/Confirmed total: 7/);
  await assert.rejects(runWithIdentity(foreignOwner,()=>queryDatasetSnapshot(foreignOwner,{datasetId:'201',limit:100})),/Dataset unavailable/);
  await assert.rejects(runWithIdentity(foreignOwner,()=>queryDatasetSnapshot(owner,{datasetId:'201',limit:100})),/Owner scope mismatch/);
 }));
});


test('explicit exclusive-start/inclusive-end variants and complete known snapshots keep correct qualification',async()=>{
 const text=source.replace('on or after 2026','after 2026').replace('and before 2027','and on or before 2027').replace('start boundary is inclusive','start boundary is exclusive').replace('end boundary is exclusive','end boundary is inclusive');
 const f=fixture(text),base=data.rows[0],result=evaluatePolicyRecords(f.contract,data.columns,[{...base,ticket_id:'start',incident_at:f.contract.period.startText},{...base,ticket_id:'end',incident_at:f.contract.period.endText}]);assert.equal(result.classified[0].scope,'not_applicable');assert.equal(result.classified[1].scope,'applicable');
 assert.ok(utcTimestamp('2032-02-29T00:00:00.123Z')!==undefined);
 const known=fixture(source,data.rows.slice(0,3)),session=createAgentSession(known.services,new AbortController().signal,.5,undefined,question);await prepareAgentEvidence(question,session);const answer=session.renderPolicyCounts('first_response');assert.equal(answer.grounded,true);assert.match(answer.answer,/No unresolved applicability or in-scope metric outcomes remain/);assert.match(answer.answer,/Confirmed total: 1/);
});


test('snapshot completeness mismatches cannot become qualified aggregate evidence',async()=>{
 const f=fixture(),session=createAgentSession({...f.services,snapshot:async()=>({dataset:{...f.dataset,row_count:f.dataset.row_count+1},rows:data.rows})},new AbortController().signal,.5,undefined,question);
 assert.equal((await prepareAgentEvidence(question,session))?.blocked,true);assert.equal(session.policyEvaluationInfo(),undefined);assert.equal(session.renderPolicyCounts('first_response').grounded,false);
});


test('entirely unresolved applicability or metric evidence cannot become a misleading zero-count answer',async()=>{
 for(const row of [{...data.rows[0],organization:null},{...data.rows[0],response_hours:null}]){
  const f=fixture(source,[row]),s=createAgentSession(f.services,new AbortController().signal,.5,undefined,question);await prepareAgentEvidence(question,s);const result=s.renderPolicyCounts('first_response');assert.equal(result.grounded,false);assert.deepEqual(result.sources,[]);
 }
});

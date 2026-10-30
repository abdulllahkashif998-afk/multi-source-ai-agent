import {test} from './test-context';
import assert from 'node:assert/strict';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {createAgentSession,type AgentServices} from '../src/lib/agent-tools';
import {parseSLARequest,extractSLARules} from '../src/lib/agent-sla';
import {modelToolResult,sourceCatalog} from '../src/lib/agent-model-context';
import {agentQuoteChoices} from '../src/lib/agent-answer-schema';
import {prepareCSV,compileCSVQuery,planSchema} from '../src/lib/generic-csv';
import {runWithIdentity,requireUserId} from '../src/lib/identity';
import {cases,documents,owner,foreignOwner} from '../evaluation/fixtures';
const policy='P1 first-response deadline is 2.5 hours.\nP2 first-response deadline is 4 hours.';
const filename='service-rules.pdf',dataset='events.csv';
const question=(priority='P1',operator='greater than')=>`Using ${filename} and ${dataset}, list all ${priority} tickets whose response_hours is ${operator} the ${priority} first-response deadline of 1 hour. Include ticket IDs, actual hours, and citations from both files.`;
const allQuestion=`Using ${filename} and ${dataset}, list late tickets against the first-response SLA. Include ticket IDs, actual hours, and citations from both files.`;
const csv='ticket_id,severity,response_hours\nA,P1,3\nB,P1,2.5\nC,P1,1\nD,P2,6\nE,P2,4\nF,P2,3\n';
const prepared=prepareCSV(csv);
function fixture(){const plans:unknown[]=[];const row={document_id:'21',chunk_id:'51',filename,chunk_index:0,page_number:2,chunk_text:policy,similarity:.99};const services:AgentServices={search:async()=>[row],discover:async()=>[{id:'101',filename:dataset,columns:prepared.columns,row_count:prepared.rows.length}],query:async input=>{const p=planSchema.parse(input);compileCSVQuery(p,prepared.columns);plans.push(p);if(p.aggregate)return [{severity:'P1',value:3},{severity:'P2',value:3}];return prepared.rows.filter(r=>p.filters.every(f=>f.op==='eq'?r[f.column]===f.value:f.op==='gte'?Number(r[f.column])>=Number(f.value):Number(r[f.column])>Number(f.value))).sort((a,b)=>Number(b.response_hours)-Number(a.response_hours));}};return {services,row,plans};}
async function offline<T>(work:()=>Promise<T>){const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL'],previous=Object.fromEntries(keys.map(k=>[k,process.env[k]])),fetch=globalThis.fetch;Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional-test-key',GROQ_MODEL:'openai/gpt-oss-20b'});globalThis.fetch=async()=>assert.fail('No provider or embedding HTTP in this service-injected test');try{return await work();}finally{globalThis.fetch=fetch;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}}
test('generic SLA uses document threshold, not question number; strict equality excluded, both sources verified',async()=>offline(async()=>{
 const f=fixture(),r=await answerWithAgent(question(),new AbortController().signal,f.services);assert.equal(r.grounded,true);assert.match(r.answer,/Ticket A \(P1\).*3 hours.*2.5 hours.*0.5 hours/);assert.doesNotMatch(r.answer,/Ticket B|Ticket C|Ticket D/);assert.deepEqual(r.sources.map(s=>s.type),['document','csv']);assert.ok(r.sources.every(s=>s.quotes.every(q=>s.text.includes(q))));assert.equal((f.plans[0] as {filters:Array<{value:unknown}>}).filters[1].value,2.5);
}));
test('multiple priorities are discovered and compared with their own deadlines',async()=>offline(async()=>{
 const f=fixture(),r=await answerWithAgent(allQuestion,new AbortController().signal,f.services);assert.equal(r.grounded,true);assert.match(r.answer,/Ticket A \(P1\)/);assert.match(r.answer,/Ticket D \(P2\).*4 hours.*2 hours/);assert.doesNotMatch(r.answer,/Ticket B|Ticket E/);assert.equal(f.plans.length,3);assert.ok(r.sources.filter(s=>s.type==='csv').every(s=>'plan' in s&&!(s.plan as {aggregate?:unknown}).aggregate));
}));
test('inclusive comparisons explicitly requested include equality, without changing strict SLA behavior',async()=>offline(async()=>{
 const f=fixture(),r=await answerWithAgent(question('P1','greater than or equal to'),new AbortController().signal,f.services);assert.match(r.answer,/Ticket B.*difference is 0 hours/);assert.equal((f.plans[0] as {filters:Array<{op:string}>}).filters[1].op,'gte');
}));
test('zero matching rows produce a supported negative result with both citations',async()=>offline(async()=>{
 const f=fixture(),r=await answerWithAgent(question(),new AbortController().signal,{...f.services,query:async()=>[]});assert.equal(r.grounded,true);assert.match(r.answer,/No P1 tickets/);assert.equal(r.sources.length,2);
}));
test('SLA parser does not silently discard extra filters, lookup joins, dates or ambiguous priority references',()=>{
 assert.ok(parseSLARequest(question()));assert.ok(parseSLARequest(allQuestion));
 for(const q of [question()+' Only active tickets.',question().replace('list all P1','list all active P1'),question().replace('actual hours','regional lead and actual hours'),question().replace('all P1','all P1 and P2'),question().replace('response_hours','resolution_hours')])assert.equal(parseSLARequest(q),null);
 assert.equal(extractSLARules('P3 first response SLA: 30 minutes.')[0].unit,'minutes');assert.deepEqual(extractSLARules('P1 resolution deadline is 2 hours.'),[]);
});
test('missing/conflicting rules, unknown units and schema, duplicate datasets and truncation abstain safely',async()=>offline(async()=>{
 const f=fixture(),variants:AgentServices[]=[{...f.services,search:async()=>[]},{...f.services,search:async()=>[{...f.row,chunk_text:policy+'\nP1 first-response deadline is 9 hours.'}]},{...f.services,search:async()=>[{...f.row,chunk_text:'P1 first-response deadline is 30 minutes.'}]},{...f.services,discover:async()=>[]},{...f.services,discover:async s=>{const ds=await f.services.discover(s);return [...ds,{...ds[0],id:'102'}];}},{...f.services,discover:async s=>(await f.services.discover(s)).map(d=>({...d,columns:[{name:'unknown',type:'text' as const}]}))},{...f.services,query:async()=>Array.from({length:100},()=>({ticket_id:'A',severity:'P1',response_hours:3}))}];
 for(const services of variants){const r=await answerWithAgent(question(),new AbortController().signal,services);assert.equal(r.grounded,false);assert.deepEqual(r.sources,[]);}
}));
async function session(q:string){const f=fixture(),s=createAgentSession(f.services,new AbortController().signal,.5,undefined,q);await s.execute('searchDocuments',{question:'rules'});await s.execute('discoverDatasets',{});await s.execute('inspectDataset',{datasetId:'101'});await s.execute('queryDataset',{datasetId:'101'});return s;}
const claim=(citations:Array<{sourceId:string;quote:string}>)=>({answerable:true,statements:[{text:'The ticket exceeds its policy deadline.',citations}]});
test('cross-source conclusions require both families per statement; CSV-only and document-only remain valid',async()=>{
 const s=await session(question()),e=s.evidence(),doc={sourceId:'D1',quote:e.documents[0].text},data={sourceId:'C1',quote:e.csv[0].text};
 assert.equal(s.finalize(claim([data])).grounded,false);assert.equal(s.finalize(claim([doc])).grounded,false);assert.equal(s.finalize(claim([doc,data])).grounded,true);
 const csvOnly=await session('List data in events.csv.');assert.equal(csvOnly.finalize(claim([{sourceId:'C1',quote:csvOnly.evidence().csv[0].text}])).grounded,true);
 const docOnly=await session('What does service-rules.pdf say?');assert.equal(docOnly.finalize(claim([{sourceId:'D1',quote:docOnly.evidence().documents[0].text}])).grounded,true);
 assert.throws(()=>s.finalize(claim([{sourceId:'D1',quote:'fabricated quote'},data])));
 const prefix=await session(question().replace(filename,'other-'+filename));assert.equal(prefix.finalize(claim([{sourceId:'D1',quote:prefix.evidence().documents[0].text},{sourceId:'C1',quote:prefix.evidence().csv[0].text}])).grounded,false);
 const wrong=await session(question().replace(filename,'another-policy.pdf'));assert.equal(wrong.finalize(claim([{sourceId:'D1',quote:wrong.evidence().documents[0].text},{sourceId:'C1',quote:wrong.evidence().csv[0].text}])).grounded,false);
});
test('different searches reuse stable chunk IDs; changed text remains distinct; model view preserves originals',async()=>{
 const f=fixture();let calls=0;const s=createAgentSession({...f.services,search:async()=>[{...f.row,chunk_text:++calls<3?policy:policy+' Updated.'}]},new AbortController().signal,.5);
 await s.execute('searchDocuments',{question:'one'});await s.execute('searchDocuments',{question:'two'});assert.equal(s.evidence().documents.length,1);await s.execute('searchDocuments',{question:'three'});assert.equal(s.evidence().documents.length,2);
 const ready=await session(question()),e=ready.evidence(),seen=new Set<string>();const projected=modelToolResult(e.csv[0],seen) as Record<string,unknown>;assert.equal(projected.text,undefined);assert.ok(Array.isArray(projected.rows));assert.deepEqual(modelToolResult(e.csv[0],seen),{id:'C1',previouslyRetrieved:true});assert.ok(e.csv[0].text);const catalog=sourceCatalog(e);assert.ok(!JSON.stringify(catalog).includes('first-response deadline is'));assert.ok(agentQuoteChoices(e).every(q=>[...e.documents,...e.csv].some(s=>s.id===q.sourceId&&s.text.includes(q.quote))));
});
test('SLA cancellation cannot publish evidence or invoke a provider',async()=>offline(async()=>{await assert.rejects(answerWithAgent(question(),AbortSignal.abort(),fixture().services),{name:'AbortError'});}));
test('generic SLA executes real read-only PostgreSQL filters with owner isolation and rollback-only fixtures',{skip:process.env.RUN_EVAL_DB_TESTS!=='1'},async()=>offline(async()=>{
 const {withFixtureDatabase}=await import('../evaluation/isolation'),{default:pool}=await import('../src/lib/db'),{discoverDatasets,queryDataset}=await import('../src/lib/generic-csv');
 await runWithIdentity(owner,()=>withFixtureDatabase(cases[0],new Map(documents.map(d=>[d.text,[1,...Array(767).fill(0)]])),async()=>{
  // These unqualified tables were checked by withFixtureDatabase as pg_temp.
  await pool.query('UPDATE documents SET filename=$1 WHERE id=1',[filename]);await pool.query('UPDATE document_chunks SET chunk_text=$1 WHERE id=101',[policy]);await pool.query('UPDATE generic_csv_datasets SET filename=$1,columns=$2,row_count=$3 WHERE id=201',[dataset,JSON.stringify(prepared.columns),prepared.rows.length]);await pool.query('DELETE FROM generic_csv_rows WHERE dataset_id=201');for(const [i,row] of prepared.rows.entries())await pool.query('INSERT INTO generic_csv_rows(dataset_id,row_index,data) VALUES(201,$1,$2)',[i,JSON.stringify(row)]);
  const {loadPolicyContext}=await import('../src/lib/policy-context');
  const full=await loadPolicyContext(filename);assert.ok(full.length>0);assert.ok(full.every(d=>d.filename===filename));assert.deepEqual(await runWithIdentity(foreignOwner,()=>loadPolicyContext(filename)),[]);
  const services:AgentServices={search:async()=> (await pool.query("SELECT d.id AS document_id,c.id AS chunk_id,d.filename,c.chunk_index,c.page_number,c.chunk_text,0.99::float8 AS similarity FROM documents d JOIN document_chunks c ON c.document_id=d.id WHERE d.user_id=$1 AND d.status='ready' AND d.filename=$2",[requireUserId(),filename])).rows,discover:s=>discoverDatasets(requireUserId(),s),query:(plan,s)=>queryDataset(requireUserId(),plan,s)};
  const result=await answerWithAgent(allQuestion,new AbortController().signal,services);assert.equal(result.grounded,true);assert.match(result.answer,/Ticket A/);assert.match(result.answer,/Ticket D/);assert.doesNotMatch(result.answer,/Ticket B/);const missed=await answerWithAgent(missedQuestion,new AbortController().signal,services);assert.equal(missed.grounded,true);assert.match(missed.answer,/Ticket A/);assert.doesNotMatch(missed.answer,/Ticket B|Ticket D/);const shortServices={...services,policies:async()=>({documents:(await pool.query("SELECT id::text,filename FROM documents WHERE user_id=$1 AND status='ready' AND filename=$2",[requireUserId(),filename])).rows,truncated:false})};const shortResult=await answerWithAgent(shortQuestion+' Include their ticket IDs and response times.',new AbortController().signal,shortServices);assert.equal(shortResult.grounded,true);assert.match(shortResult.answer,/Ticket A/);const countResult=await answerWithAgent(countQuestion,new AbortController().signal,shortServices);assert.equal(countResult.grounded,true);assert.match(countResult.answer,/P1: 1 tickets/);assert.match(countResult.answer,/P2: 1 tickets/);assert.match(countResult.answer,/Total across all priorities: 2 tickets/);const shortForeign=await runWithIdentity(foreignOwner,()=>answerWithAgent(shortQuestion,new AbortController().signal,shortServices));assert.equal(shortForeign.grounded,false);const foreign=await runWithIdentity(foreignOwner,()=>answerWithAgent(allQuestion,new AbortController().signal,services));assert.equal(foreign.grounded,false);assert.deepEqual(foreign.sources,[]);
 }));
}));
test('native minute metrics use matching policy units without an invented conversion',async()=>offline(async()=>{
 const f=fixture();const services:AgentServices={...f.services,search:async()=>[{...f.row,chunk_text:'P1 first-response deadline is 20 minutes.'}],discover:async()=>[{id:'101',filename:dataset,columns:[{name:'ticket_id',type:'text'},{name:'severity',type:'text'},{name:'response_minutes',type:'number'}],row_count:2}],query:async plan=>{assert.equal((plan as {filters:Array<{value:unknown}>}).filters[1].value,20);return [{ticket_id:'M',severity:'P1',response_minutes:21}];}};
 const q=question().replace('response_hours','response_minutes').replace('actual hours','actual minutes');const r=await answerWithAgent(q,new AbortController().signal,services);assert.equal(r.grounded,true);assert.match(r.answer,/21 minutes.*20 minutes.*1 minutes/);
}));
const missedQuestion=`Which P1 tickets missed the first-response SLA according to ${filename} and ${dataset}? Include ticket IDs, response times, policy deadline, and citations from both sources.`;
test('missed first-response SLA phrasing uses validated deterministic comparison without Groq and keeps both citations',async()=>offline(async()=>{
 const actualQuestion='Which P1 tickets missed the first-response SLA according to Northstar_Operations_Policy.pdf and Northstar_Incidents.csv? Include ticket IDs, response times, policy deadline, and citations from both sources.';
 assert.deepEqual(parseSLARequest(actualQuestion),{document:'Northstar_Operations_Policy.pdf',dataset:'Northstar_Incidents.csv',priorities:['P1'],unit:null,op:'gt'});
 const f=fixture(),result=await answerWithAgent(missedQuestion,new AbortController().signal,f.services);
 assert.equal(result.grounded,true);assert.match(result.answer,/Ticket A.*3 hours.*2.5 hours/);assert.doesNotMatch(result.answer,/Ticket B|Ticket C/);assert.deepEqual(result.sources.map(s=>s.type),['document','csv']);
 const {requiresCombinedEvidence}=await import('../src/lib/agent-evidence-contract');assert.equal(requiresCombinedEvidence(missedQuestion),true);
 const onlyCSV=await session(missedQuestion);assert.equal(onlyCSV.finalize(claim([{sourceId:'C1',quote:onlyCSV.evidence().csv[0].text}])).grounded,false);
 for(const q of [missedQuestion+' Only active tickets.',missedQuestion.replace('P1 tickets','P1 active tickets'),missedQuestion.replace('first-response','resolution')])assert.equal(parseSLARequest(q),null);
}));

test('compound first-response policy clauses inherit the metric without confusing resolution rules',async()=>offline(async()=>{
 const f=fixture(),text='P1 tickets require first response within 2.5 hours; P2 within 4 hours; P3 within 12 hours. Response time is measured from receipt.\nP1 resolution target is within 8 hours; P2 within 24 hours.';
 const rules=extractSLARules(text);assert.deepEqual(rules.map(r=>[r.priority,r.threshold]),[['P1',2.5],['P2',4],['P3',12]]);
 const result=await answerWithAgent(missedQuestion,new AbortController().signal,{...f.services,search:async()=>[{...f.row,chunk_text:text}]});assert.equal(result.grounded,true);assert.match(result.answer,/Ticket A.*deadline is 2.5 hours/);assert.ok(result.sources.every(s=>s.quotes.every(q=>s.text.includes(q))));
 assert.deepEqual(extractSLARules('P1 tickets require first response within 2 hours; P2 within 4 hours unless regional approval applies.'),[]);
}));
test('SLA scopes named-file retrieval before evidence selection and retains real region conditions',async()=>offline(async()=>{
 const {hasAmbiguousSLAScope}=await import('../src/lib/agent-sla');
 const f=fixture();let searches=0;
 const services:AgentServices={...f.services,search:async(q,s,options)=>{searches++;assert.equal(options?.filename,filename);return [{...f.row,chunk_text:'Staff record assigned region and severity.\n'+policy+'\nLate tickets go to the regional team lead.'}];}};
 const result=await answerWithAgent(missedQuestion,new AbortController().signal,services);assert.equal(result.grounded,true);assert.match(result.answer,/Ticket A/);assert.equal(searches,2);
 assert.equal(hasAmbiguousSLAScope('Staff record assigned region. Late tickets go to the regional team lead.'),false);
 for(const text of ['First-response deadlines differ by region.','Regional P1 first-response deadline is 2 hours.','This policy applies to the North region.','P1 first-response deadline is 2 hours unless approved.','P1 first-response deadline is 2 business hours.'])assert.equal(hasAmbiguousSLAScope(text),true);
 const conditional=await answerWithAgent(missedQuestion,new AbortController().signal,{...services,search:async()=>[{...f.row,chunk_text:policy+'\nFirst-response deadlines differ by region.'}]});assert.equal(conditional.grounded,false);assert.deepEqual(conditional.sources,[]);
 const cache=createAgentSession({...f.services,search:async(_q,_s,o)=>{searches++;return [{...f.row,filename:o?.filename??filename}];}},new AbortController().signal,.5);
 const before=searches;await cache.execute('searchDocuments',{question:'deadline'},undefined,{filename});await cache.execute('searchDocuments',{question:'deadline'},undefined,{filename});await cache.execute('searchDocuments',{question:'deadline'},undefined,{filename:'other.pdf'});assert.equal(searches-before,2);
}));
const shortQuestion='Which P1 incidents exceeded the policy first-response deadline?';
test('short SLA paraphrases discover a unique owned policy and incident schema without provider calls',async()=>offline(async()=>{
 const f=fixture(),services:AgentServices={...f.services,policies:async()=>({documents:[{id:'21',filename}],truncated:false})};
 for(const q of [shortQuestion,shortQuestion+' Include their ticket IDs and response times.','Which P1 tickets missed the policy first-response SLA?']){
  const r=await answerWithAgent(q,new AbortController().signal,services);assert.equal(r.grounded,true);assert.match(r.answer,/Ticket A.*3 hours.*2.5 hours/);assert.doesNotMatch(r.answer,/Ticket B/);assert.deepEqual(r.sources.map(s=>s.type),['document','csv']);assert.ok(r.sources.every(s=>s.quotes.every(quote=>s.text.includes(quote))));
 }
 for(const q of [shortQuestion+' Include ticket IDs and customer emails.',shortQuestion+' Include ticket IDs and response times for active tickets.',shortQuestion+' Only active tickets.',shortQuestion.replace('first-response','resolution'),shortQuestion.replace('P1','P1 active')])assert.equal(parseSLARequest(q),null);
}));
test('short SLA discovery abstains on missing, truncated or multiple policies and compatible datasets',async()=>offline(async()=>{
 const f=fixture(),unique=async()=>({documents:[{id:'21',filename}],truncated:false});let queries=0;
 const variants:AgentServices[]=[{...f.services},{...f.services,policies:async()=>({documents:[],truncated:false})},{...f.services,policies:async()=>({documents:[{id:'21',filename},{id:'22',filename:'another-policy.pdf'}],truncated:false})},{...f.services,policies:async()=>({documents:[{id:'21',filename}],truncated:true})},{...f.services,policies:unique,discover:async()=>[]},{...f.services,policies:unique,discover:async s=>{const rows=await f.services.discover(s);return [...rows,{...rows[0],id:'102',filename:'other.csv'}];}}];
 for(const services of variants){const r=await answerWithAgent(shortQuestion,new AbortController().signal,{...services,query:async()=>{queries++;return [];}});assert.equal(r.grounded,false);assert.deepEqual(r.sources,[]);}assert.equal(queries,0);
 const foreign=await answerWithAgent(shortQuestion,new AbortController().signal,{...f.services,policies:unique,search:async()=>[]});assert.equal(foreign.grounded,false);
}));
test('short SLA discovery cancellation respects the request signal without publishing evidence',async()=>offline(async()=>{
 const f=fixture(),controller=new AbortController();const services:AgentServices={...f.services,policies:async signal=>{controller.abort();signal.throwIfAborted();return {documents:[],truncated:false};}};
 await assert.rejects(answerWithAgent(shortQuestion,controller.signal,services),{name:'AbortError'});
}));
const countQuestion='How many tickets missed first-response SLA across all priorities?';
function countFixture(){const f=fixture(),services:AgentServices={...f.services,policies:async()=>({documents:[{id:'21',filename}],truncated:false}),query:async input=>{const p=planSchema.parse(input);if(p.aggregate&&p.groupBy.includes('response_hours')){compileCSVQuery(p,prepared.columns);const groups=new Map<string,Record<string,unknown>>();for(const r of prepared.rows){const key=JSON.stringify([r.severity,r.response_hours]),g=groups.get(key);if(g)g.value=Number(g.value)+1;else groups.set(key,{severity:r.severity,response_hours:r.response_hours,value:1});}return [...groups.values()];}return f.services.query(input);}};return {f,services};}
test('P1 list followed immediately by all-priority counts and rapid independent repeats needs no provider',async()=>offline(async()=>{
 const {services}=countFixture();const first=await answerWithAgent(shortQuestion,new AbortController().signal,services);assert.equal(first.grounded,true);assert.match(first.answer,/Ticket A/);
 for(const result of [await answerWithAgent(countQuestion,new AbortController().signal,services),...await Promise.all(Array.from({length:3},()=>answerWithAgent(countQuestion,new AbortController().signal,services)))]){assert.equal(result.grounded,true);assert.match(result.answer,/P1: 1 tickets/);assert.match(result.answer,/P2: 1 tickets/);assert.match(result.answer,/Total across all priorities: 2 tickets/);assert.ok(result.sources.some(s=>s.type==='document'));assert.ok(result.sources.some(s=>s.type==='csv'));assert.ok(result.sources.every(s=>s.quotes.every(q=>s.text.includes(q))));}
}));
test('all-priority counts use aggregate bins, include zeros, and never treat equality as late',async()=>offline(async()=>{
 const {services}=countFixture();const r=await answerWithAgent(countQuestion,new AbortController().signal,{...services,query:async input=>{const p=planSchema.parse(input);assert.equal(p.aggregate?.op,'count');assert.deepEqual(p.filters,[]);if(p.groupBy.length===1)return [{severity:'P1',value:2100},{severity:'P2',value:500}];assert.deepEqual(p.groupBy,['severity','response_hours']);return [{severity:'P1',response_hours:2.5,value:900},{severity:'P1',response_hours:3,value:1200},{severity:'P2',response_hours:4,value:500}];}});assert.equal(r.grounded,true);assert.match(r.answer,/P1: 1200 tickets/);assert.match(r.answer,/P2: 0 tickets/);assert.match(r.answer,/Total across all priorities: 1200 tickets/);
 const empty=await answerWithAgent(countQuestion,new AbortController().signal,{...services,query:async()=>[]});assert.equal(empty.grounded,true);assert.match(empty.answer,/Total across all priorities: 0 tickets/);
}));
test('all-priority counts refuse missing/conflicting thresholds, invalid counts and truncated evidence',async()=>offline(async()=>{
 const {f,services}=countFixture();for(const variant of [{...services,search:async()=>[{...f.row,chunk_text:policy+'\nP1 first-response deadline is 99 hours.'}]},{...services,query:async()=>[{severity:'P9',response_hours:3,value:1}]},{...services,query:async()=>[{severity:'P1',response_hours:3,value:-1}]},{...services,query:async()=>Array.from({length:100},()=>({severity:'P1',response_hours:3,value:1}))}]){const r=await answerWithAgent(countQuestion,new AbortController().signal,variant);assert.equal(r.grounded,false);assert.deepEqual(r.sources,[]);}
 assert.equal(parseSLARequest(countQuestion+' Only active tickets.'),null);
}));

test('all three priorities use their own policy thresholds and exclude equality; document scope still blocks',async()=>offline(async()=>{
 const f=fixture(),input=prepareCSV('ticket_id,severity,response_hours\nA,P1,3\nB,P1,2.5\nC,P2,5\nD,P2,4\nE,P3,10\nF,P3,9\n');
 const text='P1 first-response deadline is 2.5 hours.\nP2 first-response deadline is 4 hours.\nP3 first-response deadline is 9 hours.';
 let queries=0;
 const services:AgentServices={...f.services,policies:async()=>({documents:[{id:'21',filename}],truncated:false}),search:async()=>[{...f.row,chunk_text:text}],query:async raw=>{queries++;const plan=planSchema.parse(raw);compileCSVQuery(plan,input.columns);return input.rows.filter(row=>plan.filters.every(filter=>filter.op==='eq'?row[filter.column]===filter.value:Number(row[filter.column])>Number(filter.value)));}};
 for(const [priority,late,equal,threshold] of [['P1','A','B',2.5],['P2','C','D',4],['P3','E','F',9]] as const){
  const result=await answerWithAgent(`Which ${priority} tickets exceeded the policy first-response deadline? Include their ticket IDs and response times.`,new AbortController().signal,services);
  assert.equal(result.grounded,true);assert.match(result.answer,new RegExp(`Ticket ${late} \\(${priority}\\)`));assert.doesNotMatch(result.answer,new RegExp(`Ticket ${equal}`));assert.ok(result.answer.includes(`deadline is ${threshold} hours`));assert.deepEqual(result.sources.map(s=>s.type),['document','csv']);
 }
 assert.equal(queries,3);
 const scoped=await answerWithAgent('Which P2 tickets exceeded the policy first-response deadline? Include their ticket IDs and response times.',new AbortController().signal,{...services,search:async()=>[{...f.row,chunk_text:text},{...f.row,chunk_id:'52',chunk_index:1,chunk_text:'This policy applies only to the Finance department.'}]});
 assert.equal(scoped.grounded,false);assert.deepEqual(scoped.sources,[]);assert.equal(queries,3);
}));


test('scope relationships require explicit rule subjects; global and conflicting effective dates remain unresolved',async()=>offline(async()=>{
 const {hasAmbiguousSLAScope}=await import('../src/lib/agent-sla');
 const unrelated='Customer updates occur on material changes only. Resolution targets apply only during business hours.';
 assert.equal(hasAmbiguousSLAScope(unrelated),false);
 for(const scoped of ['Effective 1 October 2026. This policy applies to internal operations only.','Effective 1 October 2026. Effective 1 November 2026.','Customer updates change first-response deadlines only for Finance.','These rules apply only to Finance.'])assert.equal(hasAmbiguousSLAScope(scoped),true);
 const f=fixture();let queries=0;
 const services:AgentServices={...f.services,policies:async()=>({documents:[{id:'21',filename}],truncated:false}),search:async()=>[{...f.row,chunk_text:policy+'\n'+unrelated}],query:async plan=>{queries++;return f.services.query(plan);}};
 const supported=await answerWithAgent(shortQuestion+' Include their ticket IDs and response times.',new AbortController().signal,services);
 assert.equal(supported.grounded,true);assert.deepEqual(supported.sources.map(s=>s.type),['document','csv']);assert.equal(queries,1);
 for(const restriction of ['This policy applies only to Finance.','Effective 1 October 2026. Effective 1 November 2026.']){
  const result=await answerWithAgent(shortQuestion,new AbortController().signal,{...services,search:async()=>[{...f.row,chunk_text:policy+'\n'+restriction}]});assert.equal(result.grounded,false);assert.equal(queries,1);
 }
}));

test('complete policy context enforces global restrictions for every priority independently of ranked retrieval',async()=>offline(async()=>{
 const f=fixture(),rules=policy+'\nP3 first-response deadline is 9 hours.';let queries=0,contextReads=0;
 for(const metadata of ['This policy applies only to Finance.','Effective 1 January 2020.','Effective 1 January 2030.','Effective 1 January 2020. Effective 1 January 2030.','P2 first-response deadline is 7 hours.']){
  const services:AgentServices={...f.services,policies:async()=>({documents:[{id:'21',filename}],truncated:false}),search:async(_q,_s,options)=>options?.completePolicy?(contextReads++,[{...f.row,chunk_text:rules},{...f.row,chunk_id:'99',chunk_index:5,chunk_text:metadata}]):[{...f.row,chunk_text:rules}],query:async()=>{queries++;return [];}};
  for(const priority of ['P1','P2','P3'])for(const wording of [`Which ${priority} incidents exceeded the policy first-response deadline? Include their ticket IDs and response times.`,question(priority)]){
   const r=await answerWithAgent(wording,new AbortController().signal,services);assert.equal(r.grounded,false);assert.deepEqual(r.sources,[]);
  }
 }
 assert.equal(contextReads,30);assert.equal(queries,0);
 const unavailable={...f.services,search:async(_q:string,_s:AbortSignal,options?:{filename:string;completePolicy?:boolean})=>{if(options?.completePolicy)throw Error('Context unavailable');return [f.row];}};
 assert.equal((await answerWithAgent(question(),new AbortController().signal,unavailable)).grounded,false);
}));

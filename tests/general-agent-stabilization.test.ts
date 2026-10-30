import {test} from 'node:test';
import {agentModelToolInputs,agentToolInputs} from '../src/lib/agent-tool-inputs';
import assert from 'node:assert/strict';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {createAgentSession,type AgentServices} from '../src/lib/agent-tools';
import {preparePlanningCatalog,AGENT_PLANNING_OUTPUT_TOKENS} from '../src/lib/agent-planning-context';
import {createGroqTransport,withGroqTransport} from '../src/lib/groq-transport';
import {runWithIdentity} from '../src/lib/identity';
import {estimateGroqTokens} from '../src/lib/groq-quota';
async function configured<T>(work:()=>Promise<T>){const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional',GROQ_MODEL:'openai/gpt-oss-120b'});try{return await work();}finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}}
const doc={document_id:'21',chunk_id:'51',filename:'guidance.docx',chunk_index:0,page_number:1,chunk_text:'Approval requires a value above 75 credits.',similarity:.9};
const dataset={id:'101',filename:'ledger.csv',columns:[{name:'region',type:'text' as const},{name:'amount',type:'number' as const}],row_count:3};
const records=[{region:'East',amount:10},{region:'East',amount:20},{region:'West',amount:5}];
function response(content:string|null,name?:string,input?:unknown,reason?:string){return Response.json({id:'fixture',created:1,model:'openai/gpt-oss-120b',choices:[{index:0,message:{role:'assistant',content,...(name?{tool_calls:[{id:'call',type:'function',function:{name,arguments:JSON.stringify(input)}}]}:{})},finish_reason:reason??(name?'tool_calls':'stop')}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}});}
test('six consecutive varied questions exercise general Groq orchestration, prepared schemas and strict citations',async()=>configured(async()=>{
 const scenarios=[
  {kind:'document',question:'Explain the reimbursement guidance.'},
  {kind:'filter',question:'Show individual East figures in descending amount order.'},
  {kind:'average',question:'What is the average amount in the ledger?'},
  {kind:'combined',question:'Compare CSV values against the policy threshold and explain the differences.'},
  {kind:'missing',question:'Who authorized an imaginary Neptune office?'},
  {kind:'conflict',question:'Which of the conflicting reimbursement policies governs this ledger?'}
 ];let current=scenarios[0],step=0,calls=0,now=0,discovery=0,queries=0;const counts:number[]=[];
 const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_url,init)=>{
  calls++;const body=JSON.parse(String(init?.body));assert.equal(body.model,'openai/gpt-oss-120b');
  if(body.response_format){assert.equal(body.max_completion_tokens??body.max_tokens,3000);const kinds=current.kind,ids=kinds==='document'?['D1']:kinds==='combined'?['D1','C1']:['C1'];return response(JSON.stringify(['missing','conflict'].includes(kinds)?{answerable:false,statements:[]}:{answerable:true,statements:[{text:kinds==='document'?'Approval applies above 75 credits.':kinds==='filter'?'East amounts are 20 and 10.':kinds==='average'?'The average is 11.666666666666666.':'All amounts are below the 75-credit threshold.',citations:ids.map((id,i)=>({sourceId:id,quoteId:`Q${i+1}`}))}]}));}
  assert.equal(body.max_completion_tokens??body.max_tokens,AGENT_PLANNING_OUTPUT_TOKENS);assert.deepEqual(body.tools.map((t:{function:{name:string}})=>t.function.name).sort(),['queryDataset','searchDocuments']);
  if(step===0){const prompt=JSON.parse(body.messages.find((m:{role:string})=>m.role==='user').content);assert.equal(prompt.preparedDatasets.datasets[0].columns[1].name,'amount');}
  const kind=current.kind;const search=['document','combined','missing','conflict'].includes(kind);
  if(step++===0&&search)return response(null,'searchDocuments',{question:current.question});
  if((!search&&step===1)||(kind==='combined'&&step===2))return response(null,'queryDataset',{datasetId:'101',...(kind==='filter'?{filters:[{column:'region',op:'eq',value:'East'}],sort:{column:'amount',direction:'desc'}}:kind==='average'?{aggregate:{op:'avg',column:'amount'}}:{})});
  return response('Evidence collected.');
 }});
 const services:AgentServices={search:async()=>current.kind==='missing'?[]:current.kind==='conflict'?[doc,{...doc,document_id:'22',chunk_id:'52',chunk_text:'Approval requires a value above 90 credits.'}]:[doc],discover:async()=>{discovery++;return [dataset];},query:async input=>{queries++;const p=input as {aggregate?:{op:string};filters:Array<{value:unknown}>;sort?:{direction:string}};return p.aggregate?[{value:35/3}]:p.filters.length?[records[1],records[0]]:records;}};
 await runWithIdentity('101',()=>withGroqTransport(provider,async()=>{for(const scenario of scenarios){current=scenario;step=0;const before=calls;const result=await answerWithAgent(scenario.question,new AbortController().signal,services);counts.push(calls-before);assert.equal(result.grounded,!['missing','conflict'].includes(scenario.kind));if(result.grounded)assert.ok(result.sources.every(s=>s.quotes.every(q=>s.text.includes(q))));if(scenario.kind==='combined')assert.deepEqual(result.sources.map(s=>s.type),['document','csv']);if(scenario.kind==='filter')assert.deepEqual((result.sources[0] as {rows:unknown[]}).rows,[records[1],records[0]]);}}));
 assert.deepEqual(counts,[3,3,3,4,3,3]);assert.equal(discovery,6);assert.equal(queries,3);
}));
test('catalog is bounded, request-local, and only full inspected schemas permit queries',async()=>{
 let queries=0;const many=Array.from({length:5},(_,i)=>({...dataset,id:String(101+i)}));const services:AgentServices={search:async()=>[],discover:async()=>many,query:async()=>{queries++;return [];}};
 const s=createAgentSession(services,new AbortController().signal,.5);const catalog=await preparePlanningCatalog(s);assert.equal(catalog.datasets.length,3);assert.equal(catalog.additionalDatasetsRequireDiscovery,true);await s.execute('queryDataset',{datasetId:'104'});assert.equal(queries,0);await s.execute('queryDataset',{datasetId:'101'});assert.equal(queries,1);
 const other=createAgentSession({...services,discover:async()=>[]},new AbortController().signal,.5);assert.equal((await preparePlanningCatalog(other)).datasets.length,0);assert.deepEqual(other.evidence(),{documents:[],csv:[]});
 const oversized=createAgentSession({...services,discover:async()=>[{...dataset,columns:Array.from({length:80},(_,i)=>({name:'column_'+i+'x'.repeat(100),type:'text' as const}))}]},new AbortController().signal,.5);const summary=await preparePlanningCatalog(oversized);assert.equal(summary.additionalDatasetsRequireDiscovery,true);assert.ok('schemaOmitted' in summary.datasets[0]!);await oversized.execute('queryDataset',{datasetId:'101'});assert.equal(queries,1);
 const stopped=createAgentSession(services,AbortSignal.abort(),.5);await assert.rejects(preparePlanningCatalog(stopped),{name:'AbortError'});
});
test('planning output cap reduces the real reservation and truncated planning fails explicitly',async()=>configured(async()=>{
 const wire={model:'openai/gpt-oss-120b',messages:[{role:'user',content:'A fictional query.'}],max_completion_tokens:3000};assert.equal(estimateGroqTokens(JSON.stringify(wire))-estimateGroqTokens(JSON.stringify({...wire,max_completion_tokens:AGENT_PLANNING_OUTPUT_TOKENS})),3000-AGENT_PLANNING_OUTPUT_TOKENS);
 let calls=0;const provider=createGroqTransport({rpm:12,fetch:async()=>{calls++;return response('unfinished',undefined,undefined,'length');}});await assert.rejects(runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent('Explain a fictional inventory question.',new AbortController().signal,{search:async()=>[],discover:async()=>[],query:async()=>[]}))),{code:'AGENT_OUTPUT_LIMIT',status:502});assert.equal(calls,1);
}));
test('empty complete catalogs hide unavailable CSV tools while partial catalogs retain schema discovery',async()=>configured(async()=>{
 for(const [datasets,expected] of [[[],['searchDocuments']],[Array.from({length:5},(_,i)=>({...dataset,id:String(101+i)})),['discoverDatasets','inspectDataset','queryDataset','searchDocuments']]] as const){
  let now=0;const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_url,init)=>{const b=JSON.parse(String(init?.body));if(b.response_format)return response(JSON.stringify({answerable:false,statements:[]}));assert.deepEqual(b.tools.map((t:{function:{name:string}})=>t.function.name).sort(),[...expected].sort());return response('No supported evidence.');}});
  const result=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent('Explain the available inventory evidence.',new AbortController().signal,{search:async()=>[],discover:async()=>[...datasets],query:async()=>assert.fail('No query requested')})));assert.equal(result.grounded,false);
 }
}));
test('general planning stops two duplicate-only successful tool rounds without changing evidence or verification',async()=>configured(async()=>{
 let now=0,planning=0,queries=0;
 const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_url,init)=>{const b=JSON.parse(String(init?.body));if(b.response_format)return response(JSON.stringify({answerable:true,statements:[{text:'There are 3 entries.',citations:[{sourceId:'C1',quoteId:'Q1'}]}]}));planning++;return response(null,'queryDataset',{datasetId:'101',aggregate:{op:'count'}});}});
 const result=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent('Report the inventory entry count.',new AbortController().signal,{search:async()=>[],discover:async()=>[dataset],query:async()=>{queries++;return [{value:3}];}})));
 assert.equal(result.grounded,true);assert.equal(queries,1);assert.equal(planning,3);assert.equal(result.sources[0].quotes.every(q=>result.sources[0].text.includes(q)),true);
}));

test('declared final validated queries skip confirmation; incomplete, truncated and invalid work retains planning',async()=>configured(async()=>{
 const measurements:Record<string,{calls:number;reserved:number}>={};
 for(const kind of ['baseline','complete','complex','empty','truncated','invalid','unsupported','combined'] as const){
  let now=0,calls=0,queries=0,reserved=0,step=0;
  const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_url,init)=>{
   calls++;const body=JSON.parse(String(init?.body));reserved+=estimateGroqTokens(JSON.stringify(body));
   if(body.response_format)return response(JSON.stringify(['empty','invalid','unsupported'].includes(kind)?{answerable:false,statements:[]}:{answerable:true,statements:[{text:'The evidence contains the requested figures.',citations:(kind==='combined'?['D1','C1']:['C1']).map((sourceId,i)=>({sourceId,quoteId:`Q${i+1}`}))}]}));
   if(kind==='combined'&&step++===0)return response(null,'searchDocuments',{question:'Explain the policy.'});
   if((kind==='combined'&&step===2)||(kind!=='combined'&&step++===0))return response(null,'queryDataset',{datasetId:'101',aggregate:{op:'count'},...(kind==='invalid'?{aggregate:{op:'sum',column:'region'}}:{}),...(kind==='truncated'?{limit:1}:{}),evidenceComplete:!['baseline','complex'].includes(kind)});
   return response('Evidence reviewed; stop planning.');
  }});
  const result=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent(kind==='combined'?'Compare guidance.docx with ledger.csv using both sources.':'Describe the requested ledger statistics.',new AbortController().signal,{search:async()=>[doc],discover:async()=>[dataset],query:async input=>{assert.equal('evidenceComplete' in (input as object),false);queries++;return kind==='empty'?[]:[{value:3}];}})));
  assert.equal(calls,['complete','unsupported'].includes(kind)?2:3,kind);assert.equal(result.grounded,!['empty','invalid','unsupported'].includes(kind),kind);assert.equal(queries,kind==='invalid'?0:1,kind);assert.ok(reserved>0);measurements[kind]={calls,reserved};
  if(kind==='combined')assert.deepEqual(result.sources.map(s=>s.type),['document','csv']);
 }
 assert.ok(measurements.complete.reserved<measurements.baseline.reserved);
 console.info('Controlled completion measurements',JSON.stringify(measurements));
}));

test('provider tool-use failure after document search never executes rejected arguments or generates an answer',async()=>configured(async()=>{
 let now=0,calls=0,queries=0,searches=0;
 const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async()=>{
  if(++calls===1)return response(null,'searchDocuments',{question:'Find the fictional policy.'});
  return Response.json({error:{code:'tool_use_failed',message:'Tool generation failed',failed_generation:'not a standard JSON envelope'}},{status:400});
 }});
 await assert.rejects(runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent('Compare the policy with the ledger for the requested entities.',new AbortController().signal,{discover:async()=>[dataset],search:async()=>{searches++;return [doc];},query:async()=>{queries++;return [];}}))),error=>(error as {statusCode?:number}).statusCode===400);
 assert.equal(calls,2);assert.equal(searches,1);assert.equal(queries,0);
}));

test('general combined SLA path checks complete policy before generation even when planner declares completion',async()=>configured(async()=>{
 let now=0,calls=0,contextReads=0;
 const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_url,init)=>{
  calls++;assert.equal(JSON.parse(String(init?.body)).response_format,undefined);
  return calls===1?response(null,'searchDocuments',{question:'Find the first-response policy.'}):response(null,'queryDataset',{datasetId:'101',aggregate:{op:'count'},evidenceComplete:true});
 }});
 const result=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent('Compare the first-response policy with the ledger evidence.',new AbortController().signal,{discover:async()=>[dataset],search:async(_q,_s,options)=>options?.completePolicy?(contextReads++,[{...doc,chunk_text:'P1 first-response deadline is 2 hours.'},{...doc,chunk_id:'52',chunk_index:1,chunk_text:'This policy applies only to Finance.'}]):[{...doc,chunk_text:'P1 first-response deadline is 2 hours.'}],query:async()=>[{value:3}]})));
 assert.equal(result.grounded,false);assert.deepEqual(result.sources,[]);assert.equal(calls,2);assert.equal(contextReads,1);
}));

test('Groq wire contract separates tools from structured output and preserves reasoning and tool IDs',async()=>configured(async()=>{
 let now=0,calls=0;
 const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_url,init)=>{
  const body=JSON.parse(String(init?.body));calls++;assert.equal(body.model,'openai/gpt-oss-120b');assert.equal(body.parallel_tool_calls,false);
  if(calls===1){
   assert.equal(body.response_format,undefined);assert.ok(body.tools.length>0);
   for(const t of body.tools){assert.equal(t.function.parameters.type,'object');assert.equal(t.function.parameters.additionalProperties,false);assert.equal(t.function.strict,undefined);}
   return Response.json({id:'wire-fixture',created:1,model:body.model,choices:[{index:0,message:{role:'assistant',content:null,reasoning:'Use the inspected fictional schema.',tool_calls:[{id:'wire-call-1',type:'function',function:{name:'queryDataset',arguments:JSON.stringify({datasetId:'101',aggregate:{op:'count'}})}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}});
  }
  if(calls===2){
   assert.equal(body.response_format,undefined);const assistant=body.messages.find((m:{role:string;tool_calls?:unknown[]})=>m.role==='assistant'&&m.tool_calls?.length);assert.equal(assistant.reasoning,'Use the inspected fictional schema.');assert.equal(assistant.tool_calls[0].id,'wire-call-1');assert.equal(typeof assistant.tool_calls[0].function.arguments,'string');
   const result=body.messages.find((m:{role:string})=>m.role==='tool');assert.equal(result.tool_call_id,'wire-call-1');assert.doesNotThrow(()=>JSON.parse(result.content));return response('Evidence collected.');
  }
  assert.equal(body.tools,undefined);assert.equal(body.response_format.type,'json_schema');return response(JSON.stringify({answerable:true,statements:[{text:'There are 3 entries.',citations:[{sourceId:'C1',quoteId:'Q1'}]}]}));
 }});
 const r=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent('Describe the number of entries in the fictional ledger.',new AbortController().signal,{search:async()=>[],discover:async()=>[dataset],query:async()=>[{value:3}]})));
 assert.equal(calls,3);assert.equal(r.grounded,true);assert.equal(r.sources[0].type,'csv');
}));


test('schema-aware scripted planner avoids the COUNT-column correction round under the stricter model contract',async()=>configured(async()=>{
 const current=agentModelToolInputs.queryDataset;
 const outcomes:Record<string,{calls:number;reserved:number;queries:number}>={};
 try{
  for(const version of ['legacy','aligned']){
   // Restore the former advertised contract only inside this sequential test.
   const schema=version==='legacy'?agentToolInputs.queryDataset.extend({evidenceComplete:current.shape.evidenceComplete}):current;
   Object.defineProperty(agentModelToolInputs,'queryDataset',{value:schema,writable:true,configurable:true});
   let calls=0,now=0,reserved=0,queries=0;
   const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_url,init)=>{
    const body=JSON.parse(String(init?.body));calls++;reserved+=estimateGroqTokens(JSON.stringify(body));
    if(body.response_format)return response(JSON.stringify({answerable:true,statements:[{text:'There are 3 entries.',citations:[{sourceId:'C1',quoteId:'Q1'}]}]}));
    if(calls===1){
     const aggregate=body.tools.find((t:{function:{name:string}})=>t.function.name==='queryDataset').function.parameters.properties.aggregate;
     const variants=aggregate.anyOf??aggregate.oneOf;
     if(version==='aligned'){
      assert.equal(variants.length,3);
      const count=variants.find((v:{properties:{op:{const:string}}})=>v.properties.op.const==='count');assert.equal(count.additionalProperties,false);assert.equal(count.properties.column,undefined);
      for(const op of ['sum','avg']){const branch=variants.find((v:{properties:{op:{const:string}}})=>v.properties.op.const===op);assert.ok(branch.required.includes('column'));assert.equal(branch.properties.column.type,'string');}
     }else assert.equal(variants,undefined);
     return response(null,'queryDataset',{datasetId:'101',aggregate:variants?{op:'count'}:{op:'count',column:'amount'}});
    }
    if(version==='legacy'&&calls===2)return response(null,'queryDataset',{datasetId:'101',aggregate:{op:'count'}});
    return response('Evidence collected.');
   }});
   const result=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent('Count entries in the fictional ledger.',new AbortController().signal,{search:async()=>[],discover:async()=>[dataset],query:async()=>{queries++;return [{value:3}];}})));
   assert.equal(result.grounded,true);assert.equal(result.sources[0].type,'csv');assert.ok(result.sources[0].quotes.every(q=>result.sources[0].text.includes(q)));assert.equal(queries,1);outcomes[version]={calls,reserved,queries};
  }
 }finally{Object.defineProperty(agentModelToolInputs,'queryDataset',{value:current,writable:true,configurable:true});}
 assert.equal(outcomes.legacy.calls,4);assert.equal(outcomes.aligned.calls,3);assert.ok(outcomes.aligned.reserved<outcomes.legacy.reserved);
 console.info('Controlled COUNT schema comparison',JSON.stringify(outcomes));
}));

test('evidence preparation removes a document-selection round while retaining follow-up planning and citations',async()=>configured(async()=>{
 const outcomes:Record<string,{calls:number;reserved:number;queries:number}>={};
 for(const version of ['baseline','prepared']){
  let calls=0,now=0,reserved=0,step=0,queries=0;
  const filename='terms-policy.pdf',question=`Compare ledger.csv with ${filename} using both sources.`;
  const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_url,init)=>{
   calls++;reserved+=estimateGroqTokens(String(init?.body));const body=JSON.parse(String(init?.body));
   if(body.response_format)return response(JSON.stringify({answerable:true,statements:[{text:'The total is 35 credits versus the 75-credit threshold, a difference of 40 credits.',citations:[{sourceId:'D1',quoteId:'Q1'},{sourceId:'C1',quoteId:'Q2'}]}]}));
   const prompt=JSON.parse(body.messages.find((m:{role:string})=>m.role==='user').content);
   if(step++===0&&!prompt.preparedEvidence?.documents.length)return response(null,'searchDocuments',{question});
   if(step===(version==='baseline'?2:1))return response(null,'queryDataset',{datasetId:'101',aggregate:{op:'sum',column:'amount'}});
   return response('Evidence collected.');
  }});
  const result=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent(question,new AbortController().signal,{search:async()=>[{...doc,filename}],discover:async()=>[dataset],query:async()=>{queries++;return [{value:35}];},...(version==='prepared'?{policies:async()=>({documents:[{id:'21',filename}],truncated:false})}:{})})));
  assert.equal(result.grounded,true);assert.deepEqual(result.sources.map(s=>s.type),['document','csv']);assert.ok(result.sources.every(s=>s.quotes.every(q=>s.text.includes(q))));outcomes[version]={calls,reserved,queries};
 }
 assert.equal(outcomes.baseline.calls,4);assert.equal(outcomes.prepared.calls,3);assert.equal(outcomes.prepared.queries,1);assert.ok(outcomes.prepared.reserved<outcomes.baseline.reserved);
 console.info('Controlled evidence-first comparison',JSON.stringify(outcomes));
}));

test('named policy blockers refuse before any provider call and early query checks stop confirmation loops',async()=>configured(async()=>{
 let calls=0,queries=0;
 const services:AgentServices={policies:async()=>({documents:[{id:'21',filename:'rules-policy.pdf'}],truncated:false}),discover:async()=>[dataset],search:async(_q,_s,o)=>o?.completePolicy?[{...doc,filename:'rules-policy.pdf',chunk_text:'P1 first-response deadline is 2 hours.'},{...doc,filename:'rules-policy.pdf',chunk_id:'52',chunk_text:'Effective 1 October 2026. This policy applies only to Finance.'}]:[{...doc,filename:'rules-policy.pdf',chunk_text:'P1 first-response deadline is 2 hours.'}],query:async()=>{queries++;return [{value:3}];}};
 const q='Compare the first-response policy in rules-policy.pdf against ledger.csv.';
 const provider=createGroqTransport({rpm:12,fetch:async()=>{calls++;assert.fail('Blocked applicability needs no Groq call');}});
 const result=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent(q,new AbortController().signal,services)));assert.equal(result.grounded,false);assert.equal(calls,0);assert.equal(queries,0);
 let now=0;
 const continuation=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async()=>++calls===1?response(null,'searchDocuments',{question:'Find the first-response policy.'}):response(null,'queryDataset',{datasetId:'101',aggregate:{op:'count'}})});
 const afterQuery=await runWithIdentity('101',()=>withGroqTransport(continuation,()=>answerWithAgent('Compare first-response policy against CSV evidence.',new AbortController().signal,{...services,policies:undefined})));
 assert.equal(afterQuery.grounded,false);assert.equal(calls,2);assert.equal(queries,1);
}));

test('partial prepared previews do not hide full original excerpts from follow-up tools',async()=>configured(async()=>{
 let now=0,calls=0;const filename='detail-policy.pdf',q=`Compare ledger.csv with ${filename} using both sources.`;
 const text='Original evidence. '.repeat(250)+'DETAIL_AT_END';
 const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async ms=>{now+=ms;}},fetch:async(_url,init)=>{
  calls++;const body=JSON.parse(String(init?.body));
  if(body.response_format)return response(JSON.stringify({answerable:false,statements:[]}));
  if(calls===1){const prompt=JSON.parse(body.messages.find((m:{role:string})=>m.role==='user').content);assert.equal(prompt.preparedEvidence.documents[0].partial,true);return response(null,'searchDocuments',{question:q});}
  const result=JSON.parse(body.messages.find((m:{role:string})=>m.role==='tool').content);assert.equal(result.sources[0].text,text);assert.ok(result.sources[0].text.includes('DETAIL_AT_END'));return response('More evidence is required.');
 }});
 const r=await runWithIdentity('101',()=>withGroqTransport(provider,()=>answerWithAgent(q,new AbortController().signal,{policies:async()=>({documents:[{id:'21',filename}],truncated:false}),search:async()=>[{...doc,filename,chunk_text:text}],discover:async()=>[dataset],query:async()=>assert.fail('No query was requested')})));
 assert.equal(calls,3);assert.equal(r.grounded,false);
}));

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encode} from 'gpt-tokenizer/encoding/o200k_harmony';
import {prepareAgentEvidence} from '../src/lib/agent-evidence-preparation';
import {createAgentSession,type AgentServices} from '../src/lib/agent-tools';
const question='Compare event-data.csv with generic-policy.pdf using both sources.';
const policy={id:'21',filename:'generic-policy.pdf'};
const row={document_id:'21',chunk_id:'51',filename:policy.filename,chunk_index:0,page_number:1,chunk_text:'The comparison threshold is 25 units.',similarity:.99};
test('evidence preparation refuses to choose ambiguous, truncated, negated or merely substring-matching sources',async()=>{
 for(const catalog of [{documents:[policy,policy],truncated:false},{documents:[policy],truncated:true},{documents:[],truncated:false}]){
  const s=createAgentSession({search:async()=>assert.fail('Do not prefetch ambiguous sources'),discover:async()=>[],query:async()=>[],policies:async()=>catalog},new AbortController().signal,.5);
  assert.equal(await prepareAgentEvidence(question,s),undefined);
 }
 for(const q of [question.replace('generic-policy.pdf','alternate-generic-policy.pdf'),'Compare event-data.csv without generic-policy.pdf.']){
  const s=createAgentSession({search:async()=>assert.fail('Do not prefetch excluded sources'),discover:async()=>[],query:async()=>[],policies:async()=>({documents:[policy],truncated:false})},new AbortController().signal,.5);
  assert.equal(await prepareAgentEvidence(q,s),undefined);
 }
});
test('bounded prepared previews preserve original evidence and preparation errors retain normal tools',async()=>{
 const text='An original evidence fragment. '.repeat(300);let searches=0;
 const services:AgentServices={policies:async()=>({documents:[policy],truncated:false}),search:async()=>{searches++;return [{...row,chunk_text:text}];},discover:async()=>[],query:async()=>[]};
 const s=createAgentSession(services,new AbortController().signal,.5);const prepared=await prepareAgentEvidence(question,s);
 assert.ok(prepared&&!prepared.blocked);assert.ok(encode(JSON.stringify(prepared.documents)).length<=800);assert.equal(prepared.documents[0].partial,true);assert.ok(text.startsWith(prepared.documents[0].text));assert.equal(s.evidence().documents[0].text,text.slice(0,6000));assert.equal(searches,1);
 const failed=createAgentSession({...services,policies:async()=>{throw Error('Metadata unavailable');}},new AbortController().signal,.5);assert.equal(await prepareAgentEvidence(question,failed),undefined);
 const controller=new AbortController();controller.abort();const cancelled=createAgentSession(services,controller.signal,.5);await assert.rejects(prepareAgentEvidence(question,cancelled,controller.signal),{name:'AbortError'});
});

test('available scope columns are not mistaken for evaluated row-level policy applicability',async()=>{
 // Without coherent snapshot integration, advertised columns alone cannot
 // authorize bypassing the mandatory policy check.
 for(const organization of ['Fictional Fixture Operations',null]){
  let queried=0;
  const s=createAgentSession({policies:async()=>({documents:[policy],truncated:false}),search:async(_q,_s,options)=>options?.completePolicy?[row,{...row,chunk_id:'52',chunk_index:1,chunk_text:'This policy applies only when organization equals Fictional Fixture Operations and incident_at is on or after 2030-01-01T00:00:00Z.'}]:[{...row,chunk_text:'P1 first-response deadline is 2 hours.'}],discover:async()=>[{id:'101',filename:'event-data.csv',row_count:1,columns:[{name:'organization',type:'text'},{name:'incident_at',type:'text'},{name:'response_hours',type:'number'}]}],query:async()=>{queried++;return [{organization,incident_at:'2030-02-01T00:00:00Z',response_hours:3}];}},new AbortController().signal,.5);
  const discovered=await s.execute('discoverDatasets',{});assert.ok(discovered);await s.execute('inspectDataset',{datasetId:'101'});
  const result=await prepareAgentEvidence('Compare first-response deadlines in generic-policy.pdf with event-data.csv using both sources.',s);
  assert.equal(result?.blocked,true);assert.equal(queried,0);assert.equal(s.evidence().csv.length,0);
 }
});

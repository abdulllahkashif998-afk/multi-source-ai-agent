import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAgentSession} from '../src/lib/agent-tools';
import {CitationVerificationError,citationVerificationReason} from '../src/lib/chat-errors';
import {safeError,withRequest} from '../src/lib/reliability';
import {agentDiagnosticRecord,createAgentTrace} from '../src/lib/agent-diagnostics';
import {runWithIdentity} from '../src/lib/identity';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {createGroqTransport,withGroqTransport} from '../src/lib/groq-transport';
const text='Fictional policy: review amounts above 20 units.\nKeep exact PDF whitespace.';
const row={document_id:'11',chunk_id:'12',filename:'fictional-policy.pdf',chunk_index:4,page_number:null,chunk_text:text,similarity:.9};
function session(){return createAgentSession({search:async()=>[row],discover:async()=>[{id:'31',filename:'fictional.csv',columns:[{name:'amount',type:'number' as const}],row_count:1}],query:async()=>[{amount:30}]},new AbortController().signal,.5);}
const answer=(sourceId:string,quote:string,claim='A fictional amount needs review.')=>({answerable:true,statements:[{text:claim,citations:[{sourceId,quote}]}]});
function reason(work:()=>unknown,expected:string){assert.throws(work,(error:unknown)=>{assert.ok(error instanceof CitationVerificationError);assert.equal(error.code,'UNSUPPORTED_ANSWER');assert.equal(error.status,502);assert.equal(error.name,'ChatError');assert.equal(citationVerificationReason(error),expected);return true;});}
test('agent verifier identifies every rejection rule while preserving status and strict checks',async()=>{
 const s=session();await s.execute('searchDocuments',{question:'Fictional policy?'});
 reason(()=>s.finalize({answerable:true,statements:[{text:'Claim',citations:[]}]}),'citation_invalid_shape');
 reason(()=>s.finalize({answerable:true,statements:[]}),'citation_empty_statements');
 reason(()=>s.finalize(answer('D1',text,'Claim [D1]')),'citation_marker_in_statement');
 for(const id of ['S1','D99','C1'])reason(()=>s.finalize(answer(id,text)),'citation_unknown_source');
 for(const quote of ['review amounts above 99 units.','20 units. Keep exact PDF whitespace.'])reason(()=>s.finalize(answer('D1',quote)),'citation_quote_not_in_source');
 const documentSource=s.finalize(answer('D1',text)).sources[0];assert.ok('chunkId' in documentSource);assert.equal(documentSource.chunkId,'12');
 assert.equal(s.finalize({answerable:false,statements:[]}).grounded,false);
});
test('CSV synthetic source mapping preserves exact JSON and combined document/CSV identities',async()=>{
 const s=session();await s.execute('searchDocuments',{question:'Policy?'});await s.execute('discoverDatasets',{});await s.execute('inspectDataset',{datasetId:'31'});await s.execute('queryDataset',{datasetId:'31'});
 for(const quote of ['{"amount": 30}','{"amount":999}'])reason(()=>s.finalize(answer('C1',quote)),'citation_quote_not_in_source');
 reason(()=>s.finalize(answer('D1','{"amount":30}')),'citation_quote_not_in_source');
 reason(()=>s.finalize(answer('C1',text)),'citation_quote_not_in_source');
 const result=s.finalize({answerable:true,statements:[{text:'The amount exceeds the policy.',citations:[{sourceId:'D1',quote:'above 20 units.'},{sourceId:'C1',quote:'{"amount":30}'}]}]});
 assert.deepEqual(result.sources.map(s=>s.type),['document','csv']);assert.equal(result.sources[0].id,'D1');assert.equal(result.sources[1].id,'C1');
 const csv=result.sources.find(s=>s.type==='csv')!;assert.ok('datasetId' in csv&&'rows' in csv);assert.equal(csv.datasetId,'31');assert.equal(csv.text,'[{"amount":30}]');assert.deepEqual(csv.rows,[{amount:30}]);assert.deepEqual(csv.quotes,['{"amount":30}']);
});
test('repeated document searches keep stable backend IDs and do not confuse CSV IDs',async()=>{
 const s=session();await s.execute('searchDocuments',{question:'First?'});await s.execute('searchDocuments',{question:'Second?'});
 assert.equal(s.evidence().documents.length,2);const result=s.finalize(answer('D2',text));const doc=result.sources[0];assert.ok('documentId' in doc&&'chunkIndex' in doc);assert.equal(doc.id,'D2');assert.equal(doc.documentId,'11');assert.equal(doc.chunkIndex,4);
 reason(()=>s.finalize(answer('C2',text)),'citation_unknown_source');
});
test('reason logging is allowlisted and never emits private quote, source ID or forged reason',async()=>{
 const lines:string[]=[];const original=console.info;console.info=(...args)=>{lines.push(args.join(' '));};
 try{const response=await withRequest(new Request('http://localhost/api/agent'),async()=>{
 const trace=createAgentTrace();try{const s=session();await s.execute('searchDocuments',{question:'Fictional?'});s.finalize(answer('private-source-id','private-quote-content','private-claim-content'));}catch(error){trace.record('citation-verification',performance.now(),'error',undefined,error);trace.flush('failed');assert.equal(agentDiagnosticRecord('citation-verification',error).reason,'citation_unknown_source');}return Response.json({ok:true});});
 assert.match(response.headers.get('X-Request-ID')!,/^[0-9a-f-]{36}$/);assert.ok(lines.some(l=>l.includes('"reason":"citation_unknown_source"')));assert.ok(!lines.join('').includes('private-'));
 const forged=Object.assign(Error('private-error'),{verificationReason:'private-reason'});assert.equal(safeError(forged).reason,undefined);assert.equal(agentDiagnosticRecord('citation-verification',forged).reason,undefined);
 const mutated=new CitationVerificationError('citation_unknown_source');Object.assign(mutated,{verificationReason:'private-reason'});assert.equal(safeError(mutated).reason,undefined);
 }finally{console.info=original;}
});
test('mocked Groq agent pipeline reports the exact post-generation citation rule without network',async()=>{
 const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL','GROQ_REQUESTS_PER_MINUTE','RAG_MIN_SIMILARITY'] as const,old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch,info=console.info;const lines:string[]=[];console.info=(...args)=>{lines.push(args.join(' '));};globalThis.fetch=async()=>assert.fail('no live HTTP allowed');
 Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional-test-key',GROQ_MODEL:'openai/gpt-oss-20b',GROQ_REQUESTS_PER_MINUTE:'12',RAG_MIN_SIMILARITY:'.5'});
 const ref=(sourceId:string,quoteId:string,claim='A fictional claim.')=>({answerable:true,statements:[{text:claim,citations:[{sourceId,quoteId}]}]});
 try{for(const [output,expected] of [[ref('S1','Q1'),'citation_unknown_source'],[ref('D1','Q999'),'citation_unknown_quote_reference'],[ref('D1','Q2'),'citation_reference_source_mismatch'],[ref('D1','Q1','Claim [D1]'),'citation_marker_in_statement'],[{answerable:true,statements:[]},'citation_empty_statements']] as const){
 let now=0,calls=0;const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async(ms)=>{now+=ms;}},fetch:async(_url,init)=>{
 const body=JSON.parse(String(init?.body));calls++;const final=!!body.response_format;const tool=!final&&calls===1;
 return Response.json({id:'fictional',created:1,model:'openai/gpt-oss-20b',choices:[{index:0,message:{role:'assistant',content:final?JSON.stringify(output):tool?null:'Evidence collected.',...(tool?{tool_calls:[{id:'tool-1',type:'function',function:{name:'searchDocuments',arguments:JSON.stringify({question:'Fictional policy?'})}}]}:{})},finish_reason:tool?'tool_calls':'stop'}]});
 }});
 await assert.rejects(runWithIdentity('4',()=>withGroqTransport(provider,()=>answerWithAgent('Fictional question',new AbortController().signal,{search:async()=>[row,{...row,document_id:'13',chunk_id:'14',chunk_text:'Different fictional evidence.'}],discover:async()=>[],query:async()=>[]}))),(error:unknown)=>{assert.ok(error instanceof CitationVerificationError);assert.equal(error.verificationReason,expected);return true;});
 assert.equal(calls,3);assert.ok(lines.some(l=>l.includes('"stage":"citation-verification"')&&l.includes(`"reason":"${expected}"`)));
 }}finally{globalThis.fetch=originalFetch;console.info=info;for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
test('agent reference choices cover late documents and full-length CSV results without RAG truncation',async()=>{
 const {agentQuoteChoices}=await import('../src/lib/agent-answer-schema');const {resolveDocumentAnswer}=await import('../src/lib/document-answer-schema');
 const documents=Array.from({length:5},(_,i)=>({id:`D${i+1}`,text:`Original fictional document ${i+1}.`}));
 const csvText='[{"note":"'+'x'.repeat(22000)+'","amount":93}]';const evidence={documents,csv:[{id:'C1',text:csvText}]};
 const choices=agentQuoteChoices(evidence);assert.ok(choices.some(q=>q.sourceId==='D5'));const late=choices.find(q=>q.sourceId==='C1'&&q.quote.includes('"amount":93'));assert.ok(late);assert.ok(choices.every(q=>q.quote.length<=2000&&[...documents,...evidence.csv].find(s=>s.id===q.sourceId)!.text.includes(q.quote)));
 const value={answerable:true,statements:[{text:'A supported fictional amount.',citations:[{sourceId:'C1',quoteId:late.quoteId}]}]};assert.equal(resolveDocumentAnswer(value,choices).statements[0].citations[0].quote,late.quote);
 assert.deepEqual(agentQuoteChoices({documents:[],csv:[]}),[]);assert.deepEqual(resolveDocumentAnswer({answerable:false,statements:[]},[]),{answerable:false,statements:[]});
 assert.throws(()=>agentQuoteChoices({documents:[documents[0],documents[0]],csv:[]}));
});

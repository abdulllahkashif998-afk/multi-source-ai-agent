import {test,mock,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {askAI,parseChatAnswer,validateQuestion,csvEvidenceTable} from '../src/lib/ai-chat-client';
const doc=(id='S1',typed=false)=>({id,filename:'Fictional policy.docx',chunkIndex:0,pageNumber:null,text:'Ocean policy requires review.',quotes:['Ocean policy requires review.'],...(typed?{type:'document'}:{})});
const csv={id:'C1',type:'csv',filename:'Fictional.csv',rows:[{team:'Beta',value:6}],text:'[{"team":"Beta","value":6}]',quotes:['{"team":"Beta","value":6}'],possiblyTruncated:false};
const rag={success:true,grounded:true,answer:'Ocean policy requires review. [S1]',sources:[doc()]};
const agent={success:true,grounded:true,answer:'Review the policy and Beta’s amount. [D1] [C1]',sources:[doc('D1',true),csv]};
const session={success:true,name:'Fictional',email:'fictional@example.test',csrfToken:'c'.repeat(64)};
afterEach(()=>mock.restoreAll());
test('chat question validation follows the trimmed 1–2000 character contract',()=>{
 assert.equal(validateQuestion('  question\nline  '),'question\nline');assert.equal(validateQuestion('x'.repeat(2000)).length,2000);
 for(const value of ['', '  ', 'x'.repeat(2001),null,{},42])assert.throws(()=>validateQuestion(value),{code:'INVALID_QUESTION'});
});
test('RAG and agent schemas normalize their distinct document/CSV sources without inventing metadata',()=>{
 const a=parseChatAnswer('documents',rag);assert.equal(a.sources[0].type,'document');assert.equal(a.sources[0].id,'S1');assert.equal(a.answer,rag.answer);
 const b=parseChatAnswer('agent',agent);assert.deepEqual(b.sources.map(s=>s.type),['document','csv']);assert.ok(!('chunkIndex' in b.sources[1]));
 const missing={...doc()};Reflect.deleteProperty(missing,'chunkIndex');Reflect.deleteProperty(missing,'pageNumber');const result=parseChatAnswer('documents',{...rag,sources:[missing]});assert.ok(!('chunkIndex' in result.sources[0]));
 assert.throws(()=>parseChatAnswer('documents',agent),{code:'INVALID_RESPONSE'});assert.throws(()=>parseChatAnswer('agent',rag),{code:'INVALID_RESPONSE'});
});
test('missing information is a valid abstention; unsupported citation payloads fail closed',()=>{
 for(const mode of ['agent','documents'] as const)assert.deepEqual(parseChatAnswer(mode,{success:true,grounded:false,answer:'Insufficient evidence.',sources:[]}),{grounded:false,answer:'Insufficient evidence.',sources:[]});
 for(const value of [{...rag,sources:[]},{...rag,answer:'Made up [S9]'},{...rag,sources:[{...doc(),quotes:['invented quote']}]},{...rag,sources:[doc(),doc()]},{...rag,grounded:false}])assert.throws(()=>parseChatAnswer('documents',value),{code:'INVALID_RESPONSE'});
});
test('CSV evidence supports zero, false, null and prototype-named columns; non-tabular evidence has a safe fallback',()=>{
 const row=JSON.parse('{"__proto__":"literal","value":0,"active":false,"empty":null}');const table=csvEvidenceTable([row]);assert.ok(table);assert.equal(Object.hasOwn(table.rows[0],'__proto__'),true);assert.equal(table.rows[0].value,0);
 for(const rows of [[],[1],[{nested:{data:'text'}}],[[1,2]]])assert.equal(csvEvidenceTable(rows),null);
});
test('both modes send only a question with same-origin cookies and a fresh CSRF token',async()=>{
 for(const mode of ['agent','documents'] as const){const writes:string[]=[];
 mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{if(url==='/api/auth/session')return Response.json(session);writes.push(String(url));assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');assert.equal(init?.method,'POST');assert.equal(new Headers(init?.headers).get('X-CSRF-Token'),session.csrfToken);assert.deepEqual(JSON.parse(String(init?.body)),{question:'A question'});return Response.json(mode==='agent'?agent:rag);});
 const result=await askAI(mode,'  A question  ');assert.equal(result.grounded,true);assert.deepEqual(writes,[mode==='agent'?'/api/agent':'/api/chat']);mock.restoreAll();}
});
test('provider rate limits, timeout, service and citation failures are safely classified with no automatic retry',async()=>{
 for(const [status,code,expected] of [[429,'private','PROVIDER_RATE_LIMITED'],[504,'AGENT_TIMEOUT','REQUEST_TIMEOUT'],[503,'CHAT_NOT_CONFIGURED','CHAT_NOT_CONFIGURED'],[503,'PROVIDER_BILLING_REQUIRED','SERVICE_UNAVAILABLE'],[503,'private','SERVICE_UNAVAILABLE'],[502,'UNSUPPORTED_ANSWER','UNSUPPORTED_ANSWER'],[403,'CSRF_REJECTED','CSRF_REJECTED'],[401,'UNAUTHENTICATED','UNAUTHENTICATED']] as const){
 let writes=0;mock.method(globalThis,'fetch',async(url:unknown)=>{if(url==='/api/auth/session')return Response.json(session);writes++;return Response.json({success:false,code,error:'secret provider body and API key'},{status});});
 await assert.rejects(askAI('agent','Question'),(error:unknown)=>error instanceof Error&&!error.message.includes('secret')&&(error as {code?:string}).code===expected);assert.equal(writes,1);mock.restoreAll();}
});
test('invalid questions and expired or cancelled sessions do not reach AI endpoints',async()=>{
 mock.method(globalThis,'fetch',()=>assert.fail('invalid question must not request'));await assert.rejects(askAI('agent',' '),{code:'INVALID_QUESTION'});mock.restoreAll();
 let writes=0;mock.method(globalThis,'fetch',async(url:unknown)=>{if(url!=='/api/auth/session')writes++;return Response.json({success:false,code:'UNAUTHENTICATED'},{status:401});});await assert.rejects(askAI('agent','Question'),{code:'UNAUTHENTICATED'});assert.equal(writes,0);mock.restoreAll();
 mock.method(globalThis,'fetch',async(url:unknown)=>{if(url!=='/api/auth/session')writes++;return Response.json(session);});await assert.rejects(askAI('documents','Question',AbortSignal.abort()));assert.equal(writes,0);
});
test('network failures and invalid JSON do not expose raw errors or trigger retries',async()=>{
 let writes=0;mock.method(globalThis,'fetch',async(url:unknown)=>{if(url==='/api/auth/session')return Response.json(session);writes++;throw new Error('private transport credentials');});await assert.rejects(askAI('agent','Question'),{code:'CONNECTION_FAILED'});assert.equal(writes,1);mock.restoreAll();
 mock.method(globalThis,'fetch',async(url:unknown)=>url==='/api/auth/session'?Response.json(session):new Response('private HTML'));await assert.rejects(askAI('agent','Question'),{code:'INVALID_RESPONSE'});
});
test('client deadline classification preserves separate RAG/agent backend budgets',async()=>{
 const original=AbortSignal.timeout.bind(AbortSignal);const seen:number[]=[];
 mock.method(AbortSignal,'timeout',(ms:number)=>{seen.push(ms);return ms===65000?AbortSignal.abort(new DOMException('Timeout','TimeoutError')):original(ms);});
 mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{if(url==='/api/auth/session')return Response.json(session);init?.signal?.throwIfAborted();return Response.json(rag);});
 await assert.rejects(askAI('agent','Question'),{code:'REQUEST_TIMEOUT'});assert.ok(seen.includes(65000));await askAI('documents','Question');assert.ok(seen.includes(50000));
});
test('AI endpoints reject missing CSRF and foreign origins before retrieval or provider calls',async()=>{
 const {POST:chat}=await import('../app/api/chat/route');const {POST:agent}=await import('../app/api/agent/route');const {default:pool}=await import('../src/lib/db');const {sessionHeaders,sessionRow}=await import('./test-context');
 mock.method(pool,'query',async(sql:unknown)=>{assert.ok(String(sql).startsWith('SELECT s.user_id'));return {rows:[sessionRow]};});mock.method(globalThis,'fetch',()=>assert.fail('CSRF rejection must precede provider/retrieval'));
 for(const route of [chat,agent])for(const headers of [{Cookie:sessionHeaders.Cookie,Origin:sessionHeaders.Origin},{...sessionHeaders,Origin:'https://untrusted.example'}]){const response=await route(new Request('http://localhost:3000/api/chat',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({question:'Fictional question'})}));assert.equal(response.status,403);}
});

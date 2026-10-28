import { mock } from 'node:test';
import { test, withMockGeminiClock } from './provider-context';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import pool from '../src/lib/db';
import { hashPassword, verifyPassword, verifiedSession, accountRequest, sessionRequest, logoutRequest, authenticated } from '../src/lib/auth';
import { requireUserId, runWithIdentity } from '../src/lib/identity';
const csrf='c'.repeat(64),token='d'.repeat(64);
const origin='http://localhost:3000';
function request(url='/api/auth/login',body:unknown={},cookie?:string,csrfToken?:string,method='POST') {
 return new Request(origin+url,{method,headers:{'Content-Type':'application/json','Origin':origin,...(cookie?{'Cookie':cookie}:{}),...(csrfToken?{'X-CSRF-Token':csrfToken}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});
}
function session(response:Response,body:{csrfToken:string;userId:string}) {
 return {cookie:response.headers.get('set-cookie')!.split(';')[0],csrf:body.csrfToken,userId:body.userId};
}
test('passwords use unique salted scrypt hashes with constant-time verification',async()=>{
 const one=await hashPassword('Fictional long password 1!'),two=await hashPassword('Fictional long password 1!');
 assert.notEqual(one,two);assert.ok(!one.includes('Fictional'));assert.equal(await verifyPassword('Fictional long password 1!',one),true);assert.equal(await verifyPassword('Different long password!',one),false);assert.equal(await verifyPassword('irrelevant','malformed'),false);
});
test('missing, malformed, forged and expired sessions have no identity fallback',async()=>{
 mock.method(pool,'query',async()=>({rows:[]}));
 try{
 for(const cookie of [undefined,'knowledge-session=1',`knowledge-session=${token}`,`knowledge-session=${token}; knowledge-session=${token}`])await assert.rejects(verifiedSession(request('/api/auth/session',{},cookie,undefined,'GET')),(e:unknown)=>(e as {status:number}).status===401);
 assert.throws(requireUserId);
 }finally{mock.restoreAll();}
});
test('session lookup uses a token hash, expiry and session-bound CSRF plus origin',async()=>{
 let lookup:unknown[]=[];
 mock.method(pool,'query',async(sql:string,values:unknown[])=>{lookup=values;assert.match(sql,/expires_at>now\(\)/);return {rows:[{user_id:'7',csrf_token:csrf,name:'Fictional',email:'fictional@example.test'}]};});
 try{
 const valid=request('/api/anything',{},`knowledge-session=${token}`,csrf);assert.equal((await verifiedSession(valid)).userId,'7');
 assert.equal(lookup[0],createHash('sha256').update(token).digest('hex'));assert.notEqual(lookup[0],token);
 for(const mutation of [new Request(valid,{headers:{...Object.fromEntries(valid.headers),'origin':'https://attacker.example'}}),request('/api/anything',{},`knowledge-session=${token}`),request('/api/anything',{},`knowledge-session=${token}`,'e'.repeat(64))])await assert.rejects(verifiedSession(mutation),(e:unknown)=>(e as {status:number}).status===403);
 const route=authenticated(async()=>Response.json({id:requireUserId()}));assert.equal((await (await route(valid)).json()).id,'7');
 assert.throws(requireUserId);
 }finally{mock.restoreAll();}
});
test('signup/login reject invalid payloads and cross-origin login before database access',async()=>{
 mock.method(pool,'query',()=>assert.fail('invalid input must not reach database'));
 try{
 assert.equal((await accountRequest(request('/api/auth/signup',{email:'bad',password:'short'}),true)).status,400);
 const cross=new Request(request('/api/auth/login',{email:'fictional@example.test',password:'Fictional password 123!'}),{headers:{'Content-Type':'application/json','Origin':'https://attacker.example'}});
 assert.equal((await accountRequest(cross,false)).status,403);
 }finally{mock.restoreAll();}
});
test('all protected APIs reject anonymous requests before touching tools or storage',async()=>{
 const {POST:chat}=await import('../app/api/chat/route');const {POST:agent}=await import('../app/api/agent/route');const {POST:upload}=await import('../app/api/upload/route');const {GET:datasets,POST:csv}=await import('../app/api/datasets/route');const {POST:query}=await import('../app/api/datasets/query/route');const {PUT,DELETE}=await import('../app/api/documents/[id]/route');const {POST:cleanup}=await import('../app/api/documents/cleanup/route');const {GET:documents}=await import('../app/api/documents/route');
 mock.method(pool,'query',()=>assert.fail('anonymous request must not touch database'));
 try{
 for(const route of [chat,agent,upload,csv,query,cleanup])assert.equal((await route(request('/api/protected'))).status,401);
 assert.equal((await datasets(request('/api/datasets',{},undefined,undefined,'GET'))).status,401);
 assert.equal((await documents(request('/api/documents',{},undefined,undefined,'GET'))).status,401);
 for(const route of [PUT,DELETE])assert.equal((await route(request('/api/documents/1'),{params:Promise.resolve({id:'1'})})).status,401);
 }finally{mock.restoreAll();}
});
test('trusted user scopes remain isolated during overlapping async work',async()=>{
 const seen=await Promise.all(['7','8'].map(id=>runWithIdentity(id,async()=>{await Promise.resolve();return requireUserId();})));
 assert.deepEqual(seen,['7','8']);assert.throws(requireUserId);
});
test('PostgreSQL signup/login/logout and A/B evidence isolation',{skip:process.env.RUN_AUTH_DB_TESTS!=='1'},async()=>{
 const client=await pool.connect();const raw=client.query.bind(client);
 const previousKey=process.env.GOOGLE_GENERATIVE_AI_API_KEY;process.env.GOOGLE_GENERATIVE_AI_API_KEY='fictional-test-key';
 try {
 await raw('BEGIN');
 const tables=['users','auth_credentials','auth_sessions','auth_rate_limits','documents','document_chunks','document_events','document_file_cleanup','generic_csv_datasets','generic_csv_rows','csv_datasets','employee_leaves'];
 for(const table of tables){
 await raw(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING IDENTITY INCLUDING INDEXES) ON COMMIT DROP`);
 const metadata=(await raw("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='id'",[table])).rows[0];
 if(metadata?.column_default?.includes('nextval(')){const sequence=`auth_test_${table}_ids`;await raw(`CREATE TEMP SEQUENCE ${sequence} START 20001`);await raw(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.${sequence}')`);}
 }
 const query=async(input:string|{text:string;values?:unknown[]},values?:unknown[])=>{
 const sql=typeof input==='string'?input:input.text;
 if(typeof input!=='string')values=input.values;
 if(sql.startsWith('BEGIN'))return raw('SAVEPOINT auth_operation');
 if(sql==='COMMIT')return raw('RELEASE SAVEPOINT auth_operation');
 if(sql==='ROLLBACK'){await raw('ROLLBACK TO SAVEPOINT auth_operation');return raw('RELEASE SAVEPOINT auth_operation');}
 return raw(sql,values);
 };
 mock.method(pool,'query',async(sql:string|{text:string;values?:unknown[]},values?:unknown[])=>typeof sql==='string'?query(sql,values):query(sql.text,sql.values));
 mock.method(pool,'connect',async()=>({query,release:()=>{}}));
 const aResponse=await accountRequest(request('/api/auth/signup',{email:'a@example.test',name:'Fictional A',password:'Fictional password A!'}),true);assert.equal(aResponse.status,201);const a=session(aResponse,await aResponse.json());
 const bResponse=await accountRequest(request('/api/auth/signup',{email:'b@example.test',name:'Fictional B',password:'Fictional password B!'}),true);assert.equal(bResponse.status,201);const b=session(bResponse,await bResponse.json());
 assert.match(aResponse.headers.get('set-cookie')!,/HttpOnly/);assert.match(aResponse.headers.get('set-cookie')!,/SameSite=Strict/);assert.match(aResponse.headers.get('set-cookie')!,/Max-Age=28800/);
 assert.equal((await accountRequest(request('/api/auth/signup',{email:'A@example.test',name:'Duplicate',password:'Fictional password A!'}),true)).status,409);
 assert.equal((await accountRequest(request('/api/auth/login',{email:'a@example.test',password:'Incorrect password here!'}),false)).status,401);
 const logged=await accountRequest(request('/api/auth/login',{email:'A@example.test',password:'Fictional password A!'}),false);assert.equal(logged.status,200);const login=session(logged,await logged.json());assert.notEqual(login.cookie,a.cookie);
 const {ingestDocument,deleteDocument,cleanupDocumentFiles}=await import('../src/lib/document-lifecycle');
 const dependencies={parse:async(buffer:Buffer)=>buffer.toString(),embed:async()=>[1,...Array(767).fill(0)],save:async()=> 'fictional-path',remove:async()=>{}};
 const upload=authenticated(async()=>Response.json(await ingestDocument('fictional.docx',Buffer.from(`Owned fictional evidence ${requireUserId()===a.userId?'A':'B'}. Review amounts above 7.`),new AbortController().signal,undefined,dependencies)));
 const docA=await (await upload(request('/api/upload',{},a.cookie,a.csrf))).json();const docB=await (await upload(request('/api/upload',{},b.cookie,b.csrf))).json();
 assert.equal(String((await raw('SELECT user_id FROM documents WHERE id=$1',[docA.documentId])).rows[0].user_id),a.userId);
 const {GET:discover,POST:csvUpload}=await import('../app/api/datasets/route');const {POST:csvQuery}=await import('../app/api/datasets/query/route');
 function csvRequest(identity:{cookie:string;csrf:string;userId:string},content:string){const form=new FormData();form.set('file',new File([content],'private.csv',{type:'text/csv'}));return new Request(origin+'/api/datasets',{method:'POST',headers:{Origin:origin,Cookie:identity.cookie,'X-CSRF-Token':identity.csrf},body:form});}
 const csvAResponse=await csvUpload(csvRequest(a,'team,amount\nAlpha,10'));assert.equal(csvAResponse.status,200);const csvA=await csvAResponse.json();
 const csvBResponse=await csvUpload(csvRequest(b,'team,amount\nBeta,10'));assert.equal(csvBResponse.status,200);const csvB=await csvBResponse.json();
 assert.equal((await csvUpload(csvRequest(a,'team,amount'))).status,400);
 for(const identity of [a,b]){
 const datasetId=String(identity===a?csvA.datasetId:csvB.datasetId),team=identity===a?'Alpha':'Beta';
 const cases:Array<{plan:object;rows:unknown[]}>=[];
 cases.push({plan:{datasetId,filters:[{column:'team',op:'eq',value:team}],sort:{column:'amount',direction:'desc'},limit:20},rows:[{team,amount:10}]});
 for(const op of ['count','sum','avg'])cases.push({plan:{datasetId,aggregate:op==='count'?{op}:{op,column:'amount'}},rows:[{value:op==='count'?1:10}]});
 cases.push({plan:{datasetId,aggregate:{op:'sum',column:'amount'},groupBy:['team'],sort:{column:'value',direction:'desc'}},rows:[{team,value:10}]});
 cases.push({plan:{datasetId,filters:[{column:'amount',op:'gt',value:11}]},rows:[]});
 for(const {plan,rows} of cases){const response=await csvQuery(request('/api/datasets/query',plan,identity.cookie,identity.csrf));assert.equal(response.status,200);assert.deepEqual((await response.json()).rows,rows);}
 assert.equal((await csvQuery(request('/api/datasets/query',{datasetId,aggregate:{op:'sum',column:'team'}},identity.cookie,identity.csrf))).status,404);
 }
 const discovered=await (await discover(request('/api/datasets',{},b.cookie,undefined,'GET'))).json();assert.deepEqual(discovered.datasets.map((d:{id:string})=>String(d.id)),[String(csvB.datasetId)]);
 assert.equal((await csvQuery(request('/api/datasets/query',{datasetId:String(csvA.datasetId)},b.cookie,b.csrf))).status,404);
 const {PUT,DELETE}=await import('../app/api/documents/[id]/route');
 assert.equal((await DELETE(request('/api/documents/'+docA.documentId,{},b.cookie,b.csrf),{params:Promise.resolve({id:docA.documentId})})).status,404);
 await assert.rejects(runWithIdentity(b.userId,()=>ingestDocument('replacement.docx',Buffer.from('wrong owner'),new AbortController().signal,docA.documentId,dependencies)),(e:unknown)=>(e as {status:number}).status===404);
 const form=new FormData();form.set('file',new File(['fictional'],'replacement.docx'));
 assert.equal((await PUT(new Request(origin+'/api/documents/'+docA.documentId,{method:'PUT',body:form,headers:{Origin:origin,Cookie:b.cookie,'X-CSRF-Token':b.csrf}}),{params:Promise.resolve({id:docA.documentId})})).status,404);
 await runWithIdentity(a.userId,()=>deleteDocument(docA.documentId));
 assert.equal((await runWithIdentity(b.userId,()=>cleanupDocumentFiles(undefined,async()=>assert.fail('must not remove another owner file')))).removed,0);
 // Restore a new A document, retaining the deleted audit tombstone.
 const docA2=await (await upload(request('/api/upload',{},a.cookie,a.csrf))).json();assert.notEqual(docA2.documentId,docA.documentId);
 const {GET:documentList}=await import('../app/api/documents/route');
 for(const identity of [a,b]){
 const listed=await (await documentList(request('/api/documents',{},identity.cookie,undefined,'GET'))).json();
 assert.equal(listed.success,true);assert.deepEqual(listed.documents.map((d:{id:string})=>d.id),[identity.userId===a.userId?docA2.documentId:docB.documentId]);
 assert.ok(listed.documents.every((d:object)=>!('file_path' in d)&&!('file_hash' in d)&&!('user_id' in d)));
 }
 const {POST:chat}=await import('../app/api/chat/route');const {POST:agent}=await import('../app/api/agent/route');
 // Real session/ownership/SQL integration, with only embeddings and Google mocked.
 for(const identity of [a,b])for(const mode of ['chat','agent','agent-csv','agent-combined']){
 const own=identity.userId===a.userId?'A':'B';const forbidden=own==='A'?'B':'A';
 const csvMode=mode==='agent-csv'||mode==='agent-combined';
 const docMode=mode!=='agent-csv';
 const ownTeam=own==='A'?'Alpha':'Beta';const otherTeam=own==='A'?'Beta':'Alpha';
 const datasetId=String(own==='A'?csvA.datasetId:csvB.datasetId);
 const steps:Array<{name:string;args:object}>=[];
 if(docMode)steps.push({name:'searchDocuments',args:{question:'owned fictional evidence amounts above 7'}});
 if(csvMode)steps.push({name:'discoverDatasets',args:{}},{name:'inspectDataset',args:{datasetId}},{name:'queryDataset',args:{datasetId,groupBy:['team'],aggregate:{op:'sum',column:'amount'}}});
 let step=0;
 mock.method(globalThis,'fetch',async(input:string|URL|Request,init?:RequestInit)=>{
 if(String(input).endsWith('/api/embed'))return Response.json({embeddings:[[1,...Array(767).fill(0)]]});
 const body=JSON.parse(String(init?.body));const serialized=JSON.stringify(body);
 assert.ok(!serialized.includes(`Owned fictional evidence ${forbidden}.`));
 assert.ok(!serialized.includes(otherTeam),'other user CSV rows must not reach Gemini');
 let parts:unknown[];
 if(body.tools){const next=steps[step++];parts=next?[{functionCall:next,thoughtSignature:'dGVzdA=='}]:[{text:'Gathered.'}];}
 else {
 const citations=[];
 if(docMode)citations.push(mode==='chat'?{sourceId:'S1',quoteId:'Q1'}:{sourceId:'D1',quote:csvMode?'Review amounts above 7.':`Owned fictional evidence ${own}.`});
 if(csvMode)citations.push({sourceId:'C1',quote:JSON.stringify([{team:ownTeam,value:10}])});
 const text=csvMode?`Team ${ownTeam} has a total amount of 10${docMode?', above the policy threshold of 7':''}.`:`Owned fictional evidence ${own}.`;
 const prompt=JSON.parse(body.contents.at(-1).parts[0].text);
 const references=citations.map(c=>{if('quoteId' in c)return c;const choice=prompt.quoteChoices.find((q:{sourceId:string;quote:string})=>q.sourceId===c.sourceId&&q.quote.includes(c.quote!));assert.ok(choice);return {sourceId:c.sourceId,quoteId:choice.quoteId};});
 parts=[{text:JSON.stringify({answerable:true,statements:[{text,citations:references}]})}];
 }
 return Response.json({candidates:[{content:{role:'model',parts},finishReason:'STOP',index:0}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:10,totalTokenCount:20}});
 });
 const endpoint=mode==='chat'?'chat':'agent';
 const response=await withMockGeminiClock(()=>(endpoint==='chat'?chat:agent)(request('/api/'+endpoint,{question:csvMode?`What is each team's total amount${docMode?' and is it above the document policy threshold':''}?`:'Show owned fictional evidence'},identity.cookie,identity.csrf)));
 assert.equal(response.status,200);assert.match(response.headers.get('x-request-id')!,/^[0-9a-f-]{36}$/);
 const result=await response.json();assert.equal(result.grounded,true);
 assert.equal(result.sources.length,mode==='agent-combined'?2:1);
 for(const source of result.sources){
 if(source.type==='csv'){
 assert.equal(source.datasetId,datasetId);assert.deepEqual(source.rows,[{team:ownTeam,value:10}]);
 assert.ok(source.quotes.every((quote:string)=>source.text.includes(quote)));
 }else assert.equal(source.documentId,own==='A'?docA2.documentId:docB.documentId);
 }
 }
 assert.equal((await logoutRequest(request('/api/auth/logout',{},login.cookie,login.csrf))).status,200);assert.equal((await sessionRequest(request('/api/auth/session',{},login.cookie,undefined,'GET'))).status,401);
 await raw('UPDATE auth_sessions SET expires_at=now()-interval \'1 second\'');assert.equal((await sessionRequest(request('/api/auth/session',{},a.cookie,undefined,'GET'))).status,401);
 // Existing passwordless accounts cannot be claimed through signup.
 await raw("INSERT INTO users(name,email) VALUES('Retained fixture','retained@example.test')");assert.equal((await accountRequest(request('/api/auth/signup',{name:'Claim',email:'retained@example.test',password:'Fictional password C!'}),true)).status,409);
 }finally{mock.restoreAll();await raw('ROLLBACK');client.release(true);if(previousKey===undefined)delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;else process.env.GOOGLE_GENERATIVE_AI_API_KEY=previousKey;}
});
test('production sessions use Secure host cookies and auth attempts are rate limited',async()=>{
 const previousNode=process.env.NODE_ENV,previousOrigin=process.env.APP_ORIGIN;
 Object.assign(process.env,{NODE_ENV:'production',APP_ORIGIN:'https://knowledge.example.test'});
 let blocked=false;const sessions:unknown[][]=[];
 mock.method(pool,'query',async()=>({rows:[{attempts:blocked?101:1}]}));
 mock.method(pool,'connect',async()=>({query:async(sql:string,values?:unknown[])=>{
 if(sql.startsWith('INSERT INTO users'))return {rows:[{id:'77'}]};
 if(sql.startsWith('INSERT INTO auth_sessions'))sessions.push(values!);
 return {rows:[]};
 },release:()=>{}}));
 try{
 const req=()=>new Request('https://knowledge.example.test/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://knowledge.example.test'},body:JSON.stringify({email:'production@example.test',name:'Fictional',password:'Fictional production password!'})});
 const response=await accountRequest(req(),true);assert.equal(response.status,201);
 const cookie=response.headers.get('set-cookie')!;assert.match(cookie,/^__Host-knowledge-session=/);assert.match(cookie,/; Secure/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.ok(!cookie.includes('Domain='));
 const raw=cookie.split(';')[0].split('=')[1];assert.notEqual(sessions[0][0],raw);
 blocked=true;assert.equal((await accountRequest(req(),true)).status,429);
 }finally{mock.restoreAll();for(const [key,value] of Object.entries({NODE_ENV:previousNode,APP_ORIGIN:previousOrigin})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

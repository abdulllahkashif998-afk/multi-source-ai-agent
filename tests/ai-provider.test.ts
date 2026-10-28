import {test,afterEach,mock} from 'node:test';
import assert from 'node:assert/strict';
import {getChatConfig,selectedLanguageModel,GROQ_MODELS,GEMINI_MODEL} from '../src/lib/ai-provider';
import {createGroqTransport,withGroqTransport} from '../src/lib/groq-transport';
import {runWithIdentity} from '../src/lib/identity';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {POST as chat} from '../app/api/chat/route';
import {POST as agent} from '../app/api/agent/route';
import pool from '../src/lib/db';
import {sessionHeaders,sessionRow} from './test-context';
const keys=['AI_PROVIDER','GROQ_API_KEY','GROQ_MODEL','GOOGLE_GENERATIVE_AI_API_KEY','GROQ_REQUESTS_PER_MINUTE','GEMINI_REQUESTS_PER_MINUTE','RAG_MIN_SIMILARITY','NODE_ENV','APP_ORIGIN'] as const;
const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
afterEach(()=>{mock.restoreAll();for(const key of keys){if(previous[key]===undefined)delete process.env[key];else Object.assign(process.env,{[key]:previous[key]});}});
function configure(){for(const key of keys)delete process.env[key];Object.assign(process.env,{AI_PROVIDER:'groq',GROQ_API_KEY:'fictional-groq-key',NODE_ENV:'test',APP_ORIGIN:'http://localhost:3000'});}
const row={document_id:'1',chunk_id:'2',filename:'fictional-policy.docx',chunk_index:0,page_number:2,similarity:0.9,chunk_text:'Minimum team sales target is 15.'};
function grounded(ids:string[]){return {answerable:true,statements:[{text:ids.includes('C1')?(ids.includes('D1')?'Beta has 6 and is 9 below the target of 15.':'Beta total sales are 6.'):'Minimum team sales target is 15.',citations:ids.map((sourceId,index)=>({sourceId,quoteId:`Q${index+1}`}))}]};}
function completion(content:string|null,toolCalls?:unknown[]){return Response.json({id:'fictional-completion',created:1,model:GROQ_MODELS[0],choices:[{index:0,message:{role:'assistant',content,...(toolCalls?{tool_calls:toolCalls}:{})},finish_reason:toolCalls?'tool_calls':'stop'}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}});}
function transport(fetch:typeof globalThis.fetch){let now=0;return createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async(ms,signal)=>{signal?.throwIfAborted();now+=ms;}},fetch});}
function request(question='What is the minimum sales target?',headers:Record<string,string>=sessionHeaders){return new Request('http://localhost:3000/api/chat',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({question})});}
function mockDB(){mock.method(pool,'query',async(config:unknown)=>{if(typeof config==='string'){assert.ok(config.startsWith('SELECT s.user_id'));return {rows:[sessionRow]};}const q=config as {text:string;values:unknown[]};assert.match(q.text,/d.user_id = \$2/);assert.match(q.text,/d.status = 'ready'/);assert.equal(q.values[1],'1');return {rows:[{...row,branch:'semantic',branch_rank:1}]};});}
type WireSchema={type?:string;required?:string[];properties?:Record<string,WireSchema>;items?:WireSchema;additionalProperties?:boolean};
function strictSchema(body:{response_format:{type:string;json_schema:{strict:boolean;schema:WireSchema}};tools?:unknown[]}){assert.equal(body.response_format.type,'json_schema');assert.equal(body.response_format.json_schema.strict,true);assert.equal(body.tools,undefined);const check=(schema:WireSchema)=>{if(schema.type==='object'){assert.equal(schema.additionalProperties,false);assert.deepEqual([...(schema.required??[])].sort(),Object.keys(schema.properties??{}).sort());for(const value of Object.values(schema.properties??{}))check(value);}if(schema.items)check(schema.items);};check(body.response_format.json_schema.schema);}
test('provider selection defaults to unchanged Gemini and only requires selected credentials',()=>{
 configure();delete process.env.AI_PROVIDER;process.env.GOOGLE_GENERATIVE_AI_API_KEY='fictional-google-key';assert.equal(getChatConfig().provider,'gemini');assert.equal(getChatConfig().model,GEMINI_MODEL);assert.equal(selectedLanguageModel().model.provider,'google.generative-ai');
 process.env.AI_PROVIDER='groq';delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;assert.equal(getChatConfig().model,'openai/gpt-oss-20b');assert.equal(selectedLanguageModel().model.provider,'groq.chat');
 process.env.GROQ_MODEL='openai/gpt-oss-120b';assert.equal(getChatConfig().model,'openai/gpt-oss-120b');
});
test('invalid providers, missing selected key and unverified models fail without fallback or secret leakage',()=>{
 configure();process.env.GOOGLE_GENERATIVE_AI_API_KEY='fictional-google-key';delete process.env.GROQ_API_KEY;assert.throws(getChatConfig,{code:'CHAT_NOT_CONFIGURED'});
 process.env.GROQ_API_KEY='fictional-private-key';for(const value of ['','unknown','GROQ']){process.env.AI_PROVIDER=value;assert.throws(getChatConfig,(e:unknown)=>e instanceof Error&&!e.message.includes(value||'fictional-private-key'));}
 process.env.AI_PROVIDER='groq';process.env.GROQ_MODEL='unverified-model';assert.throws(getChatConfig,{code:'CHAT_NOT_CONFIGURED'});
 delete process.env.GROQ_MODEL;for(const value of ['','NaN','0','30','1.5']){process.env.GROQ_REQUESTS_PER_MINUTE=value;assert.throws(getChatConfig,{code:'CHAT_NOT_CONFIGURED'});}
});
test('authenticated Groq RAG uses existing BGE and scoped retrieval with strict structured answers and S citations',async()=>{
 configure();mockDB();let providerCalls=0;mock.method(globalThis,'fetch',async(input:unknown)=>{assert.ok(String(input).endsWith('/api/embed'));return Response.json({embeddings:[Array(768).fill(0.1)]});});
 const provider=transport(async(input,init)=>{providerCalls++;assert.equal(String(input),'https://api.groq.com/openai/v1/chat/completions');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer fictional-groq-key');assert.ok(!String(input).includes('fictional-groq-key'));const body=JSON.parse(String(init?.body));assert.equal(body.model,GROQ_MODELS[0]);strictSchema(body);assert.ok(JSON.stringify(body).includes(row.chunk_text));return completion(JSON.stringify(grounded(['S1'])));});
 const response=await withGroqTransport(provider,()=>chat(request()));assert.equal(response.status,200);const data=await response.json();assert.equal(data.grounded,true);assert.match(data.answer,/\[S1\]/);assert.equal(data.sources[0].filename,row.filename);assert.equal(data.sources[0].chunkIndex,0);assert.equal(data.sources[0].pageNumber,2);assert.equal(providerCalls,1);
});
test('Groq agent reuses backend tools for document, CSV and combined workflows with exact citations',async()=>{
 configure();
 for(const mode of ['document','csv','combined']){
 const steps:Array<{name:string;args:object}>=[];if(mode!=='csv')steps.push({name:'searchDocuments',args:{question:'minimum sales target'}});if(mode!=='document')steps.push({name:'discoverDatasets',args:{}},{name:'inspectDataset',args:{datasetId:'3'}},{name:'queryDataset',args:{datasetId:'3',aggregate:{op:'sum',column:'amount'},groupBy:['team']}});
 let calls=0,queries=0;const ids=mode==='document'?['D1']:mode==='csv'?['C1']:['D1','C1'];
 const provider=transport(async(input,init)=>{assert.ok(String(input).startsWith('https://api.groq.com/'));const body=JSON.parse(String(init?.body));assert.equal(body.parallel_tool_calls,false);assert.equal(body.reasoning_effort,'low');
 if(body.response_format){strictSchema(body);assert.deepEqual(Object.keys(body.response_format.json_schema.schema.properties.statements.items.properties.citations.items.properties).sort(),['quoteId','sourceId']);assert.equal(calls,steps.length+1);return completion(JSON.stringify(grounded(ids)));}
 assert.ok(body.tools.some((t:{function:{name:string}})=>t.function.name==='queryDataset'));const step=steps[calls++];return step?completion(null,[{id:`tool-${calls}`,type:'function',function:{name:step.name,arguments:JSON.stringify(step.args)}}]):completion('Evidence collected.');});
 const result=await runWithIdentity('1',()=>withGroqTransport(provider,()=>answerWithAgent('Fictional question',new AbortController().signal,{search:async()=>[row],discover:async()=>[{id:'3',filename:'fictional.csv',columns:[{name:'team',type:'text'},{name:'amount',type:'number'}],row_count:3}],query:async(plan)=>{queries++;const p=plan as {filters:unknown[];aggregate:{op:string};groupBy:string[]};assert.deepEqual(p.filters,[]);assert.equal(p.aggregate.op,'sum');assert.deepEqual(p.groupBy,['team']);return [{team:'Beta',value:6}];}})));
 assert.equal(result.grounded,true);assert.equal(result.sources.length,ids.length);for(const id of ids)assert.ok(result.answer.includes(`[${id}]`));assert.equal(queries,mode==='document'?0:1);
 }
});
test('Groq missing evidence abstains and invalid/fabricated structured answers fail closed',async()=>{
 configure();for(const output of [{answerable:false,statements:[]},{bad:'shape'},grounded(['D99']),{answerable:true,statements:[{text:'Unsupported',citations:[{sourceId:'D1',quote:'Invented quote'}]}]}]){
 const provider=transport(async(_input,init)=>JSON.parse(String(init?.body)).response_format?completion(JSON.stringify(output)):completion('No evidence found.'));
 const work=()=>runWithIdentity('1',()=>withGroqTransport(provider,()=>answerWithAgent('Unknown information?',new AbortController().signal,{search:async()=>[],discover:async()=>[],query:async()=>[]})));
 if('answerable' in output&&output.answerable===false){const result=await work();assert.equal(result.grounded,false);assert.deepEqual(result.sources,[]);}else await assert.rejects(work());
 }
});
test('Groq auth failures, provider errors and malformed output produce safe HTTP errors without fallback',async()=>{
 configure();mockDB();mock.method(globalThis,'fetch',async()=>Response.json({embeddings:[Array(768).fill(0.1)]}));
 for(const [status,expected] of [[401,502],[403,502],[429,429],[503,502]]){let calls=0;const provider=transport(async(input)=>{calls++;assert.ok(String(input).startsWith('https://api.groq.com/'));return Response.json({error:{message:'fictional-private-key and private provider response',type:'provider_error'}},{status,headers:{'Retry-After':'120'}});});const response=await withGroqTransport(provider,()=>chat(request()));assert.equal(response.status,expected);const text=await response.text();assert.ok(!text.includes('fictional-private'));assert.ok(!text.includes('private provider'));assert.equal(calls,1);}
});
test('both AI routes enforce sessions and CSRF before reaching selected Groq',async()=>{
 configure();mockDB();const provider=transport(async()=>assert.fail('must not reach provider'));
 for(const endpoint of [chat,agent])for(const headers of [{},{...sessionHeaders,'X-CSRF-Token':''},{...sessionHeaders,Origin:'https://attacker.invalid'}]){const response=await withGroqTransport(provider,()=>endpoint(request('Question',headers)));assert.equal(response.status,Object.keys(headers).length===0?401:403);}
});
test('authenticated agent route uses selected Groq for planning and generation with scoped document evidence',async()=>{
 configure();mockDB();mock.method(globalThis,'fetch',async(input:unknown)=>{assert.ok(String(input).endsWith('/api/embed'));return Response.json({embeddings:[Array(768).fill(0.1)]});});
 let calls=0;const provider=transport(async(_input,init)=>{calls++;const body=JSON.parse(String(init?.body));if(body.response_format){strictSchema(body);return completion(JSON.stringify(grounded(['D1'])));}return calls===1?completion(null,[{id:'tool-1',type:'function',function:{name:'searchDocuments',arguments:JSON.stringify({question:'minimum sales target'})}}]):completion('Evidence gathered.');});
 const response=await withGroqTransport(provider,()=>agent(request()));assert.equal(response.status,200);const data=await response.json();assert.equal(data.success,true);assert.equal(data.grounded,true);assert.match(data.answer,/\[D1\]/);assert.equal(data.sources[0].type,'document');assert.equal(calls,3);
});
test('Groq pacing follows its own conservative cap and bounded retry-after recovery',async()=>{
 configure();let now=0;const starts:number[]=[];
 const provider=createGroqTransport({rpm:24,clock:{now:()=>now,sleep:async(ms)=>{now+=ms;}},fetch:async()=>{starts.push(now);return starts.length===1?new Response('',{status:429,headers:{'Retry-After':'6'}}):completion('OK');}});
 assert.equal((await provider('https://provider.invalid')).status,200);await provider('https://provider.invalid');assert.deepEqual(starts,[0,6000,8500]);
 for(const rpm of [0,30,NaN,2.5])assert.throws(()=>createGroqTransport({rpm}),{code:'CHAT_NOT_CONFIGURED'});
});
test('Groq repeated quota failures stop after two attempts and cancellation prevents provider work',async()=>{
 let calls=0;const provider=transport(async()=>{calls++;return new Response('private provider details',{status:429});});
 await assert.rejects(provider('https://provider.invalid'),{code:'PROVIDER_RATE_LIMITED',status:429});assert.equal(calls,2);
 await assert.rejects(provider('https://provider.invalid',{signal:AbortSignal.abort()}));assert.equal(calls,2);
});
test('Groq retries cannot exceed the remaining per-call deadline and quota state is provider-local',async()=>{
 let now=0,calls=0;const provider=createGroqTransport({rpm:12,clock:{now:()=>now,sleep:async(ms)=>{now+=ms;}},fetch:async()=>{calls++;now=29_000;return new Response('',{status:429});}});
 await assert.rejects(provider('https://provider.invalid'),{status:429});assert.equal(calls,1);
 const {createGeminiTransport}=await import('../src/lib/gemini-transport');let googleCalls=0;
 const google=createGeminiTransport({rpm:12,clock:{now:()=>now,sleep:async(ms)=>{now+=ms;}},fetch:async()=>{googleCalls++;return Response.json({ok:true});}});assert.equal((await google('https://google.invalid')).status,200);assert.equal(googleCalls,1);
});
test('Groq tool calls cannot execute SQL or access undiscovered/unauthorized datasets',async()=>{
 configure();let calls=0,queries=0;
 const steps=[{name:'discoverDatasets',args:{}},{name:'inspectDataset',args:{datasetId:'999'}},{name:'queryDataset',args:{datasetId:'999'}},{name:'queryDataset',args:{datasetId:'3',sql:'private arbitrary SQL'}}];
 const provider=transport(async(_input,init)=>{const body=JSON.parse(String(init?.body));if(body.response_format)return completion(JSON.stringify({answerable:false,statements:[]}));const step=steps[calls++];return step?completion(null,[{id:`tool-${calls}`,type:'function',function:{name:step.name,arguments:JSON.stringify(step.args)}}]):completion('Insufficient evidence.');});
 const result=await runWithIdentity('1',()=>withGroqTransport(provider,()=>answerWithAgent('Inspect an inaccessible dataset',new AbortController().signal,{search:async()=>[],discover:async()=>[{id:'3',filename:'owned.csv',columns:[{name:'amount',type:'number'}],row_count:1}],query:async()=>{queries++;assert.fail('unauthorized or arbitrary SQL must not execute');}})));
 assert.equal(result.grounded,false);assert.deepEqual(result.sources,[]);assert.equal(queries,0);
});
test('Groq RAG rejects malformed, truncated and forged-citation output without exposing provider text',async()=>{
 configure();mockDB();mock.method(globalThis,'fetch',async()=>Response.json({embeddings:[Array(768).fill(0.1)]}));
 const forged={answerable:true,statements:[{text:'Unsupported answer',citations:[{sourceId:'S1',quote:'invented quote'}]}]};
 for(const [content,finish] of [['not-json','stop'],[JSON.stringify(grounded(['S1'])),'length'],[JSON.stringify(forged),'stop']]){
 const provider=transport(async()=>Response.json({id:'fixture',created:1,model:GROQ_MODELS[0],choices:[{index:0,message:{role:'assistant',content},finish_reason:finish}]}));
 const response=await withGroqTransport(provider,()=>chat(request()));assert.equal(response.status,502);const data=await response.json();assert.equal(data.success,false);assert.equal(data.answer,undefined);assert.ok(!JSON.stringify(data).includes('invented quote'));assert.ok(!JSON.stringify(data).includes('not-json'));
 }
});
test('Groq RAG receives contiguous PDF quote instructions and retains strict source verification',async()=>{
 configure();const {generateEvidenceAnswer}=await import('../src/lib/gemini');const {validateGroundedAnswer}=await import('../src/lib/rag-answer');
 const text='Education\nBSc Computing\nFictional River University\nOther qualification\nGrade:\nCGPA:\nB\n3.42/ 4.0';
 const evidence=[{id:'S1',documentId:'1',chunkId:'2',filename:'fictional-resume.pdf',chunkIndex:4,pageNumber:null,similarity:.8,text}];
 const output={answerable:true,statements:[{text:'The fictional graduate attended Fictional River University with a CGPA of 3.42/4.0.',citations:[{sourceId:'S1',quoteId:'Q1'}]}]};
 let calls=0;const provider=transport(async(_input,init)=>{calls++;const body=JSON.parse(String(init?.body));strictSchema(body);const system=body.messages.find((m:{role:string})=>m.role==='system').content;assert.match(system,/one contiguous substring/);const wire=JSON.stringify(body.response_format.json_schema.schema);assert.ok(wire.includes('quoteId'));assert.ok(!wire.includes('enum'));assert.ok(JSON.stringify(body.messages).includes('Q1'));assert.match(system,/never merge, reorder, paraphrase or concatenate/);assert.match(system,/These are preserved in the quote choices/);return completion(JSON.stringify(output));});
 const generated=await withGroqTransport(provider,()=>generateEvidenceAnswer('What is the fictional graduate education and CGPA?',evidence,new AbortController().signal));const answer=validateGroundedAnswer(generated,evidence);assert.equal(answer.grounded,true);assert.deepEqual(answer.sources[0].quotes,[text]);assert.equal(calls,1);
});

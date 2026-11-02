import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {getChatConfig,selectedLanguageModel} from '../src/lib/ai-provider';
import {ollamaFetch,localOllamaConfig} from '../src/lib/ollama-transport';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {generateEvidenceAnswer} from '../src/lib/gemini';
import {runWithIdentity} from '../src/lib/identity';
import {validateGroundedAnswer} from '../src/lib/rag-answer';
async function configured(work:()=>Promise<void>){const keys=['AI_PROVIDER','OLLAMA_LLM_MODEL','OLLAMA_LLM_BASE_URL','OLLAMA_LLM_CONTEXT_TOKENS','RAG_MIN_SIMILARITY','GROQ_REQUESTS_PER_MINUTE'],previous=keys.map(k=>process.env[k]);for(const k of keys)delete process.env[k];process.env.AI_PROVIDER='ollama';try{await work();}finally{mock.restoreAll();keys.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];});}}
const doc={document_id:'21',chunk_id:'51',filename:'fictional.pdf',chunk_index:0,page_number:1,similarity:.9,chunk_text:'Approval requires a value above 75 credits.'};
const dataset={id:'101',filename:'ledger.csv',columns:[{name:'amount',type:'number' as const}],row_count:1};
const native=(content:string,tool?:string,args?:unknown)=>Response.json({done:true,done_reason:'stop',message:{role:'assistant',content,...(tool?{tool_calls:[{id:'fictional-call',function:{name:tool,arguments:args}}]}:{})},prompt_eval_count:20,eval_count:10});
test('local provider is explicit, fixed-model, keyless, loopback-only and independent of Groq configuration',async()=>configured(async()=>{
 process.env.GROQ_REQUESTS_PER_MINUTE='bad';try{assert.equal(getChatConfig().provider,'ollama');assert.equal(getChatConfig().model,'qwen3.5:4b');assert.equal(selectedLanguageModel().model.provider,'ollama.chat');}finally{delete process.env.GROQ_REQUESTS_PER_MINUTE;}
 for(const url of ['https://ollama.com','http://private.example','http://user:password@localhost:11434','http://localhost:11434/private']){process.env.OLLAMA_LLM_BASE_URL=url;assert.throws(localOllamaConfig,{code:'CHAT_NOT_CONFIGURED'});}delete process.env.OLLAMA_LLM_BASE_URL;
 process.env.OLLAMA_LLM_MODEL='some-cloud-model';assert.throws(getChatConfig,{code:'CHAT_NOT_CONFIGURED'});
}));
test('local RAG uses schema output, original quotes and explicit native controls without Groq',async()=>configured(async()=>{
 let calls=0;mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{calls++;assert.equal(String(url),'http://127.0.0.1:11434/api/chat');const b=JSON.parse(String(init?.body));assert.equal(b.think,false);assert.equal(b.stream,false);assert.equal(b.options.num_ctx,16384);assert.equal(b.options.num_predict,3000);assert.equal(b.format.type,'object');assert.equal(new Headers(init?.headers).has('Authorization'),false);return native(JSON.stringify({answerable:true,statements:[{text:'Approval is required above 75 credits.',citations:[{sourceId:'S1',quoteId:'Q1'}]}]}));});
 const evidence=[{id:'S1',documentId:'21',chunkId:'51',filename:doc.filename,chunkIndex:0,pageNumber:1,text:doc.chunk_text,similarity:.9}];const output=await generateEvidenceAnswer('Explain the approval guidance.',evidence,new AbortController().signal);assert.equal(validateGroundedAnswer(output,evidence).grounded,true);assert.equal(calls,1);
}));
test('local general agent preserves document, CSV and combined tools, result replay and strict citations',async()=>configured(async()=>{
 for(const kind of ['document','csv','combined'] as const){let calls=0,queries=0;
  mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{calls++;const b=JSON.parse(String(init?.body));if(b.format){const ids=kind==='document'?['D1']:kind==='csv'?['C1']:['D1','C1'];return native(JSON.stringify({answerable:true,statements:[{text:kind==='document'?'Approval is required above 75 credits.':kind==='csv'?'The amount is 20.':'The amount is 20, below the 75-credit threshold by 55 credits.',citations:ids.map((sourceId,i)=>({sourceId,quoteId:`Q${i+1}`}))}]}));}
   if(calls===1&&kind!=='csv')return native('','searchDocuments',{question:'Find the approval guidance.'});
   if((kind==='csv'&&calls===1)||(kind==='combined'&&calls===2)){if(kind==='combined')assert.ok(b.messages.some((m:{role:string;tool_name?:string})=>m.role==='tool'&&m.tool_name==='searchDocuments'));return native('','queryDataset',{datasetId:'101',evidenceComplete:true});}
   return native('Evidence ready.');
  });
  const result=await runWithIdentity('101',()=>answerWithAgent(kind==='document'?'Explain the guidance.':kind==='csv'?'Describe ledger values.':'Contrast the guidance with ledger values and explain differences.',new AbortController().signal,{search:async()=>[doc],discover:async()=>[dataset],query:async()=>{queries++;return [{amount:20}];}}));assert.equal(result.grounded,true);assert.ok(result.sources.every(s=>s.quotes.every(q=>s.text.includes(q))));assert.equal(queries,kind==='document'?0:1);assert.equal(calls,kind==='csv'?2:3);if(kind==='combined')assert.deepEqual(result.sources.map(s=>s.type),['document','csv']);mock.restoreAll();
 }
}));
test('local refusal and foreign or invalid dataset plans never execute SQL',async()=>configured(async()=>{
 let n=0,queries=0;mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{const b=JSON.parse(String(init?.body));if(b.format)return native(JSON.stringify({answerable:false,statements:[]}));n++;if(n===1)return native('','queryDataset',{datasetId:'999',evidenceComplete:true});if(n===2)return native('','queryDataset',{datasetId:'101',sql:'DROP TABLE users'});return native('Insufficient evidence.');});
 const result=await runWithIdentity('101',()=>answerWithAgent('Describe unavailable records.',new AbortController().signal,{search:async()=>[],discover:async()=>[dataset],query:async()=>{queries++;return [];}}));assert.equal(queries,0);assert.equal(result.grounded,false);assert.deepEqual(result.sources,[]);
}));
test('local failures, malformed native calls and context overflow fail closed without fallback',async()=>configured(async()=>{
 const wire=JSON.stringify({model:'qwen3.5:4b',messages:[{role:'user',content:'Fictional question'}],max_tokens:100});
 for(const response of [new Response('PRIVATE ERROR',{status:500}),native('','queryDataset','bad arguments')]){mock.method(globalThis,'fetch',async()=>response);await assert.rejects(ollamaFetch('http://localhost',{method:'POST',body:wire}),error=>{assert.ok(!String(error).includes('PRIVATE'));return true;});mock.restoreAll();}
 mock.method(globalThis,'fetch',async()=>assert.fail('must not dispatch oversized evidence'));process.env.OLLAMA_LLM_CONTEXT_TOKENS='4096';await assert.rejects(ollamaFetch('http://localhost',{method:'POST',body:JSON.stringify({model:'qwen3.5:4b',messages:[{role:'user',content:'x'.repeat(5000)}],max_tokens:100})}),{code:'LOCAL_CONTEXT_LIMIT'});
 const controller=new AbortController();controller.abort();await assert.rejects(ollamaFetch('http://localhost',{method:'POST',body:wire,signal:controller.signal}));
}));

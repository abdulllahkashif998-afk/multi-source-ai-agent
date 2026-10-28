import { test } from './test-context';
import assert from 'node:assert/strict';
import { createAgentSession } from '../src/lib/agent-tools';
const document = { document_id: '1', chunk_id: '2', filename: 'fictional-policy.docx', chunk_index: 0, page_number: null, similarity: 0.9, chunk_text: 'Review spending above 20.' };
function fixture() {
 let queries = 0;
 const session = createAgentSession({ search: async () => [document], discover: async () => [{ id: '3', filename: 'fictional.csv', columns: [{ name: 'amount', type: 'number' }], row_count: 2 }], query: async () => { queries++; return [{ amount: 30 }]; } }, new AbortController().signal, 0.5);
 return { ...session, queries: () => queries };
}
function answer(citations: Array<{sourceId: string; quote: string}>) {
 return { answerable: true, statements: [{ text: 'The evidence supports a review.', citations }] };
}
async function csv(s: ReturnType<typeof fixture>) {
 await s.execute('discoverDatasets', {});
 await s.execute('inspectDataset', { datasetId: '3' });
 return s.execute('queryDataset', { datasetId: '3', filters: [{ column: 'amount', op: 'gt', value: 20 }] });
}
test('document-only workflow preserves original citation checks', async () => {
 const s = fixture(); await s.execute('searchDocuments', { question: 'What is the threshold?' });
 const r = s.finalize(answer([{ sourceId: 'D1', quote: document.chunk_text }]));
 assert.equal(r.grounded, true); assert.equal(r.sources[0].type, 'document'); assert.equal(s.queries(), 0);
});
test('CSV-only workflow discovers, inspects, queries and cites exact results', async () => {
 const s = fixture(); await csv(s);
 const r = s.finalize(answer([{ sourceId: 'C1', quote: '{"amount":30}' }]));
 assert.equal(r.sources[0].type, 'csv'); assert.equal(s.queries(), 1);
});
test('combined threshold workflow cites both policy and actual CSV result', async () => {
 const s = fixture(); await s.execute('searchDocuments', { question: 'Review threshold?' }); await csv(s);
 const r = s.finalize(answer([{ sourceId: 'D1', quote: 'above 20' }, { sourceId: 'C1', quote: '{"amount":30}' }]));
 assert.equal(r.sources.length, 2); assert.match(r.answer, /\[D1\] \[C1\]/);
});
test('unauthorized or uninspected datasets never execute queries', async () => {
 const s = fixture();
 await s.execute('queryDataset', { datasetId: '3' });
 await s.execute('discoverDatasets', {});
 await s.execute('inspectDataset', { datasetId: '999' });
 await s.execute('queryDataset', { datasetId: '999' });
 await s.execute('queryDataset', { datasetId: '3' });
 assert.equal(s.queries(), 0);
});
test('invalid plans, arbitrary SQL and incorrect tools cannot execute', async () => {
 const s = fixture(); await s.execute('discoverDatasets', {}); await s.execute('inspectDataset', { datasetId: '3' });
 for (const input of [{ datasetId: '3', sql: 'SELECT * FROM users' }, { datasetId: '3', aggregate: { op: 'sum', column: 'unknown' } }, { datasetId: '3', limit: 999 }]) await s.execute('queryDataset', input);
 assert.deepEqual(await s.execute('executeSQL', {}), { error: 'Unknown tool.' }); assert.equal(s.queries(), 0);
});
test('wrong tool evidence and fabricated answers cannot acquire missing citations', async () => {
 const s = fixture(); await csv(s);
 assert.throws(() => s.finalize(answer([{ sourceId: 'D1', quote: 'above 20' }])));
 assert.throws(() => s.finalize(answer([{ sourceId: 'C1', quote: 'amount:999' }])));
 assert.equal(s.finalize({ answerable: false, statements: [] }).grounded, false);
 assert.throws(() => fixture().finalize(answer([{ sourceId: 'D1', quote: 'invented' }])));
});
test('tool calls are bounded and cancellation prevents work', async () => {
 const s = fixture(); for (let i=0;i<10;i++) await s.execute('unknown', {});
 await assert.rejects(s.execute('unknown', {}), /limit/);
 const c = new AbortController(); c.abort();
 const stopped = createAgentSession({ search: async () => [], discover: async () => [], query: async () => [] }, c.signal, 0.5);
 await assert.rejects(stopped.execute('discoverDatasets', {}));
});
test('real SDK tool loop supports document, CSV, and combined selection with mocked Google transport', async () => {
 const { mock } = await import('node:test');
 const { answerWithAgent } = await import('../src/lib/knowledge-agent');
 const oldKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
 const oldNode = process.env.NODE_ENV;
 const oldCutoff = process.env.RAG_MIN_SIMILARITY;
 Object.assign(process.env, { GOOGLE_GENERATIVE_AI_API_KEY: 'fictional-test-key', NODE_ENV: 'test', RAG_MIN_SIMILARITY: '0.5' });
 try {
 for (const mode of ['document','csv','combined']) {
   const steps: Array<{name:string;args:object}> = [];
   if (mode !== 'csv') steps.push({ name: 'searchDocuments', args: { question: 'threshold' } });
   if (mode !== 'document') steps.push({ name: 'discoverDatasets', args: {} }, { name: 'inspectDataset', args: { datasetId: '3' } }, { name: 'queryDataset', args: { datasetId: '3', filters: [{column:'amount',op:'gt',value:20}] } });
   let calls=0;
   mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
     const body = JSON.parse(String(init.body));
     assert.equal(String(_url).includes('gemini-3.5-flash-lite'), true);
     let parts: unknown[];
     if (body.generationConfig?.responseMimeType === 'application/json') {
       const citations=[];
       if(mode !== 'csv') citations.push({sourceId:'D1',quote:'above 20'});
       if(mode !== 'document') citations.push({sourceId:'C1',quote:'{"amount":30}'});
       const prompt=JSON.parse(body.contents.at(-1).parts[0].text);
       const references=citations.map(c=>{const choice=prompt.quoteChoices.find((q:{sourceId:string;quote:string})=>q.sourceId===c.sourceId&&q.quote.includes(c.quote));assert.ok(choice);return {sourceId:c.sourceId,quoteId:choice.quoteId};});
       parts=[{text:JSON.stringify({answerable:true,statements:[{text:'The evidence supports a review.',citations:references}]})}];
     } else {
       const step=steps[calls++]; parts=step ? [{functionCall:step,thoughtSignature:'dGVzdC1zaWduYXR1cmU='}] : [{text:'Evidence gathered.'}];
     }
     return Response.json({candidates:[{content:{role:'model',parts},finishReason:'STOP',index:0}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:10,totalTokenCount:20}});
   });
   const result = await answerWithAgent('Fictional question', new AbortController().signal, {
     search: async()=>[document], discover:async()=>[{id:'3',filename:'fictional.csv',columns:[{name:'amount',type:'number'}],row_count:1}],query:async()=>[{amount:30}],
   });
   assert.equal(result.grounded,true);
   assert.equal(result.sources.length,mode==='combined'?2:1);
   mock.restoreAll();
 }
 } finally {
   mock.restoreAll();
   for (const [key,value] of Object.entries({ GOOGLE_GENERATIVE_AI_API_KEY:oldKey,NODE_ENV:oldNode,RAG_MIN_SIMILARITY:oldCutoff })) {
     if(value===undefined) delete process.env[key]; else process.env[key]=value;
   }
 }
});
test('agent HTTP route rejects missing sessions before invoking Gemini', async () => {
 const { POST } = await import('../app/api/agent/route');
 // Exercises the actual route-to-readQuestion import that was missing in the stale dev runtime.
 for (const body of ['{"question":" "}', '{']) {
   const response = await POST(new Request('http://localhost/api/agent', {method:'POST',headers:{'content-type':'application/json'},body}));
   assert.equal(response.status,401);
   const data=await response.json();
   assert.notEqual(data.code,'AGENT_FAILED');
 }
});
test('diagnostics identify the confirmed import failure without leaking raw error data', async () => {
 const { agentDiagnosticRecord } = await import('../src/lib/agent-diagnostics');
 const error = new TypeError('readQuestion is not a function');
 assert.equal(agentDiagnosticRecord('question-validation', error).nonFunction, 'readQuestion');
 const secret = 'fictional-secret-value';
 const record = agentDiagnosticRecord('planning', { name:secret, message:secret, stack:secret, responseBody:secret, url:secret, statusCode:429 });
 assert.ok(!JSON.stringify(record).includes(secret));
 assert.equal(record.httpStatus,429);
 assert.equal(record.errorType,'Unknown');
});
test('valid anonymous agent request is rejected in production before model execution', async () => {
 const { POST } = await import('../app/api/agent/route');
 const old=process.env.NODE_ENV;
 Object.assign(process.env,{NODE_ENV:'production'});
 try {
   const response=await POST(new Request('http://localhost/api/agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'Fictional question'})}));
   assert.equal(response.status,401);
   assert.equal((await response.json()).code,'UNAUTHENTICATED');
 } finally { if(old===undefined) Reflect.deleteProperty(process.env,'NODE_ENV'); else Object.assign(process.env,{NODE_ENV:old}); }
});
test('invalid aggregate sorting provides safe recovery guidance and records the failing tool', async () => {
 const { createAgentTrace } = await import('../src/lib/agent-diagnostics');
 const trace=createAgentTrace();let queries=0;
 const s=createAgentSession({ search:async()=>[],discover:async()=>[{id:'3',filename:'fictional.csv',columns:[{name:'team',type:'text'},{name:'amount',type:'number'}],row_count:3}],query:async()=>{queries++;return [{team:'Beta',value:6}];} },new AbortController().signal,0.5,trace);
 await s.execute('discoverDatasets',{});await s.execute('inspectDataset',{datasetId:'3'});
 const plan={datasetId:'3',groupBy:['team'],aggregate:{op:'sum',column:'amount'},sort:{column:'amount',direction:'asc'}};
 const bad=await s.execute('queryDataset',plan);
 assert.match(JSON.stringify(bad),/Set sort.column to value/);
 assert.equal(queries,0);
 const good=await s.execute('queryDataset',{...plan,sort:{column:'value',direction:'asc'}});
 assert.ok(!('error' in good));assert.equal(queries,1);
 assert.ok(trace.events.some(e=>e.tool==='queryDataset' && e.reason==='Sort must use group or value'));
 assert.deepEqual(trace.events.filter(e=>e.stage==='tool'&&e.tool==='queryDataset').map(e=>e.outcome),['error','ok']);
 assert.ok(trace.events.every(e=>e.ms>=0));
});
test('tool diagnostics identify allowed tool names and redact arbitrary names', async () => {
 const { agentDiagnosticRecord }=await import('../src/lib/agent-diagnostics');
 assert.equal(agentDiagnosticRecord('tool-execution',new Error('Sort must use group or value'),'queryDataset').tool,'queryDataset');
 assert.equal(agentDiagnosticRecord('tool-execution',new Error('private message'),'private-tool-name').tool,undefined);
});
test('grouped totals retain all sales and reject fabricated individual-row totals', async () => {
 const s=createAgentSession({search:async()=>[document],discover:async()=>[{id:'3',filename:'fictional.csv',columns:[{name:'team',type:'text'},{name:'amount',type:'number'}],row_count:3}],query:async(plan)=>{
   const p=plan as {filters:unknown[];groupBy:string[];aggregate:{op:string;column:string}};
   assert.deepEqual(p.filters,[]);assert.deepEqual(p.groupBy,['team']);assert.equal(p.aggregate.op,'sum');
   return [{team:'Alpha',value:30},{team:'Beta',value:6}];
 }},new AbortController().signal,0.5);
 await s.execute('discoverDatasets',{});await s.execute('inspectDataset',{datasetId:'3'});
 await s.execute('queryDataset',{datasetId:'3',groupBy:['team'],aggregate:{op:'sum',column:'amount'}});
 assert.throws(()=>s.finalize(answer([{sourceId:'C1',quote:'{"team":"Alpha","value":10}'}])));
 const result=s.finalize(answer([{sourceId:'C1',quote:'{"team":"Beta","value":6}'}]));
 assert.equal(result.grounded,true);
});
test('authenticated agent surfaces a second-planning-call billing denial without generating an answer',async()=>{
 const {mock}=await import('node:test');const {POST}=await import('../app/api/agent/route');const {default:pool}=await import('../src/lib/db');
 const {sessionHeaders,sessionRow}=await import('./test-context');const {withGeminiTransport,createGeminiTransport}=await import('../src/lib/gemini-transport');
 const oldKey=process.env.GOOGLE_GENERATIVE_AI_API_KEY,oldNode=process.env.NODE_ENV,oldOrigin=process.env.APP_ORIGIN;
 Object.assign(process.env,{GOOGLE_GENERATIVE_AI_API_KEY:'fictional-test-key',NODE_ENV:'test',APP_ORIGIN:'http://localhost:3000'});
 let calls=0,now=0;const lines:string[]=[];
 mock.method(console,'info',(...args:unknown[])=>{lines.push(args.join(' '));});
 mock.method(pool,'query',async(sql:unknown)=>{assert.ok(String(sql).startsWith('SELECT s.user_id'));return {rows:[sessionRow]};});
 const transport=createGeminiTransport({rpm:12,clock:{now:()=>now,sleep:async(ms)=>{now+=ms;}},fetch:async(_input,init)=>{
 calls++;const body=JSON.parse(String(init?.body));assert.equal(body.generationConfig?.responseMimeType,undefined,'final generation must not be reached');
 if(calls===1)return Response.json({candidates:[{content:{role:'model',parts:[{functionCall:{name:'inspectDataset',args:{datasetId:'unknown'}},thoughtSignature:'dGVzdC1zaWduYXR1cmU='}]},finishReason:'STOP',index:0}]});
 return Response.json({error:{code:403,status:'PERMISSION_DENIED',message:'The Gemini API free tier is not available for this project. private-provider-details'}},{status:403});
 }});
 try{
 const response=await withGeminiTransport(transport,()=>POST(new Request('http://localhost:3000/api/agent',{method:'POST',headers:{...sessionHeaders,'Content-Type':'application/json'},body:JSON.stringify({question:'What is the minimum sales target mentioned in the team policy?'})})));
 assert.equal(response.status,503);assert.match(response.headers.get('X-Request-ID')!,/^[0-9a-f-]{36}$/);
 const data=await response.json();assert.equal(data.success,false);assert.equal(data.code,'PROVIDER_BILLING_REQUIRED');assert.equal(data.answer,undefined);assert.ok(!JSON.stringify(data).includes('private-provider-details'));assert.equal(calls,2);
 assert.ok(lines.some(line=>line.includes('"stage":"planning-wall"')&&line.includes('"reason":"provider_billing_required"')));assert.ok(!lines.join('').includes('private-provider-details'));
 }finally{mock.restoreAll();for(const [key,value] of Object.entries({GOOGLE_GENERATIVE_AI_API_KEY:oldKey,NODE_ENV:oldNode,APP_ORIGIN:oldOrigin})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

import {test,mock,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {buildDatasetPlan,emptyQuery,fetchDatasets,uploadDataset,runDatasetQuery,validateCSVFile,type DatasetItem,type QueryDraft} from '../src/lib/dataset-client';
import {compileCSVQuery,planSchema as serverPlanSchema} from '../src/lib/generic-csv';
import {planSchema} from '../src/lib/csv-query-schema';
import {POST as upload} from '../app/api/datasets/route';
import {POST as query} from '../app/api/datasets/query/route';
import pool from '../src/lib/db';
import {sessionHeaders,sessionRow} from './test-context';
afterEach(()=>mock.restoreAll());
const dataset:DatasetItem={id:'8',filename:'Fictional.csv',row_count:3,columns:[{name:'team',type:'text'},{name:'amount',type:'number'},{name:'active',type:'boolean'}]};
const session={success:true,name:'Fictional',email:'fictional@example.test',csrfToken:'c'.repeat(64)};
const csv=()=>new File(['team,amount\nAlpha,10'],'Fictional.csv',{type:'text/csv'});
test('CSV UI validates file types, empty files, paths and maximum size',()=>{
 assert.ok(validateCSVFile(csv()));assert.ok(validateCSVFile(new File(['a\n1'],'upper.CSV')));
 for(const file of [new File([],'empty.csv'),new File(['x'],'wrong.pdf'),new File(['x'],'../a.csv'),new File([new Uint8Array(10*1024*1024+1)],'large.csv')])assert.throws(()=>validateCSVFile(file),{code:'INVALID_FILE'});
});
test('UI and backend share the exact query-plan schema; typed plans compile without SQL input',()=>{
 assert.equal(planSchema,serverPlanSchema);
 const draft:QueryDraft={...emptyQuery(),filters:[{key:1,column:'amount',op:'gte',value:'10'},{key:2,column:'active',op:'eq',value:'true'},{key:3,column:'team',op:'eq',value:"x'; DROP TABLE users; --"}],sortColumn:'amount',direction:'desc'};
 const plan=buildDatasetPlan(dataset,draft);assert.equal(plan.filters[0].value,10);assert.equal(plan.filters[1].value,true);assert.ok(!('userId' in plan));assert.ok(!('sql' in plan));
 const compiled=compileCSVQuery(plan,dataset.columns);assert.ok(!compiled.text.includes('DROP'));assert.ok(compiled.values.includes("x'; DROP TABLE users; --"));
 for(const operation of ['count','sum','avg'] as const){const p=buildDatasetPlan(dataset,{...emptyQuery(),operation,aggregateColumn:'amount',groupBy:['team'],sortColumn:'value'});assert.equal(p.aggregate?.op,operation);if(operation==='count')assert.ok(!('column' in p.aggregate!));assert.doesNotThrow(()=>compileCSVQuery(p,dataset.columns));}
});
test('UI rejects unknown columns, invalid typed filters, aggregates, grouping, sorting and row limits',()=>{
 const invalid:Partial<QueryDraft>[]=[{limit:'101'},{limit:'0'},{limit:'1.5'},{groupBy:['team']},{operation:'sum',aggregateColumn:'team'},{operation:'count',groupBy:['value']},{operation:'sum',aggregateColumn:'amount',sortColumn:'amount'},{sortColumn:'private'},{filters:[{key:1,column:'amount',op:'eq',value:''}]},{filters:[{key:1,column:'amount',op:'eq',value:'Infinity'}]},{filters:[{key:1,column:'active',op:'gt',value:'true'}]},{filters:[{key:1,column:'active',op:'eq',value:'yes'}]},{filters:[{key:1,column:'secret',op:'eq',value:'x'}]}];
 for(const change of invalid)assert.throws(()=>buildDatasetPlan(dataset,{...emptyQuery(),...change}),{code:'INVALID_QUERY'});
});
test('dataset discovery uses cookies/no-store and handles empty and zero-row datasets',async()=>{
 for(const rows of [[],[{...dataset,row_count:0}]]){
 mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{assert.equal(url,'/api/datasets');assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');return Response.json({success:true,datasets:rows});});assert.deepEqual(await fetchDatasets(),rows);mock.restoreAll();
 }
 mock.method(globalThis,'fetch',async()=>Response.json({success:true,datasets:[{id:'1',filename:'bad'}]}));await assert.rejects(fetchDatasets(),{code:'LIST_FAILED'});
});
test('CSV upload refreshes CSRF, sends only the file and leaves multipart content type to the browser',async()=>{
 let requests=0;mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{
 requests++;if(url==='/api/auth/session')return Response.json(session);
 assert.equal(url,'/api/datasets');assert.equal(init?.method,'POST');assert.equal(init?.credentials,'same-origin');assert.equal(new Headers(init?.headers).get('X-CSRF-Token'),session.csrfToken);assert.equal(new Headers(init?.headers).has('Content-Type'),false);assert.ok(init?.body instanceof FormData);assert.deepEqual([...init.body.keys()],['file']);return Response.json({success:true,datasetId:'9',importedRows:1,columns:dataset.columns});
 });assert.equal((await uploadDataset(csv())).datasetId,'9');assert.equal(requests,2);
});
test('query submission sends a validated JSON plan and preserves scalar and prototype-named result cells',async()=>{
 const unusual:DatasetItem={...dataset,columns:[{name:'__proto__',type:'text'},{name:'constructor',type:'text'}]};
 mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{
 if(url==='/api/auth/session')return Response.json(session);assert.equal(url,'/api/datasets/query');assert.equal(new Headers(init?.headers).get('X-CSRF-Token'),session.csrfToken);assert.equal(new Headers(init?.headers).get('Content-Type'),'application/json');assert.equal(JSON.parse(String(init?.body)).datasetId,'8');
 return Response.json({success:true,rows:[JSON.parse('{"__proto__":"literal","constructor":"plain"}')]});
 });const result=await runDatasetQuery(unusual,emptyQuery());assert.equal(Object.hasOwn(result.rows[0],'__proto__'),true);assert.equal(result.rows[0].__proto__,'literal');assert.equal(result.rows[0].constructor,'plain');
});
test('invalid and oversized plans never make requests; backend errors and expiry stay safe',async()=>{
 mock.method(globalThis,'fetch',()=>assert.fail('invalid plan must not request credentials or data'));
 await assert.rejects(runDatasetQuery(dataset,{...emptyQuery(),limit:'101'}),{code:'INVALID_QUERY'});
 await assert.rejects(runDatasetQuery(dataset,{...emptyQuery(),filters:[{key:1,column:'team',op:'eq',value:'é'.repeat(10000)}]}),{code:'INVALID_QUERY'});mock.restoreAll();
 for(const [status,code] of [[404,'QUERY_FAILED'],[403,'CSRF_REJECTED'],[401,'UNAUTHENTICATED']] as const){
 mock.method(globalThis,'fetch',async(url:unknown)=>url==='/api/auth/session'?Response.json(session):Response.json({success:false,error:'secret SQL and credentials'},{status}));
 await assert.rejects(runDatasetQuery(dataset,emptyQuery()),(error:unknown)=>error instanceof Error&&!error.message.includes('secret')&&(error as {code?:string}).code===code);mock.restoreAll();
 }
 mock.method(globalThis,'fetch',async()=>Response.json({success:false,code:'UNAUTHENTICATED'},{status:401}));await assert.rejects(uploadDataset(csv()),{code:'UNAUTHENTICATED'});
});
test('upload interruptions do not auto-retry and invalid CSV errors are useful without raw details',async()=>{
 let writes=0;mock.method(globalThis,'fetch',async(url:unknown)=>{if(url==='/api/auth/session')return Response.json(session);writes++;throw new Error('private connection string');});
 await assert.rejects(uploadDataset(csv()),{code:'UPLOAD_INTERRUPTED'});assert.equal(writes,1);mock.restoreAll();
 mock.method(globalThis,'fetch',async(url:unknown)=>url==='/api/auth/session'?Response.json(session):Response.json({success:false,error:'private parser details'},{status:400}));await assert.rejects(uploadDataset(csv()),(error:unknown)=>error instanceof Error&&error.message.includes('unique column headings')&&!error.message.includes('private'));
});
test('CSV writes reject missing CSRF and foreign origins before imports or SQL',async()=>{
 mock.method(pool,'query',async()=>({rows:[sessionRow]}));mock.method(pool,'connect',()=>assert.fail('CSRF failure must precede import/query'));
 for(const route of [upload,query])for(const headers of [{Cookie:sessionHeaders.Cookie,Origin:sessionHeaders.Origin},{...sessionHeaders,Origin:'https://untrusted.example'}]){
 const response=await route(new Request('http://localhost:3000/api/datasets',{method:'POST',headers}));assert.equal(response.status,403);
 }
});
test('query responses preserve zero/false/null and reject missing or non-scalar cells',async()=>{
 let rows:unknown[]=[{team:null,amount:0,active:false}];
 mock.method(globalThis,'fetch',async(url:unknown)=>url==='/api/auth/session'?Response.json(session):Response.json({success:true,rows}));
 assert.deepEqual((await runDatasetQuery(dataset,emptyQuery())).rows,rows);
 for(const invalid of [[{team:'Alpha'}],[{team:'Alpha',amount:{private:'nested'},active:true}],Array.from({length:21},()=>({team:'Alpha',amount:1,active:true}))]){rows=invalid;await assert.rejects(runDatasetQuery(dataset,emptyQuery()),{code:'QUERY_FAILED'});}
});

test('CSV mutations use same-origin session CSRF, stable IDs and no client identity',async()=>{
 const {replaceDatasetFile,removeDataset}=await import('../src/lib/dataset-client');const calls:string[]=[];
 mock.method(globalThis,'fetch',async(url:string,init?:RequestInit)=>{
  if(url==='/api/auth/session')return Response.json(session);
  calls.push(init!.method!);assert.equal(url,'/api/datasets/8');assert.equal(init!.credentials,'same-origin');assert.equal((init!.headers as Record<string,string>)['X-CSRF-Token'],session.csrfToken);
  if(init!.method==='PUT'){assert.ok(init!.body instanceof FormData);assert.deepEqual([...init!.body.keys()],['file']);return Response.json({success:true,datasetId:'8',importedRows:1,columns:[{name:'team',type:'text'}]});}
  assert.equal(init!.body,undefined);return Response.json({success:true,datasetId:'8'});
 });
 await replaceDatasetFile('8',csv());await removeDataset('8');assert.deepEqual(calls,['PUT','DELETE']);
});
test('CSV mutations reject stale/missing IDs, session expiry, CSRF and uncertain transport without retries',async()=>{
 const {replaceDatasetFile,removeDataset}=await import('../src/lib/dataset-client');let status=404,calls=0;
 mock.method(globalThis,'fetch',async(url:string)=>{if(url==='/api/auth/session')return Response.json(session);calls++;if(status===0)throw Error('private transport');return Response.json({success:false,error:'private server detail'},{status});});
 await assert.rejects(removeDataset('../8'),{code:'MUTATION_FAILED'});assert.equal(calls,0);
 for(const [code,next] of [['DATASET_UNAVAILABLE',404],['CSRF_REJECTED',403],['UNAUTHENTICATED',401],['MUTATION_INTERRUPTED',0]] as const){status=next;await assert.rejects(removeDataset('8'),{code});}
 assert.equal(calls,4);
 const controller=new AbortController();controller.abort();await assert.rejects(replaceDatasetFile('8',csv(),controller.signal));assert.equal(calls,4);
});

test('identical CSV replacement displays a safe message and is not retried',async()=>{
 const {replaceDatasetFile}=await import('../src/lib/dataset-client');let writes=0;
 mock.method(globalThis,'fetch',async(url:string)=>{if(url==='/api/auth/session')return Response.json(session);writes++;return Response.json({success:false,code:'IDENTICAL_DATASET',error:'private server detail'},{status:409});});
 await assert.rejects(replaceDatasetFile('8',csv()),{code:'IDENTICAL_DATASET',message:'This dataset already contains the same data. No changes were made.'});assert.equal(writes,1);
});

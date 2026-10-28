import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {test,sessionHeaders,sessionRow} from './test-context';
import pool from '../src/lib/db';
import {Pool} from 'pg';
import {runWithIdentity} from '../src/lib/identity';
import {datasetId,replaceDataset,deleteDataset} from '../src/lib/dataset-lifecycle';
import {importGenericCSV,queryDataset,discoverDatasets} from '../src/lib/generic-csv';
import {createAgentSession} from '../src/lib/agent-tools';
import {PUT,DELETE} from '../app/api/datasets/[id]/route';

test('dataset mutation validates IDs and CSV before opening a transaction',async()=>{
 mock.method(pool,'connect',()=>assert.fail('invalid input must not access SQL'));
 try{for(const id of ['0','-1','1 OR 1=1','9223372036854775808'])assert.throws(()=>datasetId(id));
 for(const content of ['','a,a\n1,2','a,b\n1','a\n'])await assert.rejects(replaceDataset('1','fictional.csv',content),{code:'INVALID_FILE'});
 await assert.rejects(replaceDataset('1','../private.csv','a\n1'),{code:'INVALID_FILE'});
 }finally{mock.restoreAll();}
});
test('mutations lock the owned ready dataset and rollback on row insertion failure',async()=>{
 const calls:string[]=[];let released=false;
 mock.method(pool,'connect',async()=>({query:async(sql:string,values:unknown[])=>{calls.push(sql);if(sql.includes('FOR UPDATE')){assert.deepEqual(values,['7','1']);assert.match(sql,/user_id=\$2 AND status='ready'/);return {rows:[{id:'7'}]};}if(sql.startsWith('INSERT INTO generic_csv_rows'))throw Error('fictional write failure');return {rows:[]};},release:()=>{released=true;}}));
 try{await assert.rejects(replaceDataset('7','new.csv','team,amount\nBeta,9'),/fictional write failure/);assert.equal(calls.at(-1),'ROLLBACK');assert.ok(!calls.includes('COMMIT'));assert.equal(released,true);assert.ok(calls.some(s=>s.includes('lock_timeout')));}finally{mock.restoreAll();}
});
test('missing and foreign dataset mutations share a safe 404 with no row deletion',async()=>{
 const calls:string[]=[];
 mock.method(pool,'connect',async()=>({query:async(sql:string)=>{calls.push(sql);return {rows:[]};},release:()=>{}}));
 try{for(const task of [()=>deleteDataset('7'),()=>replaceDataset('7','valid.csv','a\n1')])await assert.rejects(task(),{status:404,code:'DATASET_UNAVAILABLE'});assert.ok(!calls.some(s=>s.startsWith('DELETE')));}finally{mock.restoreAll();}
});
test('PUT and DELETE require session, origin and CSRF; never expose raw database errors',async()=>{
 const context={params:Promise.resolve({id:'7'})};
 for(const route of [PUT,DELETE]){
  assert.equal((await route(new Request('http://localhost:3000/api/datasets/7',{method:route===PUT?'PUT':'DELETE'}),context)).status,401);
 }
 mock.method(pool,'query',async()=>({rows:[sessionRow]}));
 try{
  for(const route of [PUT,DELETE]){const method=route===PUT?'PUT':'DELETE';assert.equal((await route(new Request('http://localhost:3000/api/datasets/7',{method,headers:{Cookie:sessionHeaders.Cookie,Origin:sessionHeaders.Origin}}),context)).status,403);}
  mock.method(pool,'connect',async()=>{throw Error('private database detail');});
  const result=await DELETE(new Request('http://localhost:3000/api/datasets/7',{method:'DELETE',headers:sessionHeaders}),context);assert.equal(result.status,503);assert.ok(!(await result.text()).includes('private database'));
  const form=new FormData();form.set('file',new File(['a\n1'],'../bad.csv'));
  assert.equal((await PUT(new Request('http://localhost:3000/api/datasets/7',{method:'PUT',headers:sessionHeaders,body:form}),context)).status,400);
 }finally{mock.restoreAll();}
});

test('fresh PostgreSQL CSV replacement/deletion: isolation, stable IDs, rollback, snapshots and concurrent operations',{skip:process.env.RUN_CSV_LIFECYCLE_DB_TESTS!=='1'},async()=>{
 // Public fictional fixtures are permitted ONLY in the disposable cluster created by our runner.
 const sql=Pool.prototype.query.bind(pool) as typeof pool.query;
 const check=await sql('SELECT current_database() AS name');assert.match(check.rows[0].name,/^msai_fresh_[a-f0-9]{16}$/);
 const users:string[]=[];let id='';
 const scoped=<T>(owner:string,work:()=>Promise<T>)=>runWithIdentity(owner,work);
 try{
  for(let i=0;i<2;i++)users.push((await sql('INSERT INTO users(name,email) VALUES($1,$2) RETURNING id',['Fictional CSV lifecycle',`csv-lifecycle-${i}-${Date.now()}@example.test`])).rows[0].id);
  const [a,b]=users;
  id=(await scoped(a,()=>importGenericCSV(a,'original.csv','team,amount\nAlpha,10\nBeta,20'))).datasetId;
  const snapshot=async()=>({metadata:(await sql('SELECT * FROM generic_csv_datasets WHERE id=$1',[id])).rows,rows:(await sql('SELECT * FROM generic_csv_rows WHERE dataset_id=$1 ORDER BY row_index',[id])).rows});
  const original=await snapshot();
  for(const csv of ['team,amount\nAlpha,10\nBeta,20','\ufeffteam,amount\r\n"Alpha",10.0\r\nBeta,20.00\r\n'])await assert.rejects(scoped(a,()=>replaceDataset(id,'renamed.csv',csv)),{status:409,code:'IDENTICAL_DATASET'});
  assert.deepEqual(await snapshot(),original);
  await assert.rejects(scoped(b,()=>replaceDataset(id,'same.csv','team,amount\nAlpha,10\nBeta,20')),{status:404});
  await assert.rejects(scoped(b,()=>replaceDataset(id,'foreign.csv','x\n1')),{status:404});await assert.rejects(scoped(b,()=>deleteDataset(id)),{status:404});
  await assert.rejects(scoped(a,()=>replaceDataset(id,'invalid.csv','x,x\n1,2')),{status:400});
  assert.deepEqual(await scoped(a,()=>queryDataset(a,{datasetId:id,aggregate:{op:'sum',column:'amount'}})),[{value:30}]);
  // Inject a real transactional failure after DELETE; rollback must restore all previous rows.
  const realConnect=pool.connect.bind(pool);
  mock.method(pool,'connect',async()=>{const c=await realConnect();const raw=c.query.bind(c);return {query:async(...args:unknown[])=>{if(typeof args[0]==='string'&&args[0].startsWith('INSERT INTO generic_csv_rows'))throw Error('fictional transaction failure');return (raw as (...args:unknown[])=>Promise<unknown>)(...args);},release:()=>c.release()};});
  try{await assert.rejects(scoped(a,()=>replaceDataset(id,'failed.csv','label,value\nZ,8')),/fictional transaction failure/);}finally{mock.restoreAll();}
  assert.deepEqual(await scoped(a,()=>queryDataset(a,{datasetId:id,aggregate:{op:'sum',column:'amount'}})),[{value:30}]);
  // Hold the query after reading its schema; replacement commits before row SELECT.
  let schemaRead!:()=>void,continueQuery!:()=>void;const read=new Promise<void>(r=>schemaRead=r),resume=new Promise<void>(r=>continueQuery=r);let intercept=true;
  mock.method(pool,'connect',async()=>{const c=await realConnect();const raw=c.query.bind(c);return {query:async(...args:unknown[])=>{const result=await (raw as (...args:unknown[])=>Promise<unknown>)(...args);if(intercept&&typeof args[0]==='string'&&args[0].startsWith('SELECT columns')){intercept=false;schemaRead();await resume;}return result;},release:()=>c.release()};});
  const before=scoped(a,()=>queryDataset(a,{datasetId:id,aggregate:{op:'sum',column:'amount'}}));
  try{await read;const replacement=await scoped(a,()=>replaceDataset(id,'replacement.csv','label,score\nGamma,7'));assert.equal(replacement.datasetId,id);}finally{continueQuery();}
  try{assert.deepEqual(await before,[{value:30}]);}finally{mock.restoreAll();}
  assert.deepEqual(await scoped(a,()=>queryDataset(a,{datasetId:id})),[{label:'Gamma',score:7}]);
  const found=(await scoped(a,()=>discoverDatasets(a))).find(d=>d.id===id);assert.equal(found.filename,'replacement.csv');assert.equal(found.row_count,1);
  const parallel=await scoped(a,()=>Promise.allSettled([replaceDataset(id,'same-one.csv','region,total\nNorth,9'),replaceDataset(id,'same-two.csv','region,total\nNorth,9')]));
  assert.equal(parallel.filter(r=>r.status==='fulfilled').length,1);
  const rejected=parallel.find(r=>r.status==='rejected') as PromiseRejectedResult;assert.equal(rejected.reason.code,'IDENTICAL_DATASET');
  // Row order and schema order are meaningful; changed order is a valid replacement.
  await scoped(a,()=>replaceDataset(id,'ordered.csv','name,value\nA,1\nB,2'));
  await scoped(a,()=>replaceDataset(id,'reordered.csv','name,value\nB,2\nA,1'));
  await scoped(a,()=>replaceDataset(id,'columns.csv','value,name\n2,B\n1,A'));
  // Concurrent replacements serialize: schema and rows always belong to one complete CSV.
  await scoped(a,()=>Promise.all([replaceDataset(id,'one.csv','first\n1'),replaceDataset(id,'two.csv','second\n2\n3')]));
  const current=(await scoped(a,()=>discoverDatasets(a))).find(d=>d.id===id),rows=await scoped(a,()=>queryDataset(a,{datasetId:id}));assert.equal(rows.length,current.row_count);assert.ok(rows.every(row=>Object.keys(row).join()===current.columns[0].name));
  const outcomes=await scoped(a,()=>Promise.allSettled([replaceDataset(id,'race.csv','n\n1'),deleteDataset(id)]));assert.equal(outcomes[1].status,'fulfilled');
  assert.deepEqual(await sql('SELECT 1 FROM generic_csv_rows WHERE dataset_id=$1',[id]).then(r=>r.rows),[]);
  const agent=createAgentSession({search:async()=>[],discover:signal=>scoped(a,()=>discoverDatasets(a,signal)),query:(plan,signal)=>scoped(a,()=>queryDataset(a,plan,signal))},new AbortController().signal,0.5);
  const discovery=await agent.execute('discoverDatasets',{}) as {datasets:Array<{id:string}>};assert.ok(!discovery.datasets.some(d=>d.id===id));
  const denied=await agent.execute('inspectDataset',{datasetId:id}) as {error?:string};assert.ok(denied.error);
  const noQuery=await agent.execute('queryDataset',{datasetId:id,aggregate:{op:'count'}}) as {error?:string};assert.ok(noQuery.error);assert.deepEqual(agent.evidence().csv,[]);
  await assert.rejects(scoped(a,()=>queryDataset(a,{datasetId:id})),/unavailable/);assert.ok(!(await scoped(a,()=>discoverDatasets(a))).some(d=>d.id===id));
  await assert.rejects(scoped(a,()=>deleteDataset(id)),{status:404});
 }finally{
  mock.restoreAll();
  if(id){await sql('DELETE FROM generic_csv_rows WHERE dataset_id=$1',[id]);await sql('DELETE FROM generic_csv_datasets WHERE id=$1',[id]);}
  for(const user of users)await sql('DELETE FROM users WHERE id=$1',[user]);
 }
});

test('authenticated CSV mutation routes return stable identity and safe success responses',async()=>{
 mock.method(pool,'query',async()=>({rows:[sessionRow]}));const calls:string[]=[];
 mock.method(pool,'connect',async()=>({query:async(sql:string,values:unknown[])=>{calls.push(sql);if(sql.includes('FOR UPDATE')){assert.deepEqual(values,['7','1']);return {rows:[{id:'7'}]};}return {rows:[]};},release:()=>{}}));
 try{
  const form=new FormData();form.set('file',new File(['region,score\nNorth,9'],'replacement.csv'));form.set('userId','999');
  const response=await PUT(new Request('http://localhost:3000/api/datasets/7',{method:'PUT',headers:sessionHeaders,body:form}),{params:Promise.resolve({id:'7'})});assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true,datasetId:'7',importedRows:1,columns:[{name:'region',type:'text'},{name:'score',type:'number'}]});
  assert.equal((await DELETE(new Request('http://localhost:3000/api/datasets/7',{method:'DELETE',headers:sessionHeaders}),{params:Promise.resolve({id:'7'})})).status,200);assert.equal(calls.filter(c=>c==='COMMIT').length,2);
 }finally{mock.restoreAll();}
});
test('cancelled mutation rolls back before publishing replacement',async()=>{
 const controller=new AbortController(),calls:string[]=[];
 mock.method(pool,'connect',async()=>({query:async(sql:string)=>{calls.push(sql);if(sql.includes('FOR UPDATE'))return {rows:[{id:'7'}]};if(sql.startsWith('INSERT INTO'))controller.abort();return {rows:[]};},release:()=>{}}));
 try{await assert.rejects(replaceDataset('7','fictional.csv','a\n1',controller.signal));assert.equal(calls.at(-1),'ROLLBACK');assert.ok(!calls.includes('COMMIT'));}finally{mock.restoreAll();}
});

test('identical replacement returns safe 409 after ownership lock, without any data writes',async()=>{
 const calls:string[]=[];
 mock.method(pool,'query',async()=>({rows:[sessionRow]}));
 mock.method(pool,'connect',async()=>({query:async(sql:string,values:unknown[])=>{calls.push(sql);if(sql.includes('FOR UPDATE'))return {rows:[{id:'7'}]};if(sql.includes('AS identical')){assert.deepEqual(values,['7',JSON.stringify([{name:'amount',type:'number'}]),JSON.stringify([{amount:1}]),'1']);return {rows:[{identical:true}]};}return {rows:[]};},release:()=>{}}));
 try{
  const form=new FormData();form.set('file',new File(['amount\n1.0'],'renamed.csv'));
  const response=await PUT(new Request('http://localhost:3000/api/datasets/7',{method:'PUT',headers:sessionHeaders,body:form}),{params:Promise.resolve({id:'7'})});assert.equal(response.status,409);assert.deepEqual(await response.json(),{success:false,code:'IDENTICAL_DATASET',error:'This dataset already contains the same data. No changes were made.'});
  assert.ok(calls.findIndex(s=>s.includes('FOR UPDATE'))<calls.findIndex(s=>s.includes('AS identical')));assert.ok(!calls.some(s=>/^(DELETE|INSERT|UPDATE)/.test(s)));assert.equal(calls.at(-1),'ROLLBACK');
 }finally{mock.restoreAll();}
});

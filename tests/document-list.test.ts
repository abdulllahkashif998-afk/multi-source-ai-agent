import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/lib/db';
import { GET } from '../app/api/documents/route';
import { listDocuments, readDocumentPagination } from '../src/lib/list-documents';
import { runWithIdentity } from '../src/lib/identity';
import { sessionHeaders, sessionRow } from './test-context';
afterEach(()=>mock.restoreAll());
const row=(id:string)=>({id,filename:`fictional-${id}.PDF`,status:'ready',uploadedAt:new Date('2026-01-01T10:00:00Z'),version:2});
test('document pagination bounds rows, rejects unsafe cursors, repeated and unknown parameters',()=>{
 assert.deepEqual(readDocumentPagination('http://local/api/documents'),{limit:10});
 assert.deepEqual(readDocumentPagination('http://local/api/documents?before=42&limit=2'),{before:'42',limit:2});
 for(const query of ['limit=0','limit=51','limit=1.2','before=0','before=9223372036854775808','before=1%27%20OR%201=1','userId=2','limit=1&limit=2','before='])assert.throws(()=>readDocumentPagination(`http://local/?${query}`),{status:400});
});
test('document list uses a bounded owner-scoped read-only transaction and exposes metadata only',async()=>{
 const queries:Array<{sql:string;values?:unknown[]}>=[];let released=false;
 mock.method(pool,'connect',async()=>({query:async(sql:string,values?:unknown[])=>{queries.push({sql,values});return {rows:sql.startsWith('SELECT')?[{...row('7'),file_path:'/private',file_hash:'secret',user_id:'2'},row('6'),row('5')]:[]};},release:()=>{released=true;}}));
 const result=await runWithIdentity('2',()=>listDocuments({limit:2,before:'9'}));
 assert.deepEqual(result.documents.map(d=>d.id),['7','6']);assert.equal(result.nextCursor,'6');assert.equal(result.documents[0].fileType,'pdf');assert.equal(result.documents[0].uploadedAt,'2026-01-01T10:00:00.000Z');
 assert.deepEqual(queries.find(q=>q.sql.startsWith('SELECT'))!.values,['2','9',3]);
 assert.match(queries.find(q=>q.sql.startsWith('SELECT'))!.sql,/user_id=\$1/);assert.match(queries.find(q=>q.sql.startsWith('SELECT'))!.sql,/NOT IN \('deleted','superseded'\)/);
 assert.deepEqual(queries.slice(0,2).map(q=>q.sql),['BEGIN READ ONLY',"SET LOCAL statement_timeout = '5s'"]);assert.equal(queries.at(-1)?.sql,'COMMIT');assert.equal(released,true);
 assert.ok(!JSON.stringify(result).includes('/private'));assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!('user_id' in result.documents[0]));
});
test('missing sessions never reach document queries and failed lists sanitize errors',async()=>{
 mock.method(pool,'query',()=>assert.fail('anonymous database access'));assert.equal((await GET(new Request('http://localhost/api/documents'))).status,401);mock.restoreAll();
 mock.method(pool,'query',async()=>({rows:[sessionRow]}));mock.method(pool,'connect',async()=>{throw new Error('private database credential');});
 const response=await GET(new Request('http://localhost/api/documents',{headers:sessionHeaders}));assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private'));
});
test('document list rolls back on query failure and requires a trusted identity',async()=>{
 const queries:string[]=[];let released=false;
 mock.method(pool,'connect',async()=>({query:async(sql:string)=>{queries.push(sql);if(sql.startsWith('SELECT'))throw new Error('database failure');return {rows:[]};},release:()=>{released=true;}}));
 await assert.rejects(listDocuments({limit:20}),{status:401});assert.equal(queries.length,0);
 await assert.rejects(runWithIdentity('3',()=>listDocuments({limit:20})));assert.equal(queries.at(-1),'ROLLBACK');assert.equal(released,true);
});
test('document upload, replacement and deletion require valid CSRF before parsing or storage',async()=>{
 const {POST}=await import('../app/api/upload/route');const {PUT,DELETE}=await import('../app/api/documents/[id]/route');
 mock.method(pool,'query',async()=>({rows:[sessionRow]}));mock.method(pool,'connect',()=>assert.fail('CSRF rejection must precede storage access'));
 for(const [method,route] of [['POST',POST],['PUT',PUT],['DELETE',DELETE]] as const){
 for(const headers of [{Cookie:sessionHeaders.Cookie,Origin:sessionHeaders.Origin},{...sessionHeaders,Origin:'https://untrusted.example'}]){
 const request=new Request('http://localhost:3000/api/documents/9',{method,headers});
 const response=await route(request,{params:Promise.resolve({id:'9'})});assert.equal(response.status,403);assert.equal((await response.json()).code,'CSRF_REJECTED');
 }
 }
});

test('thirteen documents paginate into ten then three without duplicate or missing IDs',async()=>{
 const rows=Array.from({length:13},(_,i)=>row(String(13-i)));
 mock.method(pool,'connect',async()=>({query:async(sql:string,values?:unknown[])=>({rows:sql.startsWith('SELECT')?rows.filter(r=>!values![1]||BigInt(r.id)<BigInt(String(values![1]))).slice(0,Number(values![2])):[]}),release:()=>{}}));
 const limit=readDocumentPagination('http://localhost/api/documents').limit;
 const first=await runWithIdentity('1',()=>listDocuments({limit}));
 assert.equal(first.documents.length,10);assert.equal(first.nextCursor,'4');
 const second=await runWithIdentity('1',()=>listDocuments({limit,before:first.nextCursor!}));
 assert.equal(second.documents.length,3);assert.equal(second.nextCursor,null);
 assert.deepEqual([...first.documents,...second.documents].map(d=>d.id),rows.map(r=>r.id));
});

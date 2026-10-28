import { mock } from 'node:test';
import { test, sessionHeaders, sessionRow } from './test-context';
import assert from 'node:assert/strict';
import pool from '../src/lib/db';
import { ingestDocument, deleteDocument, cleanupDocumentFiles, requireUserId, documentId, validateDocument, type DocumentDependencies, DocumentError } from '../src/lib/document-lifecycle';
import { removeDocumentFile } from '../src/lib/document-files';
const buffer=Buffer.from('fictional content');
function setup(options:{duplicate?:boolean;missing?:boolean;embedFail?:boolean;cleanupFail?:boolean;insertFail?:boolean;commitFail?:boolean;uniqueViolation?:string}={}) {
 const calls:Array<{sql:string;values?:unknown[]}>=[];
 let embeddings=0;let removals=0;let saves=0;
 mock.method(pool,'connect',async()=>({query:async(sql:string,values?:unknown[])=>{
   calls.push({sql,values});
   if(options.uniqueViolation&&sql.startsWith("UPDATE documents SET status='ready'"))throw Object.assign(new Error('fictional uniqueness conflict'),{code:'23505',constraint:options.uniqueViolation});
   if(options.insertFail&&sql.startsWith('INSERT INTO document_chunks'))throw new Error('fictional insert failure');
   if(options.commitFail&&sql==='COMMIT')throw new Error('fictional lost commit response');
   if(sql.startsWith('SELECT id,version'))return {rows:options.missing?[]:[{id:'9',version:2}]};
   if(sql.startsWith('SELECT id FROM documents'))return {rows:options.duplicate?[{id:'9'}]:[]};
   if(sql.startsWith('INSERT INTO documents'))return {rows:[{id:'10'}]};
   if(sql.startsWith('SELECT status'))return {rows:options.missing?[]:[{status:'ready'}]};
   if(sql.startsWith('SELECT q.document_id'))return {rows:[{document_id:'9',file_path:'fictional-path'}]};
   return {rows:[]};
 },release:()=>{}}));
 const deps:DocumentDependencies={parse:async()=>'Fictional policy text.',embed:async()=>{embeddings++;if(options.embedFail)throw new Error('fictional failure');return Array(768).fill(0.1);},save:async()=>{saves++;return 'fictional-path';},remove:async()=>{removals++;if(options.cleanupFail)throw new Error('fictional cleanup failure');}};
 return {calls,deps,counts:()=>({embeddings,removals,saves})};
}
test('duplicate upload returns owned ID before parsing, embedding or saving',async()=>{
 const s=setup({duplicate:true});
 try{await assert.rejects(ingestDocument('a.docx',buffer,new AbortController().signal,undefined,s.deps),(e:unknown)=>e instanceof DocumentError&&e.code==='DUPLICATE_DOCUMENT'&&e.existingDocumentId==='9');assert.equal(s.counts().embeddings,0);assert.equal(s.counts().saves,0);assert.ok(s.calls.some(c=>c.sql==='ROLLBACK'));assert.ok(s.calls.find(c=>c.sql.includes('file_hash'))!.sql.includes('user_id=$1'));}finally{mock.restoreAll();}
});
test('replacement publishes new chunks and retires old version atomically with audit',async()=>{
 const s=setup();try{
 const result=await ingestDocument('same-name.docx',buffer,new AbortController().signal,'9',s.deps);
 assert.equal(result.version,3);assert.equal(result.replacesDocumentId,'9');
 const statements=s.calls.map(c=>c.sql);
 assert.ok(statements.findIndex(s=>s.startsWith('INSERT INTO document_chunks'))<statements.findIndex(s=>s.includes("status='superseded'")));
 assert.ok(statements.some(s=>s==='DELETE FROM document_chunks WHERE document_id=$1'));
 assert.ok(statements.some(s=>s.includes('INSERT INTO document_events')));
 assert.equal(statements.at(-1),'COMMIT');assert.equal(s.counts().removals,0);
 }finally{mock.restoreAll();}
});
test('failed preparation leaves previous version active and writes no chunks',async()=>{
 const s=setup({embedFail:true});try{
 await assert.rejects(ingestDocument('replacement.pdf',buffer,new AbortController().signal,'9',s.deps));
 assert.ok(s.calls.some(c=>c.sql==='ROLLBACK'));
 assert.ok(!s.calls.some(c=>c.sql.startsWith('UPDATE documents')||c.sql.startsWith('INSERT INTO document_chunks')));
 }finally{mock.restoreAll();}
});
test('unauthorized replacement and deletion cannot mutate or embed',async()=>{
 const s=setup({missing:true});try{
 await assert.rejects(ingestDocument('r.docx',buffer,new AbortController().signal,'999',s.deps),(e:unknown)=>e instanceof DocumentError&&e.status===404);
 await assert.rejects(deleteDocument('999'),(e:unknown)=>e instanceof DocumentError&&e.status===404);
 assert.equal(s.counts().embeddings,0);assert.ok(!s.calls.some(c=>/^(UPDATE|DELETE|INSERT)/.test(c.sql)));
 }finally{mock.restoreAll();}
});
test('deletion retires before chunk removal and persists cleanup job before commit',async()=>{
 const s=setup();try{await deleteDocument('9');const q=s.calls.map(c=>c.sql);assert.ok(q.findIndex(s=>s.includes("status='deleted'"))<q.findIndex(s=>s.startsWith('DELETE FROM document_chunks')));assert.ok(q.some(s=>s.startsWith('INSERT INTO document_file_cleanup')));assert.equal(q.at(-1),'COMMIT');}finally{mock.restoreAll();}
});
test('file cleanup failure retains a retryable job without restoring active status',async()=>{
 const s=setup({cleanupFail:true});try{const result=await cleanupDocumentFiles('9',s.deps.remove);assert.equal(result.pending,1);assert.ok(s.calls.some(c=>c.sql.startsWith('UPDATE document_file_cleanup')));assert.ok(!s.calls.some(c=>c.sql.startsWith('UPDATE documents')));assert.match(s.calls.find(c=>c.sql.startsWith('SELECT q.document_id'))!.sql,/d.user_id=\$1/);}finally{mock.restoreAll();}
});
test('IDs, files and unsafe paths are validated; trusted identity works in production',async()=>{
 for(const id of ['0','-1','../2','9223372036854775808'])assert.throws(()=>documentId(id));
 for(const name of ['../a.docx','a.exe','a\\b.pdf'])assert.throws(()=>validateDocument(name,10));
 assert.throws(()=>validateDocument('a.docx',0));assert.throws(()=>validateDocument('a.pdf',11*1024*1024));
 await assert.rejects(removeDocumentFile('/tmp/not-a-document.pdf'),/Unsafe/);
 const old=process.env.NODE_ENV;Object.assign(process.env,{NODE_ENV:'production'});try{assert.equal(requireUserId(),'1');}finally{if(old===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:old});}
});
test('concurrent uploads serialize duplicate checks before any second embedding',async()=>{
 let releaseGate:()=>void=()=>{};let locked=false;let published=false;let embeds=0;
 const gate=new Promise<void>(r=>{releaseGate=r;});
 mock.method(pool,'connect',async()=>({query:async(sql:string)=>{
   if(sql.includes('pg_advisory_xact_lock')){if(locked)await gate;else locked=true;}
   if(sql.startsWith('SELECT id FROM documents'))return {rows:published?[{id:'10'}]:[]};
   if(sql.startsWith('INSERT INTO documents'))return {rows:[{id:'10'}]};
   if(sql==='COMMIT'){published=true;releaseGate();}
   return {rows:[]};
 },release:()=>{}}));
 const deps:DocumentDependencies={parse:async()=>'Fictional text.',embed:async()=>{embeds++;return Array(768).fill(0.1);},save:async()=>'fictional-path',remove:async()=>{}};
 try{const results=await Promise.allSettled([ingestDocument('a.docx',buffer,new AbortController().signal,undefined,deps),ingestDocument('b.docx',buffer,new AbortController().signal,undefined,deps)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(embeds,1);const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;assert.equal(rejected.reason.code,'DUPLICATE_DOCUMENT');}finally{releaseGate();mock.restoreAll();}
});
test('PostgreSQL lifecycle transactions preserve old versions on failure and exclude retired chunks',{skip:process.env.RUN_LIFECYCLE_DB_TESTS!=='1'},async()=>{
 const client=await pool.connect();const raw=client.query.bind(client);
 let embeds=0;let failEmbedding=false;
 const deps:DocumentDependencies={parse:async(b)=>b.toString(),embed:async()=>{embeds++;if(failEmbedding)throw new Error('fictional embedding failure');return [1,...Array(767).fill(0)];},save:async()=>`fictional-path-${embeds}`,remove:async()=>{}};
 try {
 await raw('BEGIN');
 await raw('CREATE TEMP TABLE documents (LIKE public.documents INCLUDING DEFAULTS) ON COMMIT DROP');
 await raw('CREATE TEMP SEQUENCE lifecycle_document_ids START 10001');
 await raw("ALTER TABLE documents ALTER COLUMN id SET DEFAULT nextval('pg_temp.lifecycle_document_ids')");
 await raw("CREATE UNIQUE INDEX lifecycle_test_active_hash ON documents(user_id,file_hash) WHERE status='ready'");
 await raw('CREATE TEMP TABLE document_chunks (LIKE public.document_chunks INCLUDING DEFAULTS) ON COMMIT DROP');
 await raw('CREATE TEMP SEQUENCE lifecycle_chunk_ids START 10001');
 await raw("ALTER TABLE document_chunks ALTER COLUMN id SET DEFAULT nextval('pg_temp.lifecycle_chunk_ids')");
 await raw('CREATE TEMP TABLE document_events (LIKE public.document_events INCLUDING IDENTITY INCLUDING DEFAULTS) ON COMMIT DROP');
 await raw('CREATE TEMP TABLE document_file_cleanup (LIKE public.document_file_cleanup INCLUDING DEFAULTS INCLUDING INDEXES) ON COMMIT DROP');
 mock.method(pool,'connect',async()=>({query:async(sql:string,values?:unknown[])=>{
 if(sql==='BEGIN')return raw('SAVEPOINT lifecycle_operation');
 if(sql==='COMMIT')return raw('RELEASE SAVEPOINT lifecycle_operation');
 if(sql==='ROLLBACK'){await raw('ROLLBACK TO SAVEPOINT lifecycle_operation');return raw('RELEASE SAVEPOINT lifecycle_operation');}
 return raw(sql,values);
 },release:()=>{}}));
 mock.method(pool,'query',async(config:Parameters<typeof client.query>[0])=>raw(config));
 mock.method(globalThis,'fetch',async()=>Response.json({embeddings:[[1,...Array(767).fill(0)]]}));
 const first=await ingestDocument('fictional.docx',Buffer.from('Original fictional policy.'),new AbortController().signal,undefined,deps);
 await raw('SAVEPOINT unique_probe');
 const existingHash=(await raw('SELECT file_hash FROM documents WHERE id=$1',[first.documentId])).rows[0].file_hash;
 await assert.rejects(raw("INSERT INTO documents(id,user_id,filename,file_path,file_hash,status) VALUES(99998,1,'duplicate.docx','fictional',$1,'ready')",[existingHash]),(e:unknown)=>(e as {code?:string}).code==='23505');
 await raw('ROLLBACK TO SAVEPOINT unique_probe');await raw('RELEASE SAVEPOINT unique_probe');
 await assert.rejects(ingestDocument('renamed.docx',Buffer.from('Original fictional policy.'),new AbortController().signal,undefined,deps),(e:unknown)=>e instanceof DocumentError&&e.code==='DUPLICATE_DOCUMENT');
 assert.equal(embeds,1);
 failEmbedding=true;
 await assert.rejects(ingestDocument('replacement.docx',Buffer.from('New fictional policy.'),new AbortController().signal,first.documentId,deps));
 assert.equal((await raw('SELECT status FROM documents WHERE id=$1',[first.documentId])).rows[0].status,'ready');
 failEmbedding=false;
 const next=await ingestDocument('fictional.docx',Buffer.from('New fictional policy.'),new AbortController().signal,first.documentId,deps);
 assert.equal(next.version,2);
 assert.equal((await raw('SELECT status FROM documents WHERE id=$1',[first.documentId])).rows[0].status,'superseded');
 assert.equal((await raw('SELECT count(*)::int n FROM document_chunks WHERE document_id=$1',[first.documentId])).rows[0].n,0);
 const {searchDocuments}=await import('../src/lib/search-documents');
 for(const mode of ['semantic','hybrid'] as const){const found=await searchDocuments('fictional policy',undefined,{mode});assert.deepEqual(found.map(r=>r.document_id),[next.documentId]);}
 await raw("INSERT INTO documents(id,user_id,filename,file_path,file_hash,status) VALUES(99999,2,'foreign.docx','foreign','foreign','ready')");
 await assert.rejects(deleteDocument('99999'),(e:unknown)=>e instanceof DocumentError&&e.status===404);
 await deleteDocument(next.documentId);
 for(const mode of ['semantic','hybrid'] as const)assert.deepEqual(await searchDocuments('fictional policy',undefined,{mode}),[]);
 assert.equal((await raw('SELECT count(*)::int n FROM document_chunks WHERE document_id=$1',[next.documentId])).rows[0].n,0);
 const failure=await cleanupDocumentFiles(next.documentId,async()=>{throw new Error('fictional disk failure');});assert.equal(failure.pending,1);
 assert.equal((await raw('SELECT attempts FROM document_file_cleanup WHERE document_id=$1',[next.documentId])).rows[0].attempts,1);
 const success=await cleanupDocumentFiles(next.documentId,async()=>{});assert.equal(success.removed,1);
 assert.equal((await raw('SELECT count(*)::int n FROM document_events')).rows[0].n,3);
 }finally{mock.restoreAll();await raw('ROLLBACK');client.release(true);}
});
test('failed publication rolls back and removes only the newly staged file',async()=>{
 const s=setup({insertFail:true});try{await assert.rejects(ingestDocument('new.docx',buffer,new AbortController().signal,'9',s.deps));assert.equal(s.counts().removals,1);assert.ok(s.calls.some(c=>c.sql==='ROLLBACK'));assert.ok(!s.calls.some(c=>c.sql.includes("status='superseded'")));}finally{mock.restoreAll();}
});
test('an ambiguous commit never deletes a possibly published file',async()=>{
 const s=setup({commitFail:true});try{await assert.rejects(ingestDocument('new.docx',buffer,new AbortController().signal,'9',s.deps));assert.equal(s.counts().saves,1);assert.equal(s.counts().removals,0);}finally{mock.restoreAll();}
});
test('a same-name ordinary upload does not retire another version',async()=>{
 const s=setup();try{await ingestDocument('same.docx',Buffer.from('first'),new AbortController().signal,undefined,s.deps);await ingestDocument('same.docx',Buffer.from('second'),new AbortController().signal,undefined,s.deps);assert.ok(!s.calls.some(c=>c.sql.includes("status='superseded'")));}finally{mock.restoreAll();}
});
test('managed UUID files can be removed and missing files are idempotent',async()=>{
 const {saveDocumentFile}=await import('../src/lib/document-files');
 const {readFile}=await import('node:fs/promises');
 const target=await saveDocumentFile(Buffer.from('fictional test file'),'.docx');
 try{assert.equal((await readFile(target)).toString(),'fictional test file');await removeDocumentFile(target);await assert.rejects(readFile(target));await removeDocumentFile(target);}finally{await removeDocumentFile(target);}
});
test('HTTP operations reject anonymous production requests before parsing files or accessing data',async()=>{
 const {POST:upload}=await import('../app/api/upload/route');
 const {PUT,DELETE}=await import('../app/api/documents/[id]/route');
 const {POST:cleanup}=await import('../app/api/documents/cleanup/route');
 const old=process.env.NODE_ENV;Object.assign(process.env,{NODE_ENV:'production'});
 try{
 const request=new Request('http://localhost/api/upload',{method:'POST'});
 for(const response of [await upload(request),await PUT(request,{params:Promise.resolve({id:'1'})}),await DELETE(request,{params:Promise.resolve({id:'1'})}),await cleanup(new Request('http://localhost/api/documents/cleanup',{method:'POST'}))])assert.equal(response.status,401);
 }finally{if(old===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:old});}
});
test('HTTP replacement and deletion enforce ownership and sanitize errors',async()=>{
 const s=setup({missing:true});
 mock.method(pool,'query',async()=>({rows:[sessionRow]}));
 const {PUT,DELETE}=await import('../app/api/documents/[id]/route');
 try{
 const form=new FormData();form.set('file',new File(['fictional'],'r.docx'));
 const request=new Request('http://localhost/api/documents/999',{method:'PUT',body:form,headers:sessionHeaders});
 const replacement=await PUT(request,{params:Promise.resolve({id:'999'})});assert.equal(replacement.status,404);
 const deletion=await DELETE(new Request('http://localhost/api/documents/999',{method:'DELETE',headers:sessionHeaders}),{params:Promise.resolve({id:'999'})});assert.equal(deletion.status,404);
 assert.ok(!s.calls.some(c=>/^(DELETE|INSERT|UPDATE)/.test(c.sql)));
 }finally{mock.restoreAll();}
});
test('only the active-hash uniqueness constraint becomes a duplicate response',async()=>{
 for(const constraint of ['documents_active_owner_hash_idx','unrelated_constraint']) {
 const s=setup({uniqueViolation:constraint});
 try{await assert.rejects(ingestDocument('new.docx',buffer,new AbortController().signal,undefined,s.deps),(e:unknown)=>constraint==='documents_active_owner_hash_idx'?e instanceof DocumentError&&e.code==='DUPLICATE_DOCUMENT':(e as {code?:string}).code==='23505');assert.equal(s.counts().removals,1);}finally{mock.restoreAll();}
 }
});

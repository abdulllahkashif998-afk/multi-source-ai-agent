import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchDocuments, mutateDocument, validateDocumentFile } from '../src/lib/document-client';
const originalXHR=globalThis.XMLHttpRequest;
afterEach(()=>{mock.restoreAll();if(originalXHR)globalThis.XMLHttpRequest=originalXHR;else Reflect.deleteProperty(globalThis,'XMLHttpRequest');});
const file=()=>new File(['fictional document'],'fictional.docx');
test('document file validation allows PDF/DOCX and rejects empty, unsafe, wrong-type and oversized files',()=>{
 assert.equal(validateDocumentFile(file()).name,'fictional.docx');assert.ok(validateDocumentFile(new File(['x'],'policy.PDF')));
 for(const f of [new File([],'empty.pdf'),new File(['x'],'a.csv'),new File(['x'],'../a.pdf'),new File([new Uint8Array(10*1024*1024+1)],'large.pdf')])assert.throws(()=>validateDocumentFile(f),{code:'INVALID_FILE'});
});
test('document list uses same-origin no-store requests and validates/sanitizes responses',async()=>{
 mock.method(globalThis,'fetch',async(url:unknown,init?:RequestInit)=>{assert.equal(url,'/api/documents?limit=10&before=2');assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');return Response.json({success:true,documents:[],nextCursor:null});});
 assert.deepEqual((await fetchDocuments('2')).documents,[]);mock.restoreAll();
 for(const [status,body,code] of [[401,{code:'UNAUTHENTICATED'},'UNAUTHENTICATED'],[503,{error:'secret'},'DOCUMENT_FAILED'],[200,{success:true,documents:[{file_path:'private'}]},'DOCUMENT_LIST_FAILED']] as const){
 mock.method(globalThis,'fetch',async()=>Response.json(body,{status}));await assert.rejects(fetchDocuments(),(error:unknown)=>error instanceof Error&&!error.message.includes('secret')&&!error.message.includes('private')&&(error as {code?:string}).code===code);mock.restoreAll();}
});
class FakeXHR {
 static status=200;static body:unknown={success:true,documentId:'42',version:2};static seen:FakeXHR[]=[];
 status=FakeXHR.status;responseText=JSON.stringify(FakeXHR.body);withCredentials=false;timeout=0;method='';url='';headers:Record<string,string>={};body?:Document|XMLHttpRequestBodyInit|null;
 upload:{onprogress?: (event:{lengthComputable:boolean;loaded:number;total:number})=>void;onload?:()=>void}={};
 onload?:()=>void;onerror?:()=>void;ontimeout?:()=>void;onabort?:()=>void;
 constructor(){FakeXHR.seen.push(this);}open(method:string,url:string){this.method=method;this.url=url;}setRequestHeader(key:string,value:string){this.headers[key]=value;}
 send(body?:Document|XMLHttpRequestBodyInit|null){this.body=body;this.upload.onprogress?.({lengthComputable:true,loaded:10,total:10});this.upload.onload?.();this.onload?.();}abort(){this.onabort?.();}
}
function setup(status=200,body:unknown={success:true,documentId:'42',version:2}) {
 FakeXHR.status=status;FakeXHR.body=body;FakeXHR.seen=[];globalThis.XMLHttpRequest=FakeXHR as unknown as typeof XMLHttpRequest;
 mock.method(globalThis,'fetch',async()=>Response.json({success:true,name:'Fictional',email:'fictional@example.test',csrfToken:'c'.repeat(64)}));
}
test('upload, replacement and deletion refresh session CSRF, use expected methods, and report actual upload phases',async()=>{
 setup();
 for(const action of ['upload','replace','delete'] as const){
 const phases:string[]=[];await mutateDocument(action,{id:'9',file:file(),onProgress:p=>phases.push(p.phase)});
 const xhr=FakeXHR.seen.at(-1)!;assert.equal(xhr.method,{upload:'POST',replace:'PUT',delete:'DELETE'}[action]);assert.equal(xhr.url,action==='upload'?'/api/upload':'/api/documents/9');assert.equal(xhr.withCredentials,true);assert.equal(xhr.headers['X-CSRF-Token'],'c'.repeat(64));assert.ok(!('Content-Type' in xhr.headers));
 if(action!=='delete'){assert.ok(xhr.body instanceof FormData);assert.deepEqual(phases,['session','uploading','uploading','processing']);}else assert.deepEqual(phases,['session','deleting']);
 }
});
test('duplicate, replacement failure, CSRF rejection and expired sessions return safe errors without retrying',async()=>{
 for(const [status,code] of [[409,'DUPLICATE_DOCUMENT'],[422,'INVALID_CONTENT'],[403,'CSRF_REJECTED'],[401,'UNAUTHENTICATED']] as const){
 setup(status,{success:false,code,error:'/private/storage/document.pdf'});
 await assert.rejects(mutateDocument('replace',{id:'9',file:file()}),(error:unknown)=>error instanceof Error&&!error.message.includes('/private')&&(error as {code?:string}).code===code);assert.equal(FakeXHR.seen.length,1);mock.restoreAll();
 }
 setup();mock.method(globalThis,'fetch',async()=>Response.json({success:false,code:'UNAUTHENTICATED'},{status:401}));await assert.rejects(mutateDocument('delete',{id:'9'}),{code:'UNAUTHENTICATED'});assert.equal(FakeXHR.seen.length,0);
});
test('document mutations respect pre-aborted operations and validate IDs before requests',async()=>{
 setup();await assert.rejects(mutateDocument('delete',{id:'9',signal:AbortSignal.abort()}));assert.equal(FakeXHR.seen.length,0);
 await assert.rejects(mutateDocument('delete',{id:'../private'}));assert.equal(FakeXHR.seen.length,0);
});

test('successful-looking upload responses without version metadata fail safely',async()=>{
 setup(200,{success:true,documentId:'42'});await assert.rejects(mutateDocument('upload',{file:file()}),{code:'DOCUMENT_FAILED'});assert.equal(FakeXHR.seen.length,1);
});

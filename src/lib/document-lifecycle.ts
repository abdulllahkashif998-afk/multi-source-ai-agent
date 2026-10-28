import { measure } from './reliability';
import { timedQuery } from './db';
import { requireUserId } from './identity';
export { requireUserId } from './identity';
import { createHash } from 'node:crypto';
import path from 'node:path';
import pool from './db';
import { parseDocument } from './parse-document';
import { chunkText } from './chunk-text';
import { generateEmbedding } from './embeddings';
import { saveDocumentFile, removeDocumentFile } from './document-files';

export class DocumentError extends Error {
 constructor(public code:string,message:string,public status:number,public existingDocumentId?:string){super(message);}
}
export function documentId(value:string) {
 if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>BigInt('9223372036854775807')) throw new DocumentError('INVALID_ID','Invalid document ID.',400);
 return value;
}
export function validateDocument(filename:string,size:number) {
 const extension=path.extname(filename).toLowerCase();
 if(!['.pdf','.docx'].includes(extension)) throw new DocumentError('INVALID_FILE','Provide a PDF or DOCX file.',400);
 if(!size||size>10*1024*1024) throw new DocumentError('INVALID_FILE','File must be between 1 byte and 10 MiB.',400);
 if(filename.length>255||filename.includes('/')||filename.includes('\\')||/[\x00-\x1f]/.test(filename)) throw new DocumentError('INVALID_FILE','Invalid filename.',400);
 return extension;
}
export interface DocumentDependencies {
 parse: typeof parseDocument;
 embed: typeof generateEmbedding;
 save: typeof saveDocumentFile;
 remove: typeof removeDocumentFile;
}
const defaults:DocumentDependencies={parse:parseDocument,embed:generateEmbedding,save:saveDocumentFile,remove:removeDocumentFile};

// A user-scoped advisory lock serializes preparation as well as publication.
// Every lifecycle mutation uses the same lock; the unique index is a second guard.
export async function ingestDocument(filename:string,buffer:Buffer,signal:AbortSignal,replaceId?:string,deps=defaults) {
 const userId=requireUserId();
 if(replaceId)documentId(replaceId);
 const extension=validateDocument(filename,buffer.length);
 const hash=createHash('sha256').update(buffer).digest('hex');
 const client=await pool.connect();
 let savedPath:string|undefined;
 let committed=false;
 let commitAttempted=false;
 let retiredId:string|undefined;
 try {
 await timedQuery(()=>client.query('BEGIN'));
 await timedQuery(()=>client.query("SET LOCAL lock_timeout = '5s'"));
 await timedQuery(()=>client.query("SET LOCAL statement_timeout = '10s'"));
 await timedQuery(()=>client.query("SELECT pg_advisory_xact_lock(hashtextextended('document-owner:' || $1::text,782001))",[userId]));
 signal.throwIfAborted();
 let previous:{id:string;version:number}|undefined;
 if(replaceId) {
   const owned=await timedQuery(()=>client.query("SELECT id,version FROM documents WHERE id=$1 AND user_id=$2 AND status='ready' FOR UPDATE",[replaceId,userId]));
   previous=owned.rows[0];
   if(!previous)throw new DocumentError('DOCUMENT_NOT_FOUND','Active document not found.',404);
 }
 const duplicate=await timedQuery(()=>client.query("SELECT id FROM documents WHERE user_id=$1 AND file_hash=$2 AND status='ready'",[userId,hash]));
 if(duplicate.rows.length)throw new DocumentError('DUPLICATE_DOCUMENT','An identical active document already exists.',409,String(duplicate.rows[0].id));
 let text:string;
 try{text=await measure('parse-document',()=>deps.parse(buffer,extension));}catch{throw new DocumentError('INVALID_CONTENT','Could not parse this PDF or DOCX document.',422);}
 const chunks=chunkText(text);
 if(!chunks.length)throw new DocumentError('EMPTY_DOCUMENT','No readable text found in document.',422);
 const embeddings:number[][]=[];
 for(const chunk of chunks){signal.throwIfAborted();embeddings.push(await deps.embed(chunk,signal));}
 signal.throwIfAborted();
 savedPath=await measure('file-storage',()=>deps.save(buffer,extension));
 const inserted=await timedQuery(()=>client.query("INSERT INTO documents(user_id,filename,file_path,file_hash,status,version,replaces_document_id) VALUES($1,$2,$3,$4,'processing',$5,$6) RETURNING id",[userId,filename,savedPath,hash,(previous?.version??0)+1,previous?.id??null]));
 const id=String(inserted.rows[0].id);
 for(let i=0;i<chunks.length;i++)await timedQuery(()=>client.query('INSERT INTO document_chunks(document_id,chunk_index,chunk_text,embedding) VALUES($1,$2,$3,$4::vector)',[id,i,chunks[i],JSON.stringify(embeddings[i])]));
 if(previous){
   retiredId=String(previous.id);
   await timedQuery(()=>client.query("UPDATE documents SET status='superseded',retired_at=now() WHERE id=$1 AND user_id=$2",[previous.id,userId]));
   await timedQuery(()=>client.query('DELETE FROM document_chunks WHERE document_id=$1',[previous.id]));
   await timedQuery(()=>client.query('INSERT INTO document_file_cleanup(document_id) VALUES($1)',[previous.id]));
 }
 signal.throwIfAborted();
 await timedQuery(()=>client.query("UPDATE documents SET status='ready' WHERE id=$1 AND user_id=$2",[id,userId]));
 await timedQuery(()=>client.query('INSERT INTO document_events(document_id,user_id,action,related_document_id) VALUES($1,$2,$3,$4)',[id,userId,previous?'replaced':'uploaded',previous?.id??null]));
 commitAttempted=true;
 await timedQuery(()=>client.query('COMMIT'));committed=true;
 // Never remove a newly published file on an error after commit.
 return {documentId:id,totalChunks:chunks.length,version:(previous?.version??0)+1,replacesDocumentId:retiredId};
 }catch(error){
 if(!committed) {
   try{await timedQuery(()=>client.query('ROLLBACK'));}finally{if(savedPath&&!commitAttempted)try{await deps.remove(savedPath);}catch{/* Unpublished UUID file; documented orphan maintenance requirement. */}}
 }
 if((error as {code?:string}).code==='55P03')throw new DocumentError('DOCUMENT_BUSY','Another document operation is in progress. Please retry.',503);
 if((error as {code?:string;constraint?:string}).code==='23505' && (error as {constraint?:string}).constraint==='documents_active_owner_hash_idx')throw new DocumentError('DUPLICATE_DOCUMENT','An identical active document already exists.',409);
 throw error;
 }finally{client.release(!committed);}
}

export async function deleteDocument(id:string) {
 const userId=requireUserId();documentId(id);
 const client=await pool.connect();
 try {
 await timedQuery(()=>client.query('BEGIN'));
 await timedQuery(()=>client.query("SET LOCAL lock_timeout = '5s'"));await timedQuery(()=>client.query("SET LOCAL statement_timeout = '10s'"));
 await timedQuery(()=>client.query("SELECT pg_advisory_xact_lock(hashtextextended('document-owner:' || $1::text,782001))",[userId]));
 const owned=await timedQuery(()=>client.query('SELECT status FROM documents WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId]));
 if(!owned.rows.length)throw new DocumentError('DOCUMENT_NOT_FOUND','Document not found.',404);
 const status=owned.rows[0].status;
 if(status!=='deleted') {
   await timedQuery(()=>client.query("UPDATE documents SET status='deleted',deleted_at=now(),retired_at=COALESCE(retired_at,now()) WHERE id=$1 AND user_id=$2",[id,userId]));
   await timedQuery(()=>client.query('DELETE FROM document_chunks WHERE document_id=$1',[id]));
   await timedQuery(()=>client.query('INSERT INTO document_events(document_id,user_id,action) VALUES($1,$2,\'deleted\')',[id,userId]));
   await timedQuery(()=>client.query('INSERT INTO document_file_cleanup(document_id) VALUES($1) ON CONFLICT DO NOTHING',[id]));
 }
 await timedQuery(()=>client.query('COMMIT'));
 return {documentId:id,deleted:true};
 }catch(error){await timedQuery(()=>client.query('ROLLBACK'));if((error as {code?:string}).code==='55P03')throw new DocumentError('DOCUMENT_BUSY','Another document operation is in progress. Please retry.',503);throw error;}finally{client.release();}
}

export async function cleanupDocumentFiles(id?:string,remove=removeDocumentFile) {
 const userId=requireUserId();if(id)documentId(id);
 const client=await pool.connect();let removed=0;let pending=0;
 try {
 await timedQuery(()=>client.query('BEGIN'));await timedQuery(()=>client.query("SET LOCAL statement_timeout = '10s'"));
 const jobs=await timedQuery(()=>client.query("SELECT q.document_id,d.file_path FROM document_file_cleanup q JOIN documents d ON d.id=q.document_id WHERE d.user_id=$1 AND d.status IN ('deleted','superseded') AND ($2::bigint IS NULL OR d.id=$2) ORDER BY q.queued_at LIMIT 100 FOR UPDATE OF q SKIP LOCKED",[userId,id??null]));
 for(const job of jobs.rows){
   try{await remove(job.file_path);await timedQuery(()=>client.query('DELETE FROM document_file_cleanup WHERE document_id=$1',[job.document_id]));removed++;}
   catch{await timedQuery(()=>client.query('UPDATE document_file_cleanup SET attempts=attempts+1,last_attempt_at=now() WHERE document_id=$1',[job.document_id]));pending++;}
 }
 await timedQuery(()=>client.query('COMMIT'));return {removed,pending};
 }catch(error){await timedQuery(()=>client.query('ROLLBACK'));throw error;}finally{client.release();}
}
export async function attemptCleanup(id:string) {
 try{await cleanupDocumentFiles(id);const remaining=await timedQuery(()=>pool.query('SELECT 1 FROM document_file_cleanup q JOIN documents d ON d.id=q.document_id WHERE q.document_id=$1 AND d.user_id=$2',[id,requireUserId()]));return remaining.rows.length>0;}catch{return true;}
}

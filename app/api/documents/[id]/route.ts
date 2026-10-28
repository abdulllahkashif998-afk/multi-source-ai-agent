import { authenticated } from '@/src/lib/auth';
import { ingestDocument, deleteDocument, attemptCleanup, requireUserId, documentId } from '@/src/lib/document-lifecycle';
import { readDocumentUpload, documentFailure } from '@/src/lib/document-http';
type Context={params:Promise<{id:string}>};
async function handlePUT(request:Request,context:Context) {
 try {
 requireUserId();const id=documentId((await context.params).id);
 const file=await readDocumentUpload(request);
 const result=await ingestDocument(file.name,Buffer.from(await file.arrayBuffer()),AbortSignal.any([request.signal,AbortSignal.timeout(120_000)]),id);
 const cleanupPending=result.replacesDocumentId?await attemptCleanup(result.replacesDocumentId):false;
 return Response.json({success:true,...result,cleanupPending},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return documentFailure(error);}
}
async function handleDELETE(_request:Request,context:Context) {
 try {
 requireUserId();const id=documentId((await context.params).id);
 const result=await deleteDocument(id);
 const cleanupPending=await attemptCleanup(id);
 return Response.json({success:true,...result,cleanupPending},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return documentFailure(error);}
}

export const PUT=authenticated(handlePUT);

export const DELETE=authenticated(handleDELETE);

import { authenticated } from '@/src/lib/auth';
import { cleanupDocumentFiles, requireUserId } from '@/src/lib/document-lifecycle';
import { documentFailure } from '@/src/lib/document-http';
async function handlePOST() {
 try {requireUserId();return Response.json({success:true,...await cleanupDocumentFiles()},{headers:{'Cache-Control':'no-store'}});}
 catch(error){return documentFailure(error);}
}

export const POST=authenticated(handlePOST);

import { logEvent } from './reliability';
import { ChatError } from './chat-errors';
import { DocumentError, requireUserId } from './document-lifecycle';
export async function readDocumentUpload(request:Request) {
 requireUserId();
 let form:FormData;
 try{form=await request.formData();}catch{throw new DocumentError('INVALID_REQUEST','Provide a multipart file upload.',400);}
 const file=form.get('file');
 if(!(file instanceof File))throw new DocumentError('INVALID_FILE','Provide a file.',400);
 if(!file.size||file.size>10*1024*1024)throw new DocumentError('INVALID_FILE','File must be between 1 byte and 10 MiB.',400);
 return file;
}
export function documentFailure(error:unknown) {
 logEvent('ingestion',performance.now(),'error',undefined,error);
 if(error instanceof ChatError)return Response.json({success:false,code:error.code,error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
 const timeout=error instanceof Error && ['AbortError','TimeoutError'].includes(error.name);
 return Response.json({success:false,code:error instanceof DocumentError?error.code:timeout?'DOCUMENT_TIMEOUT':'DOCUMENT_FAILED',error:error instanceof DocumentError?error.message:timeout?'Document operation timed out.':'Document operation failed.',...(error instanceof DocumentError&&error.existingDocumentId?{existingDocumentId:error.existingDocumentId}:{})},{status:error instanceof DocumentError?error.status:timeout?504:500,headers:{'Cache-Control':'no-store'}});
}

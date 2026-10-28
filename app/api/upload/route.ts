import { authenticated } from '@/src/lib/auth';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { importCSV } from '@/src/lib/import-csv';
import { storeDocument } from '@/src/lib/store-document';
import { readDocumentUpload, documentFailure } from '@/src/lib/document-http';
async function handlePOST(request:Request) {
 let csvPath:string|undefined;
 try {
 const file=await readDocumentUpload(request);
 const buffer=Buffer.from(await file.arrayBuffer());
 if(path.extname(file.name).toLowerCase()==='.csv') {
   // Preserve the legacy CSV importer; generic CSV APIs are unchanged.
   const root=path.join(process.cwd(),'storage','uploads');await mkdir(root,{recursive:true});
   csvPath=path.join(root,randomUUID()+'.csv');await writeFile(csvPath,buffer,{flag:'wx'});
   const result=await importCSV(file.name,buffer.toString('utf8'));
   return Response.json({success:true,message:'CSV imported successfully',...result});
 }
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(120_000)]);
 const result=await storeDocument(file.name,buffer,signal);
 return Response.json({success:true,message:'Document processed and stored successfully',...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){if(csvPath)try{await unlink(csvPath);}catch{}return documentFailure(error);}
}

export const POST=authenticated(handlePOST);

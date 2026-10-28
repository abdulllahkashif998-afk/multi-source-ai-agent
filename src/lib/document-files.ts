import { mkdir, open, unlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export const uploadRoot = () => path.resolve(process.cwd(), 'storage', 'uploads');
async function verifiedRoot() {
 const root=uploadRoot();
 await mkdir(root,{recursive:true,mode:0o700});
 if(await realpath(root)!==root) throw new Error('Storage root must not be a symlink');
 return root;
}
export async function saveDocumentFile(buffer: Buffer, extension: string) {
 if(!['.pdf','.docx'].includes(extension)) throw new Error('Invalid extension');
 const root=await verifiedRoot();
 const filePath=path.join(root,randomUUID()+extension);
 const handle=await open(filePath,'wx',0o600);
 try{await handle.writeFile(buffer);}catch(error){await handle.close();try{await unlink(filePath);}catch{}throw error;}
 await handle.close();
 return filePath;
}
export async function removeDocumentFile(filePath: string) {
 const root=await verifiedRoot();
 const resolved=path.resolve(filePath);
 if(path.dirname(resolved)!==root || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx)$/i.test(path.basename(resolved))) throw new Error('Unsafe stored path');
 try {await unlink(resolved);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error;}
}

import {mkdir,readFile,writeFile,rename,rm,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ChatError} from './chat-errors';
import {emptyQuotaState,type QuotaStore} from './groq-quota';
const number=z.number().finite().nonnegative();
const stateSchema=z.object({version:z.literal(1),lastNow:number,blockedUntil:number,entries:z.array(z.object({id:z.string().uuid(),at:number,tokenAt:number,reserved:number.int(),charged:number.int().nullable(),pending:z.boolean()})).max(2000),remoteTokens:z.object({remaining:number,until:number}).optional(),remoteRequests:z.object({remaining:number,until:number}).optional()}).strict();
const unavailable=()=>new ChatError('PROVIDER_QUOTA_UNAVAILABLE','The answer service quota ledger is unavailable. Please contact the operator.',503);
// Same-host, same-directory coordination only. No user data, API keys or prompts.
export function fileQuotaStore(directory:string):QuotaStore{
 const root=path.resolve(directory),lock=path.join(root,'ledger.lock'),file=path.join(root,'ledger.json'),marker=path.join(root,'initialized');
 return {async transact(work,signal){
  signal?.throwIfAborted();let held=false;
  try{
   await mkdir(root,{recursive:true,mode:0o700});const info=await lstat(root);if(await realpath(root)!==root||!info.isDirectory()||(info.mode&0o077)!==0||(process.getuid&&info.uid!==process.getuid())||root===path.resolve('.')||['public','.next','out'].some(name=>root===path.resolve(name)||root.startsWith(path.resolve(name)+path.sep)))throw unavailable();
   const start=Date.now();
   while(!held){
    signal?.throwIfAborted();try{await mkdir(lock,{mode:0o700});held=true;await writeFile(path.join(lock,'owner'),String(process.pid),{flag:'wx',mode:0o600});}
    catch(error){if(held)throw error;if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
     // Never steal an uncertain lock (including after a crash). Operators may
     // remove a stranded lock only with all workers stopped. Fail closed.
     const lockInfo=await lstat(lock);if(lockInfo.isSymbolicLink()||!lockInfo.isDirectory())throw unavailable();
     if(Date.now()-start>1000)throw unavailable();
     await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(signal?.reason);};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},10);signal?.addEventListener('abort',abort,{once:true});});
    }
   }
   let state=emptyQuotaState();try{const info=await lstat(file);if(info.isSymbolicLink()||info.size>2_000_000)throw unavailable();state=stateSchema.parse(JSON.parse(await readFile(file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;try{await lstat(marker);throw unavailable();}catch(missing){if((missing as NodeJS.ErrnoException).code!=='ENOENT')throw missing;}}
   signal?.throwIfAborted();const result=work(state),tmp=path.join(root,randomUUID()+'.tmp');
   try{await writeFile(tmp,JSON.stringify(state),{flag:'wx',mode:0o600});await rename(tmp,file);try{await writeFile(marker,'v1',{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}}finally{await rm(tmp,{force:true});}
   return result;
  }catch(error){if(signal?.aborted)throw signal.reason;if(error instanceof ChatError)throw error;throw unavailable();}
  finally{if(held)await rm(lock,{recursive:true,force:true});}
 }};
}

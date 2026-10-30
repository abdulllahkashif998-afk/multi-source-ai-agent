import path from 'node:path';
import {fileQuotaStore} from './groq-quota-store';
import {createGroqQuota,RateLimitError} from './groq-quota';
import {logEvent} from './reliability';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createProviderTransport } from './provider-transport';
export function createGroqTransport(options:Omit<Parameters<typeof createProviderTransport>[0],'provider'>) {
 return createProviderTransport({...options,provider:'groq'});
}
const shared=globalThis as typeof globalThis & {knowledgeGroqTransport?:{rpm:number;directory:string;revision?:string;fetch:typeof fetch}};
const override=new AsyncLocalStorage<typeof fetch>();
export function withGroqTransport<T>(transport:typeof fetch,work:()=>T):T {return override.run(transport,work);}
export const groqFetch:typeof fetch=async(input,init)=>{
 try {
 const injected=override.getStore();if(injected)return await injected(input,init);
 const rpm=Number(process.env.GROQ_REQUESTS_PER_MINUTE??'12');
 const directory=path.resolve(process.env.GROQ_QUOTA_DIRECTORY?.trim()||'storage/groq-quota');
 if(!shared.knowledgeGroqTransport||shared.knowledgeGroqTransport.revision!=='admission-wait-v1'||shared.knowledgeGroqTransport.rpm!==rpm||shared.knowledgeGroqTransport.directory!==directory)shared.knowledgeGroqTransport={rpm,directory,revision:'admission-wait-v1',fetch:createGroqTransport({rpm,quota:createGroqQuota(fileQuotaStore(directory))})};
 return await shared.knowledgeGroqTransport.fetch(input,init);
 }catch(error){
  // The process-global transport survives Next development reloads. Recreate
  // only its allowlisted quota error in this module generation: old Error
  // constructors fail the route's instanceof check. Never forward raw messages.
  if(error instanceof RateLimitError)throw error;
  const e=error as Partial<RateLimitError>|null;
  if(e?.code==='PROVIDER_RATE_LIMITED'&&e.status===429&&
    (e.rateLimitOrigin==='local'||e.rateLimitOrigin==='provider')&&
    ['rpm','tpm','rpd','tpd','queue','provider_429','request_size','cooldown'].includes(e.quotaReason??'')){
   const normalized=new RateLimitError(e.rateLimitOrigin,e.quotaReason!,Number.isSafeInteger(e.retryAfterSeconds)&&e.retryAfterSeconds!>0&&e.retryAfterSeconds!<=172800?e.retryAfterSeconds:undefined);
   logEvent('groq-pacing',performance.now(),'rejected',undefined,normalized);
   throw normalized;
  }
  throw error;
 }
};

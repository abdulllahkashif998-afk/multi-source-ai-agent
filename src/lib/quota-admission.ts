import {RateLimitError,type GroqQuota} from './groq-quota';
// reserve() makes the decision atomically in the shared store. No lock or
// reservation is held across sleeps. Pending work may settle earlier than its
// conservative expiry, so recheck at most once a second while it is present.
export async function reserveBeforeDeadline(quota:GroqQuota,tokens:number,options:{deadline:number;signal:AbortSignal;now:()=>number;sleep:(ms:number,signal?:AbortSignal)=>Promise<void>}){
 let last:RateLimitError|undefined;
 while(true){
  options.signal.throwIfAborted();
  if(options.now()>=options.deadline)throw last??new RateLimitError('local','queue');
  try{const id=await quota.reserve(tokens,options.signal);if(options.now()>=options.deadline){await quota.settle(id,null,undefined,false,AbortSignal.timeout(1000));throw last??new RateLimitError('local','queue');}return id;}
  catch(error){
   if(!(error instanceof RateLimitError)||error.rateLimitOrigin!=='local')throw error;
   last=error;const info=error.admission;
   if(info?.dailyReason)throw new RateLimitError('local',info.dailyReason,error.retryAfterSeconds,info);
   if(!info||!['tpm','rpm','cooldown'].includes(error.quotaReason))throw error;
   const now=options.now(),delay=info.pending?Math.min(1000,Math.max(25,info.retryAt-now)):Math.max(1,info.retryAt-now);
   if(now+delay>=options.deadline)throw error;
   await options.sleep(delay,options.signal);
  }
 }
}

import {reserveBeforeDeadline} from './quota-admission';
import {providerDeadline} from './provider-deadline';
import { ChatError } from './chat-errors';
import {RateLimitError,estimateGroqTokens,type GroqQuota} from './groq-quota';
import {providerUsage} from './provider-usage';
import {abortable} from './agent-budget';
import { logEvent, requestContext } from './reliability';

type Clock={now:()=>number;sleep:(ms:number,signal?:AbortSignal)=>Promise<void>};
const clock:Clock={now:Date.now,sleep:(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(signal.reason);return;}
 const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 signal?.addEventListener('abort',abort,{once:true});
})};
function limited(origin:'local'|'provider'='local',seconds?:number){return new RateLimitError(origin,origin==='local'?'queue':'provider_429',seconds);}
// Recognize only the confirmed provider denial. Never log/forward its raw body.
async function billingRequired(response:Response) {
 if(response.status!==403)return false;
 const reader=response.clone().body?.getReader();if(!reader)return false;
 const chunks:Uint8Array[]=[];let size=0;
 try{
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){void reader.cancel().catch(()=>{});return false;}chunks.push(value);}
 const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 return data?.error?.code===403&&data?.error?.status==='PERMISSION_DENIED'&&typeof data?.error?.message==='string'&&data.error.message.startsWith('The Gemini API free tier is not available for this project.');
 }catch{return false;}finally{reader.releaseLock();}
}
export function createProviderTransport(options:{provider:'gemini'|'groq';rpm:number;clock?:Clock;fetch?:typeof fetch;quota?:GroqQuota}) {
 if(!Number.isInteger(options.rpm)||options.rpm<1||options.rpm>=(options.provider==='gemini'?15:30))throw new ChatError('CHAT_NOT_CONFIGURED','Invalid server rate-limit configuration.',503);
 const timing=options.clock??clock;
 let next=0,queued=0;
 async function pace(signal:AbortSignal|undefined,deadline:number,prepare:()=>Promise<string|undefined>,release:()=>Promise<void>,work:()=>Promise<Response>) {
 const start=performance.now();
 const queueDeadline=options.quota?deadline-10_000:Math.min(deadline-1000,timing.now()+10_000);
 try{
 while(true){
 signal?.throwIfAborted();
 const delay=Math.max(0,next-timing.now());
 if(timing.now()+delay>=queueDeadline)throw limited('local',Math.max(1,Math.ceil(delay/1000)));
 if(delay){await timing.sleep(delay,signal);continue;}
 if(options.quota)await prepare();
 signal?.throwIfAborted();
 // Another caller can claim spacing while atomic ledger admission completes.
 // Release known-unsent quota before waiting again; never sleep holding it.
 if(next>timing.now()){await release();continue;}
 // This synchronous claim has no await: concurrent callers cannot start together.
 next=timing.now()+60_000/options.rpm;
 logEvent(`${options.provider}-pacing`,start);return await work();
 }
 }catch(error){logEvent(`${options.provider}-pacing`,start,'rejected',undefined,error);throw error;}
 }
 return (async(input,init)=>{
 init?.signal?.throwIfAborted();
 if(queued>=8){const error=limited();logEvent(`${options.provider}-pacing`,performance.now(),'rejected',undefined,error);throw error;}
 queued++;
 try{
 const phaseRemaining=(providerDeadline()??Infinity)-Date.now();
 // Phase scopes use wall time; translate their remaining budget into the
 // pacing clock while retaining the existing request-context deadline bound.
 const deadline=Math.min(requestContext()?.deadline??Infinity,timing.now()+phaseRemaining,timing.now()+30_000);
 const timeout=AbortSignal.timeout(Math.max(1,Math.ceil(deadline-timing.now())));
 const signal=init?.signal?AbortSignal.any([init.signal,timeout]):timeout;
 for(let attempt=0;attempt<2;attempt++){
 let start:number|undefined,id:string|undefined;
 const reserved=options.quota?estimateGroqTokens(init?.body):0;
 let response:Response,sent=false,settled=false,recorded=false;
 try{
  response=await pace(signal,deadline,async()=>{
   const admissionStart=performance.now();
   id=options.quota?await reserveBeforeDeadline(options.quota,reserved,{deadline:deadline-10_000,signal,now:timing.now,sleep:timing.sleep}):undefined;if(options.quota)logEvent('groq-admission',admissionStart);return id;
  },async()=>{if(id)await options.quota!.settle(id,null,undefined,false,AbortSignal.timeout(1000));id=undefined;},async()=>{
   signal.throwIfAborted();sent=true;start=performance.now();
   const pending=(options.fetch??globalThis.fetch)(input,{...init,signal});
   // Observe rejection even if dispatch synchronously aborts the signal before
   // abortable can attach its handlers (including injected test transports).
   void pending.catch(()=>{});
   const result=await abortable(()=>pending,signal);
   let usage:number|null=null;
   if(options.quota){
    const copy=result.clone(),reader=copy.body?.getReader();let text='',size=0;
    try{if(reader){const decoder=new TextDecoder();while(true){const next=await abortable(()=>reader.read(),signal);if(next.done){text+=decoder.decode();break;}size+=next.value.length;if(size>1_000_000)break;text+=decoder.decode(next.value,{stream:true});}if(size<=1_000_000){const u=JSON.parse(text).usage?.total_tokens;if(Number.isSafeInteger(u)&&u>=0)usage=u;}}}catch{signal.throwIfAborted();}finally{void reader?.cancel().catch(()=>{});}
    await options.quota.settle(id!,usage,result.headers,true,signal);settled=true;
   }
   providerUsage(options.provider,reserved,usage,result.status);recorded=true;
   return result;
  });logEvent(`${options.provider}-http`,start!,response.ok?'ok':'error',undefined,response.ok?undefined:{name:'Error',status:response.status});
 }catch(error){
  if(id&&!settled)await options.quota!.settle(id,null,undefined,sent,sent?signal:AbortSignal.timeout(1000)).catch(()=>{});
  if(sent&&!recorded)providerUsage(options.provider,reserved,null);
  if(start!==undefined)logEvent(`${options.provider}-http`,start,'error',undefined,error);
  else logEvent(`${options.provider}-pacing`,performance.now(),'rejected',undefined,error);
  if(attempt>0&&error instanceof RateLimitError)throw limited('provider',error.retryAfterSeconds);throw error;
 }
 if(options.provider==='gemini'&&await billingRequired(response))throw new ChatError('PROVIDER_BILLING_REQUIRED','The answer service is unavailable because its Gemini project requires billing. Contact the workspace operator.',503);
 if(response.status!==429)return response;
 const raw=response.headers.get('retry-after');
 const seconds=raw===null?NaN:Number(raw);
 const delay=raw===null?1000:Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(raw)-timing.now());
 // Apply provider cooldown to other requests as well; never retry earlier.
 const wait=Number.isFinite(delay)?delay:1000;
 next=Math.max(next,timing.now()+wait);
 if(options.quota)await options.quota.cooldown(next,signal);
 await response.body?.cancel();
 if(response.headers.get('x-ratelimit-remaining-tokens')==='0'||response.headers.get('x-ratelimit-remaining-requests')==='0'||attempt===1||wait>10_000||timing.now()+Math.max(wait,next-timing.now())+1000>=deadline)throw limited('provider',Math.max(1,Math.ceil(Math.max(wait,next-timing.now())/1000)));
 logEvent(`${options.provider}-retry`,performance.now(),'retry');
 // Honor cooldown before reserving the next attempt; admission must not
 // reject its own scheduled short recovery as an early dispatch.
 await timing.sleep(Math.max(0,next-timing.now()),signal);
 }
 throw limited('provider');
 }finally{queued--;}
 }) as typeof fetch;
}

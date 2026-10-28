import { ChatError } from './chat-errors';
import { logEvent, requestContext } from './reliability';

type Clock={now:()=>number;sleep:(ms:number,signal?:AbortSignal)=>Promise<void>};
const clock:Clock={now:Date.now,sleep:(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(signal.reason);return;}
 const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 signal?.addEventListener('abort',abort,{once:true});
})};
function limited(){return new ChatError('PROVIDER_RATE_LIMITED','The answer service is busy. Please retry shortly.',429);}
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
export function createProviderTransport(options:{provider:'gemini'|'groq';rpm:number;clock?:Clock;fetch?:typeof fetch}) {
 if(!Number.isInteger(options.rpm)||options.rpm<1||options.rpm>=(options.provider==='gemini'?15:30))throw new ChatError('CHAT_NOT_CONFIGURED','Invalid server rate-limit configuration.',503);
 const timing=options.clock??clock;
 let next=0,queued=0;
 async function pace(signal:AbortSignal|undefined,deadline:number,work:()=>Promise<Response>) {
 if(queued>=8)throw limited();
 queued++;
 const start=performance.now(),queueDeadline=Math.min(deadline-1000,timing.now()+10_000);
 try{
 while(true){
 signal?.throwIfAborted();
 const delay=Math.max(0,next-timing.now());
 if(timing.now()+delay>=queueDeadline)throw limited();
 if(delay){await timing.sleep(delay,signal);continue;}
 // This synchronous claim has no await: concurrent callers cannot start together.
 next=timing.now()+60_000/options.rpm;
 logEvent(`${options.provider}-pacing`,start);return work();
 }
 }catch(error){logEvent(`${options.provider}-pacing`,start,'rejected',undefined,error);throw error;}finally{queued--;}
 }
 return (async(input,init)=>{
 const deadline=Math.min(requestContext()?.deadline??Infinity,timing.now()+30_000);
 const timeout=AbortSignal.timeout(Math.max(1,Math.ceil(deadline-timing.now())));
 const signal=init?.signal?AbortSignal.any([init.signal,timeout]):timeout;
 for(let attempt=0;attempt<2;attempt++){
 let start=0;
 let response:Response;
 try{response=await pace(signal,deadline,()=>{start=performance.now();return (options.fetch??globalThis.fetch)(input,{...init,signal});});logEvent(`${options.provider}-http`,start,response.ok?'ok':'error',undefined,response.ok?undefined:{name:'Error',status:response.status});}
 catch(error){if(start)logEvent(`${options.provider}-http`,start,'error',undefined,error);throw error;}
 if(options.provider==='gemini'&&await billingRequired(response))throw new ChatError('PROVIDER_BILLING_REQUIRED','The answer service is unavailable because its Gemini project requires billing. Contact the workspace operator.',503);
 if(response.status!==429)return response;
 const raw=response.headers.get('retry-after');
 const seconds=raw===null?NaN:Number(raw);
 const delay=raw===null?1000:Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(raw)-timing.now());
 // Apply provider cooldown to other requests as well; never retry earlier.
 const wait=Number.isFinite(delay)?delay:1000;
 next=Math.max(next,timing.now()+wait);
 await response.body?.cancel();
 if(attempt===1||wait>10_000||timing.now()+Math.max(wait,next-timing.now())+1000>=deadline)throw limited();
 logEvent(`${options.provider}-retry`,performance.now(),'retry');
 }
 throw limited();
 }) as typeof fetch;
}

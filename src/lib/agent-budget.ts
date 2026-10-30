import {requestContext} from './reliability';

export const AGENT_TOTAL_MS=60_000;
export const AGENT_STEP_MS=30_000;
export const AGENT_FINAL_RESERVE_MS=15_000;
export function createAgentBudget(parent:AbortSignal,now=Date.now()){
 const deadline=Math.min(now+AGENT_TOTAL_MS,requestContext()?.deadline??Infinity);
 const remaining=Math.max(0,Math.floor(deadline-now));
 const timeout=(ms:number)=>ms>0?AbortSignal.timeout(ms):AbortSignal.abort(new DOMException('Agent deadline exhausted','TimeoutError'));
 const signal=AbortSignal.any([parent,timeout(remaining)]);
 const planningSignal=AbortSignal.any([signal,timeout(remaining-AGENT_FINAL_RESERVE_MS)]);
 return {deadline,planningDeadline:deadline-AGENT_FINAL_RESERVE_MS,signal,planningSignal};
}
// Stop waiting promptly even when an underlying service only supports bounded
// cooperative cleanup. Its promise is still observed; no late evidence is added.
export function abortable<T>(work:()=>Promise<T>,signal:AbortSignal):Promise<T>{
 signal.throwIfAborted();
 return new Promise<T>((resolve,reject)=>{
  const abort=()=>reject(signal.reason);
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve().then(()=>{signal.throwIfAborted();return work();}).then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)reject(signal.reason);else resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
 });
}

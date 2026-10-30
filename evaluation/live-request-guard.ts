import {writeFile} from 'node:fs/promises';
import {ChatError} from '../src/lib/chat-errors';
export interface LiveAttempt {status:number|null;inputBytes:number;promptTokens:number|null;completionTokens:number|null;totalTokens:number|null;durationMs:number;quota?:{requestsPerDay:number|null;remainingRequestsToday:number|null;tokensPerMinute:number|null;remainingTokensThisMinute:number|null}}
export interface LiveLedger {attempts:LiveAttempt[];stopReason:string|null}
export async function initializeLiveLedger(filename:string){
 await writeFile(filename,JSON.stringify({attempts:[],stopReason:null})+'\n',{mode:0o600,flag:'wx'});
}
// Evaluation-only: production transport/model options are never changed.
export function guardedLiveFetch(options:{fetch:typeof fetch;ollamaOrigin:string;maxAttempts:number;tokenAllowance:number;ledger:LiveLedger;save:()=>Promise<void>}) : typeof fetch {
 if(!Number.isInteger(options.maxAttempts)||options.maxAttempts<1||options.maxAttempts>161||!Number.isFinite(options.tokenAllowance)||options.tokenAllowance<1)throw Error('Invalid evaluation budget');
 const ledger=options.ledger;
 return async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input:input.url);
  if(url.origin===options.ollamaOrigin&&['/api/embed','/api/tags'].includes(url.pathname))return options.fetch(input,init);
  if(url.origin!=='https://api.groq.com'||url.pathname!=='/openai/v1/chat/completions')throw Error('Evaluation blocked unexpected endpoint');
  const inputBytes=typeof init?.body==='string'?Buffer.byteLength(init.body):0;
  if(!inputBytes)throw Error('Evaluation requires inspectable JSON request size');
  // Bytes + existing output cap + overhead is a conservative planning estimate,
  // not a tokenizer or a claim of exact billable quota consumption.
  const used=ledger.attempts.reduce((n,a)=>n+(a.totalTokens??a.inputBytes+4024),0);
  if(ledger.stopReason||ledger.attempts.length>=options.maxAttempts||used+inputBytes+4024>options.tokenAllowance){ledger.stopReason??='approved_budget_exhausted';await options.save();throw new ChatError('PROVIDER_RATE_LIMITED','Evaluation budget exhausted.',429);}
  const attempt:LiveAttempt={status:null,inputBytes,promptTokens:null,completionTokens:null,totalTokens:null,durationMs:0};ledger.attempts.push(attempt);await options.save();
  const start=performance.now();
  try{
   const response=await options.fetch(input,{...init,redirect:'error'});attempt.status=response.status;
   const numericHeader=(name:string)=>{const raw=response.headers.get(name);if(raw===null||!/^\d+$/.test(raw))return null;const value=Number(raw);return Number.isSafeInteger(value)?value:null;};
   attempt.quota={requestsPerDay:numericHeader('x-ratelimit-limit-requests'),remainingRequestsToday:numericHeader('x-ratelimit-remaining-requests'),tokensPerMinute:numericHeader('x-ratelimit-limit-tokens'),remainingTokensThisMinute:numericHeader('x-ratelimit-remaining-tokens')};
   if(response.ok){try{const data=await response.clone().json();for(const [field,key] of [['promptTokens','prompt_tokens'],['completionTokens','completion_tokens'],['totalTokens','total_tokens']] as const){const v=data?.usage?.[key];if(Number.isSafeInteger(v)&&v>=0)attempt[field]=v;}}catch{/* Usage unavailable is null, not zero. */}}
   if(attempt.quota?.remainingRequestsToday===0)ledger.stopReason='provider_daily_request_quota_exhausted';
   if(attempt.quota?.remainingTokensThisMinute===0)ledger.stopReason??='provider_minute_token_quota_exhausted';
   if([401,403,429].includes(response.status))ledger.stopReason=`provider_http_${response.status}`;
   if(response.status===429){await response.body?.cancel();throw new ChatError('PROVIDER_RATE_LIMITED','Evaluation stopped after provider rate limit; no retry.',429);}
   return response;
  }finally{attempt.durationMs=performance.now()-start;await options.save();}
 };
}

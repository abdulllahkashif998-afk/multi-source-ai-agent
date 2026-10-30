import {randomUUID} from 'node:crypto';
import {encode} from 'gpt-tokenizer/encoding/o200k_harmony';
import {ChatError} from './chat-errors';
export const GROQ_LIMITS:Readonly<{rpm:number;tpm:number;rpd:number;tpd:number}>=Object.freeze({rpm:30,tpm:8000,rpd:1000,tpd:200000});
export interface AdmissionDetails {observedAt:number;retryAt:number;pending:boolean;dailyReason?:'rpd'|'tpd';requestedTokens:number;minuteTokens:number;dayTokens:number;minuteRequests:number;dayRequests:number;remoteTokensRemaining?:number}
export class RateLimitError extends ChatError{
 constructor(public readonly rateLimitOrigin:'local'|'provider',public readonly quotaReason:'rpm'|'tpm'|'rpd'|'tpd'|'queue'|'provider_429'|'request_size'|'cooldown',public readonly retryAfterSeconds?:number,public readonly admission?:AdmissionDetails){
  super('PROVIDER_RATE_LIMITED',quotaReason==='rpd'||quotaReason==='tpd'?'The answer service daily quota is exhausted. Please retry after the quota resets.':quotaReason==='request_size'?'This model request exceeds the configured token budget. Please simplify the question.':'The answer service is busy. Please retry shortly.',429);
 }
}
export type QuotaEntry={id:string;at:number;tokenAt:number;reserved:number;charged:number|null;pending:boolean};
export type QuotaState={version:1;lastNow:number;blockedUntil:number;entries:QuotaEntry[];remoteTokens?:{remaining:number;until:number};remoteRequests?:{remaining:number;until:number}};
export const emptyQuotaState=():QuotaState=>({version:1,lastNow:0,blockedUntil:0,entries:[]});
export interface QuotaStore{transact<T>(work:(state:QuotaState)=>T,signal?:AbortSignal):Promise<T>}
export function memoryQuotaStore():QuotaStore{
 const state=emptyQuotaState();let tail=Promise.resolve();
 return {async transact(work,signal){let release!:()=>void;const previous=tail;tail=new Promise<void>(r=>release=r);await previous;try{signal?.throwIfAborted();return work(state);}finally{release();}}};
}
export function estimateGroqTokens(body:unknown){
 if(typeof body!=='string'||Buffer.byteLength(body)>2_000_000)throw new ChatError('PROVIDER_QUOTA_UNAVAILABLE','The answer service cannot safely admit this request.',503);
 let parsed;try{parsed=JSON.parse(body);}catch{throw new ChatError('PROVIDER_QUOTA_UNAVAILABLE','The answer service cannot safely admit this request.',503);}
 if(!parsed||typeof parsed!=='object')throw new ChatError('PROVIDER_QUOTA_UNAVAILABLE','The answer service cannot safely admit this request.',503);
 const output=parsed.max_completion_tokens??parsed.max_tokens??3000;
 if(!Number.isSafeInteger(output)||output<1||output>3000)throw new RateLimitError('local','request_size');
 // Encode the complete wire JSON (including tools) plus conservative framing.
 // Groq's undisclosed server-side formatting can differ; reconcile actual usage.
 return encode(body,{disallowedSpecial:new Set()}).length+256+32*(Array.isArray(parsed.messages)?parsed.messages.length:0)+output;
}
function normalize(s:QuotaState,time:number){
 const now=Math.max(time,s.lastNow);s.lastNow=now;
 for(const e of s.entries)if(e.pending&&now-e.at>=90_000){e.pending=false;e.charged=null;e.tokenAt=e.at+90_000;}
 s.entries=s.entries.filter(e=>e.pending||now-Math.max(e.at,e.tokenAt)<86_400_000);
 if(s.remoteTokens&&now>=s.remoteTokens.until)delete s.remoteTokens;
 if(s.remoteRequests&&now>=s.remoteRequests.until)delete s.remoteRequests;
 return now;
}
function duration(raw:string|null,fallback:number){
 if(!raw)return fallback;const matches=[...raw.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)];
 if(!matches.length||matches.map(m=>m[0]).join('')!==raw)return fallback;
 const ms=matches.reduce((n,m)=>n+Number(m[1])*({ms:1,s:1000,m:60000,h:3600000}[m[2]]!),0);
 return Number.isFinite(ms)?Math.max(fallback,Math.min(ms,86_400_000)):fallback;
}
export function createGroqQuota(store:QuotaStore,now:()=>number=Date.now,limits=GROQ_LIMITS){
 return {
  async reserve(tokens:number,signal?:AbortSignal){return store.transact(s=>{
   const time=normalize(s,now());if(!Number.isSafeInteger(tokens)||tokens<1||tokens>limits.tpm||tokens>limits.tpd)throw new RateLimitError('local','request_size');
   const minute=s.entries.filter(e=>e.pending||time-e.at<60000),day=s.entries.filter(e=>e.pending||time-e.at<86400000);
   const minuteEntries=s.entries.filter(e=>e.pending||time-e.tokenAt<60000),dayEntries=s.entries.filter(e=>e.pending||time-e.tokenAt<86400000);
   const amount=(e:QuotaEntry)=>e.charged??e.reserved;
   const minuteTokens=minuteEntries.reduce((n,e)=>n+amount(e),0),dayTokens=dayEntries.reduce((n,e)=>n+amount(e),0);
   const dailyReason=day.length>=limits.rpd||(s.remoteRequests&&s.remoteRequests.remaining<1)?'rpd' as const:dayTokens+tokens>limits.tpd?'tpd' as const:undefined;
   const reason=time<s.blockedUntil?'cooldown':minute.length>=limits.rpm?'rpm':day.length>=limits.rpd||(s.remoteRequests&&s.remoteRequests.remaining<1)?'rpd':minuteTokens+tokens>limits.tpm||(s.remoteTokens&&s.remoteTokens.remaining<tokens)?'tpm':dayTokens+tokens>limits.tpd?'tpd':undefined;
   if(reason){
    const release=(entries:QuotaEntry[],cap:number,needed:number,token:boolean,window:number)=>{
     let used=entries.reduce((n,e)=>n+(token?amount(e):1),0);if(used+needed<=cap)return time;
     const events=entries.map(e=>({at:token?(e.pending?e.at+90000:e.tokenAt)+window:e.pending&&window===60000?e.at+90000:e.at+window,amount:token?amount(e):1})).sort((a,b)=>a.at-b.at);
     for(const event of events){used-=event.amount;if(used+needed<=cap)return Math.max(time+1,event.at);}
     return time+86400000;
    };
    const retryAt=Math.max(time,s.blockedUntil,
     release(minute,limits.rpm,1,false,60000),release(day,limits.rpd,1,false,86400000),
     release(minuteEntries,limits.tpm,tokens,true,60000),release(dayEntries,limits.tpd,tokens,true,86400000),
     s.remoteTokens&&s.remoteTokens.remaining<tokens?s.remoteTokens.until:time,s.remoteRequests&&s.remoteRequests.remaining<1?s.remoteRequests.until:time);
    const admission:AdmissionDetails={observedAt:time,retryAt,pending:s.entries.some(e=>e.pending),dailyReason,requestedTokens:tokens,minuteTokens,dayTokens,minuteRequests:minute.length,dayRequests:day.length,...(s.remoteTokens?{remoteTokensRemaining:s.remoteTokens.remaining}:{})};
    throw new RateLimitError('local',reason,Math.max(1,Math.ceil((retryAt-time)/1000)),admission);
   }
   const id=randomUUID();s.entries.push({id,at:time,tokenAt:time,reserved:tokens,charged:null,pending:true});
   if(s.remoteTokens)s.remoteTokens.remaining-=tokens;if(s.remoteRequests)s.remoteRequests.remaining--;
   return id;
  },signal);},
  async settle(id:string,usage:number|null,headers?:Headers,sent=true,signal?:AbortSignal){return store.transact(s=>{
   const time=normalize(s,now()),entry=s.entries.find(e=>e.id===id);if(!entry)return;
   if(!sent){s.entries=s.entries.filter(e=>e!==entry);if(s.remoteTokens)s.remoteTokens.remaining+=entry.reserved;if(s.remoteRequests)s.remoteRequests.remaining++;return;}
   const actual=Number.isSafeInteger(usage)&&usage!>=0?usage!:entry.reserved;
   entry.pending=false;entry.charged=usage===null?null:actual;entry.tokenAt=time;
   if(s.remoteTokens)s.remoteTokens.remaining=Math.max(0,s.remoteTokens.remaining+entry.reserved-actual);
   const pendingTokens=s.entries.filter(e=>e.pending).reduce((n,e)=>n+e.reserved,0),pendingRequests=s.entries.filter(e=>e.pending).length;
   const header=(key:string)=>{const value=headers?.get(key);return value!==null&&value!==undefined&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null;};
   const remainingTokens=header('x-ratelimit-remaining-tokens'),remainingRequests=header('x-ratelimit-remaining-requests');
   if(remainingTokens!==null){const remaining=Math.max(0,remainingTokens-pendingTokens);s.remoteTokens={remaining:Math.min(s.remoteTokens?.remaining??Infinity,remaining),until:Math.max(s.remoteTokens?.until??0,time+duration(headers?.get('x-ratelimit-reset-tokens')??null,60000))};}
   if(remainingRequests!==null){const remaining=Math.max(0,remainingRequests-pendingRequests);s.remoteRequests={remaining:Math.min(s.remoteRequests?.remaining??Infinity,remaining),until:Math.max(s.remoteRequests?.until??0,time+duration(headers?.get('x-ratelimit-reset-requests')??null,86400000))};}
  },signal);},
  async cooldown(until:number,signal?:AbortSignal){return store.transact(s=>{normalize(s,now());s.blockedUntil=Math.max(s.blockedUntil,until);},signal);},
 };
}
export type GroqQuota=ReturnType<typeof createGroqQuota>;

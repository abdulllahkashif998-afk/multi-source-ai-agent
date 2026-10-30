import {RateLimitError} from './groq-quota';
export function rateLimitGuidance(error:unknown):{body:{rateLimitOrigin?:'local'|'provider';quotaReason?:string;retryAfterSeconds?:number};headers:Record<string,string>}{
 if(!(error instanceof RateLimitError))return {body:{},headers:{}};
 const seconds=error.retryAfterSeconds;
 const valid=Number.isSafeInteger(seconds)&&seconds!>0&&seconds!<=172800;
 return {body:{rateLimitOrigin:error.rateLimitOrigin,quotaReason:error.quotaReason,...(valid?{retryAfterSeconds:seconds}:{})},headers:valid?{'Retry-After':String(seconds)}:{}};
}

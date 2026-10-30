import {requestContext} from './reliability';
export function providerUsage(provider:'groq'|'gemini',reservedTokens:number,reportedTokens:number|null,httpStatus?:number){
 const ctx=requestContext();if(ctx){ctx.providerCalls=(ctx.providerCalls??0)+1;ctx.reportedTokens=(ctx.reportedTokens??0)+(reportedTokens??0);ctx.unknownUsageCalls=(ctx.unknownUsageCalls??0)+(reportedTokens===null?1:0);}
 try{console.info('[reliability]',JSON.stringify({requestId:ctx?.requestId,stage:'provider-usage',durationMs:0,provider,httpStatus,reservedTokens,reportedTokens,providerAttemptCount:ctx?.providerCalls,modelCallCount:ctx?.modelCalls,requestReportedTokens:ctx?.reportedTokens,requestUnknownUsageCalls:ctx?.unknownUsageCalls}));}catch{}
}
export const abstentionReasons=['missing_document','missing_dataset','ambiguous_dataset','unsupported_schema','ambiguous_rule','missing_lookup','truncated_evidence','unquotable_evidence','model_abstention','missing_cross_source_support'] as const;
export type AbstentionReason=typeof abstentionReasons[number];
export function agentAbstention(reason:AbstentionReason){
 if(!abstentionReasons.includes(reason))return;
 try{console.info('[reliability]',JSON.stringify({requestId:requestContext()?.requestId,stage:'agent-abstention',outcome:'abstained',reason}));}catch{}
}

export function modelInvocation(provider:string,phase:'planning'|'generation'){
 if(!['groq','gemini'].includes(provider))return;
 const ctx=requestContext();if(ctx)ctx.modelCalls=(ctx.modelCalls??0)+1;
 try{console.info('[reliability]',JSON.stringify({requestId:ctx?.requestId,stage:'model-call',durationMs:0,provider,phase,modelCallCount:ctx?.modelCalls,providerAttemptCount:ctx?.providerCalls??0}));}catch{}
}

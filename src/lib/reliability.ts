import {providerToolDiagnostic} from './provider-tool-diagnostics';
import { citationVerificationReason } from './chat-errors';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const context = new AsyncLocalStorage<{ requestId: string; deadline: number; providerCalls?:number;modelCalls?:number;reportedTokens?:number;unknownUsageCalls?:number }>();
const stages = new Set(['request','postgres','embedding','retrieval','csv-query','dataset-discovery','tool','tool-cache','structured-count','structured-operation','tool-validation','tool-execution','tool-argument-validation','configuration','planning','planning-wall','planning-gemini','final-generation','citation-verification','gemini-http','gemini-pacing','gemini-retry','groq-http','groq-admission','groq-pacing','groq-retry','planning-groq','generation','ingestion','parse-document','file-storage','sdk-warning','question-validation','agent-invocation','agent']);
const tools = new Set(['searchDocuments','discoverDatasets','inspectDataset','queryDataset']);
export function requestContext() { return context.getStore(); }
export function safeProviderCode(error:unknown){
 const e=error as {statusCode?:number;responseBody?:unknown};
 if(e?.statusCode!==400||typeof e.responseBody!=='string'||e.responseBody.length>8192)return undefined;
 try{
  const body=JSON.parse(e.responseBody);
  const allowed=['tool_use_failed','tool_call_validation_failed','invalid_request_error','invalid_arguments','context_length_exceeded','json_validate_failed'];
  // Never retain failed_generation, messages, arguments or arbitrary provider strings.
  return [body?.error?.code,body?.error?.type].find(value=>typeof value==='string'&&allowed.includes(value)) as string|undefined;
 }catch{return undefined;}
}
export function safeError(error: unknown) {
 const e=error as {name?:string;statusCode?:number;status?:number;code?:string;message?:string};
 const status=e?.statusCode??e?.status;
 const category=status===429?'rate_limit':e?.name==='TimeoutError'||e?.code==='57014'?'timeout':e?.name==='AbortError'?'cancelled':status===401||status===403?'authorization':e?.name==='ZodError'||e?.name==='AI_InvalidToolInputError'?'validation':['ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(e?.code??'')?'connection':'other';
 const reasons:Record<string,string>={'Sort must use group or value':'invalid_aggregate_sort','Dataset unavailable':'dataset_unavailable','Tool execution limit reached':'tool_budget_exhausted','Incomplete answer':'incomplete_generation','Unknown column':'unknown_column','Invalid filter type':'invalid_filter_type','Count counts rows; omit column':'invalid_count_column','Grouping requires aggregation':'missing_aggregate','Numeric column required':'numeric_column_required','Aggregate column required':'missing_aggregate_column','Group column conflicts with aggregate output value':'aggregate_group_conflict'};
 const providerCode=safeProviderCode(error),providerToolFailure=providerToolDiagnostic(error);
 const quota=error as {rateLimitOrigin?:string;quotaReason?:string;retryAfterSeconds?:number;admission?:{requestedTokens?:number;minuteTokens?:number;dayTokens?:number;remoteTokensRemaining?:number}};
 const admission:Record<string,number>={};
 if(quota?.rateLimitOrigin==='local'){for(const [key,value] of Object.entries({quotaRequestedTokens:quota.admission?.requestedTokens,quotaMinuteTokens:quota.admission?.minuteTokens,quotaDayTokens:quota.admission?.dayTokens,quotaRemoteTokensRemaining:quota.admission?.remoteTokensRemaining,retryAfterSeconds:quota.retryAfterSeconds})){if(Number.isSafeInteger(value)&&value!>=0)admission[key]=value!;}}
 const rateLimitOrigin=['local','provider'].includes(quota?.rateLimitOrigin??'')?quota.rateLimitOrigin:undefined;
 const quotaReason=['rpm','tpm','rpd','tpd','queue','provider_429','request_size','cooldown'].includes(quota?.quotaReason??'')?quota.quotaReason:undefined;
 return {category,...admission,...(rateLimitOrigin?{rateLimitOrigin,quotaReason}:{}),...(providerCode?{providerCode}:{}),...(providerToolFailure?{providerToolFailure}:{}),reason:citationVerificationReason(error)??(e?.code==='PROVIDER_BILLING_REQUIRED'?'provider_billing_required':typeof e?.message==='string'&&Object.hasOwn(reasons,e.message)?reasons[e.message]:undefined),errorType:['Error','TypeError','ZodError','AbortError','TimeoutError','ChatError','AI_APICallError','AI_NoObjectGeneratedError','AI_NoOutputGeneratedError','AI_InvalidToolInputError'].includes(e?.name??'')?e.name:'Unknown',httpStatus:Number.isInteger(status)&&status!>=100&&status!<=599?status:undefined};
}
export function logEvent(stage:string, since:number, outcome='ok', tool?:string, error?:unknown) {
 const record={requestId:context.getStore()?.requestId,stage:stages.has(stage)?stage:'request',tool:tools.has(tool??'')?tool:undefined,outcome:['ok','error','grounded','abstained','failed','retry','rejected','recovered'].includes(outcome)?outcome:'error',durationMs:Math.max(0,Math.round((performance.now()-since)*10)/10),...(error===undefined?{}:safeError(error))};
 try{console.info('[reliability]',JSON.stringify(record));}catch{/* Logging must not break request handling. */}
}
export async function measure<T>(stage:string,work:()=>Promise<T>) {
 const start=performance.now();try{const result=await work();logEvent(stage,start);return result;}catch(error){logEvent(stage,start,'error',undefined,error);throw error;}
}
export async function withRequest(request:Request,work:()=>Promise<Response>) {
 if(context.getStore())return work();
 return context.run({requestId:randomUUID(),deadline:Date.now()+60_000},async()=>{
 const start=performance.now();
 try{const response=await work();response.headers.set('X-Request-ID',context.getStore()!.requestId);logEvent('request',start,response.ok?'ok':'error',undefined,response.ok?undefined:{status:response.status,name:'Error'});return response;}
 catch(error){logEvent('request',start,'error',undefined,error);throw error;}
 });
}

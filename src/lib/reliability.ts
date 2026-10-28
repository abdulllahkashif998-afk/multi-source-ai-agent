import { citationVerificationReason } from './chat-errors';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const context = new AsyncLocalStorage<{ requestId: string; deadline: number }>();
const stages = new Set(['request','postgres','embedding','retrieval','csv-query','dataset-discovery','tool','tool-cache','structured-count','tool-validation','tool-execution','tool-argument-validation','configuration','planning','planning-wall','planning-gemini','final-generation','citation-verification','gemini-http','gemini-pacing','gemini-retry','groq-http','groq-pacing','groq-retry','planning-groq','generation','ingestion','parse-document','file-storage','sdk-warning','question-validation','agent-invocation','agent']);
const tools = new Set(['searchDocuments','discoverDatasets','inspectDataset','queryDataset']);
export function requestContext() { return context.getStore(); }
export function safeError(error: unknown) {
 const e=error as {name?:string;statusCode?:number;status?:number;code?:string;message?:string};
 const status=e?.statusCode??e?.status;
 const category=status===429?'rate_limit':e?.name==='TimeoutError'||e?.code==='57014'?'timeout':e?.name==='AbortError'?'cancelled':status===401||status===403?'authorization':e?.name==='ZodError'||e?.name==='AI_InvalidToolInputError'?'validation':['ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(e?.code??'')?'connection':'other';
 const reasons:Record<string,string>={'Sort must use group or value':'invalid_aggregate_sort','Dataset unavailable':'dataset_unavailable','Tool execution limit reached':'tool_budget_exhausted','Incomplete answer':'incomplete_generation','Unknown column':'unknown_column','Invalid filter type':'invalid_filter_type','Count counts rows; omit column':'invalid_count_column','Grouping requires aggregation':'missing_aggregate','Numeric column required':'numeric_column_required','Aggregate column required':'missing_aggregate_column','Group column conflicts with aggregate output value':'aggregate_group_conflict'};
 return {category,reason:citationVerificationReason(error)??(e?.code==='PROVIDER_BILLING_REQUIRED'?'provider_billing_required':typeof e?.message==='string'&&Object.hasOwn(reasons,e.message)?reasons[e.message]:undefined),errorType:['Error','TypeError','ZodError','AbortError','TimeoutError','ChatError','AI_APICallError','AI_NoObjectGeneratedError','AI_NoOutputGeneratedError','AI_InvalidToolInputError'].includes(e?.name??'')?e.name:'Unknown',httpStatus:Number.isInteger(status)&&status!>=100&&status!<=599?status:undefined};
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

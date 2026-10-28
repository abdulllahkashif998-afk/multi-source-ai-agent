import { citationVerificationReason } from './chat-errors';
import { logEvent, requestContext } from './reliability';

// Explicit allowlists: never include raw messages, stacks, prompts, URLs,
// provider response bodies, document text, or credentials.
export function agentDiagnosticRecord(stage: string, error: unknown, tool?: string) {
 const e = error as { name?: string; statusCode?: number; message?: string };
 const types = ['Error', 'TypeError', 'ZodError', 'AbortError', 'TimeoutError', 'ChatError', 'AI_APICallError', 'AI_NoObjectGeneratedError', 'AI_NoOutputGeneratedError', 'AI_InvalidToolInputError'];
 const safeMessages = ['Cannot convert undefined or null to object', 'No output generated.', 'Tool execution limit reached', 'Incomplete answer', 'Unknown column', 'Numeric column required', 'Invalid filter type', 'Sort must use group or value', 'Grouping requires aggregation', 'Count counts rows; omit column', 'Dataset unavailable'];
 const nonFunction = e?.name === 'TypeError' && /is not a function/.test(e?.message ?? '')
   ? ['readQuestion', 'answerWithAgent'].find(name => e.message?.includes(name)) : undefined;
 return {
   stage,
   tool: ['searchDocuments','discoverDatasets','inspectDataset','queryDataset'].includes(tool ?? '') ? tool : undefined,
   errorType: types.includes(e?.name ?? '') ? e.name : 'Unknown',
   httpStatus: Number.isInteger(e?.statusCode) && e.statusCode! >= 100 && e.statusCode! <= 599 ? e.statusCode : undefined,
   nonFunction,
   reason: citationVerificationReason(error) ?? safeMessages.find(m => e?.message === m),
 };
}
export function diagnoseAgent(stage: string, error: unknown, tool?: string, requestId?: string) {
 logEvent(stage,performance.now(),'error',tool,error);
 // The request context supplies the server-generated ID.
 void requestId;
}

export function createAgentTrace() {
 const requestId = requestContext()?.requestId ?? crypto.randomUUID();
 const started = performance.now();
 const events: Array<{stage:string;ms:number;outcome:string;tool?:string;reason?:string;errorType?:string;httpStatus?:number}> = [];
 function record(stage: string, since: number, outcome = 'ok', tool?: string, error?: unknown) {
   logEvent(stage,since,outcome,tool,error);
   const diagnostic = error === undefined ? undefined : agentDiagnosticRecord(stage,error);
   events.push({stage,ms:Math.round((performance.now()-since)*10)/10,outcome,tool,reason:diagnostic?.reason,errorType:diagnostic?.errorType,httpStatus:diagnostic?.httpStatus});
 }
 async function measure<T>(stage: string, work: () => Promise<T>, tool?: string) {
   const since=performance.now();
   try { const result=await work(); record(stage,since, result && typeof result==='object' && 'error' in result ? 'error' : 'ok',tool); return result; }
   catch(error) { record(stage,since,'error',tool,error);throw error; }
 }
 function flush(outcome: string) {
   const recoveredTools=[...new Set(events.filter((event,index)=>event.stage==='tool' && event.outcome==='error' && events.slice(index+1).some(later=>later.stage==='tool' && later.tool===event.tool && later.outcome==='ok')).map(event=>event.tool))];
   for(const tool of recoveredTools)logEvent('tool',performance.now(),'recovered',tool);
   logEvent('agent',started,outcome);
 }
 return {record,measure,flush,events,requestId};
}
export type AgentTrace = ReturnType<typeof createAgentTrace>;

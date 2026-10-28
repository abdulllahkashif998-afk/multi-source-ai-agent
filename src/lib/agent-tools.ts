import { diagnoseAgent, type AgentTrace } from './agent-diagnostics';
import { z } from 'zod';
import { planSchema, compileCSVQuery, type Column } from './generic-csv';
import { selectEvidence, validateGroundedAnswer, type EvidenceSource } from './rag-answer';
import type { DocumentSearchResult } from './search-documents';
import {abortable} from './agent-budget';

export interface Dataset { id: string; filename: string; columns: Column[]; row_count: number }
export interface AgentServices {
 search: (question: string, signal: AbortSignal) => Promise<DocumentSearchResult[]>;
 discover: (signal?:AbortSignal) => Promise<Dataset[]>;
 query: (plan: unknown,signal?:AbortSignal) => Promise<unknown[]>;
}
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value);
}
const validationHints:Record<string,string>={
 'Unknown column':'Use column names exactly as returned by inspectDataset; do not invent columns.',
 'Invalid filter type':'Filter values must match the inspected column type; boolean columns only support eq/ne.',
 'Count counts rows; omit column':'COUNT counts rows: use aggregate {op:"count"} without column. Use groupBy to count categories.',
 'Grouping requires aggregation':'GROUP BY requires an aggregate such as {op:"count"}.',
 'Numeric column required':'SUM/AVG require numeric columns. For counts of roles or other text categories use COUNT, not SUM.',
 'Aggregate column required':'SUM/AVG require the inspected numeric column name.',
 'Group column conflicts with aggregate output value':'Do not group by value when aggregating; value is the aggregate output.',
 'Sort must use group or value':'Invalid aggregate sort. Set sort.column to value for the aggregate result, or to a groupBy column. Do not use the original aggregate input column as the sort key.',
};
export function createAgentSession(services: AgentServices, signal: AbortSignal, cutoff: number, trace?: AgentTrace) {
 const documents: EvidenceSource[] = [];
 const csv: Array<{ id: string; datasetId: string; filename: string; plan: unknown; rows: unknown[]; text: string; possiblyTruncated: boolean }> = [];
 let datasets: Dataset[] | undefined;
 const inspected = new Set<string>(),cache=new Map<string,Promise<unknown>>();
 let calls = 0;
 async function cached<T>(key:string,name:string,active:AbortSignal,work:()=>Promise<T>):Promise<T>{
  let pending=cache.get(key);
  if(pending)trace?.record('tool-cache',performance.now(),'ok',name);
  else{pending=abortable(work,active);cache.set(key,pending);}
  try{const result=await abortable(()=>pending! as Promise<T>,active);if(result&&typeof result==='object'&&'error' in result&&cache.get(key)===pending)cache.delete(key);return structuredClone(result);}
  catch(error){if(cache.get(key)===pending)cache.delete(key);throw error;}
 }
 async function runTool(name: string, input: unknown,active:AbortSignal) {
   active.throwIfAborted();
   if (++calls > 10) throw new Error('Tool execution limit reached');
   let phase = 'tool-validation';
   try {
     if (name === 'searchDocuments') {
       const { question } = z.object({ question: z.string().trim().min(1).max(2000) }).strict().parse(input);
       phase = 'retrieval';
       return await cached('search:'+question,name,active,async()=>{
        const found=selectEvidence(await services.search(question,active),cutoff);active.throwIfAborted();
        const sources=found.map(source=>{const mapped={...source,id:`D${documents.length+1}`};documents.push(mapped);return mapped;});
        return {sources};
       });
     }
     if (name === 'discoverDatasets') {
       z.object({}).strict().parse(input);
       return await cached('discover',name,active,async()=>{
        const found=await services.discover(active);active.throwIfAborted();datasets=found;
        return {datasets:found.map(d=>({id:String(d.id),filename:d.filename,rowCount:d.row_count}))};
       });
     }
     if (name === 'inspectDataset') {
       const { datasetId } = z.object({ datasetId: z.string() }).strict().parse(input);
       const dataset = datasets?.find(d => String(d.id) === datasetId);
       if (!dataset) return { error: 'Discover owned datasets first; dataset unavailable.' };
       inspected.add(datasetId);
       return {dataset:structuredClone(dataset)};
     }
     if (name === 'queryDataset') {
       const plan = planSchema.parse(input);
       const dataset = datasets?.find(d => String(d.id) === plan.datasetId);
       if (!dataset || !inspected.has(plan.datasetId)) return { error: 'Discover and inspect the owned dataset first.' };
       compileCSVQuery(plan, dataset.columns);
       phase = 'csv-query';
       return await cached('query:'+canonical(plan),name,active,async()=>{
        const rows=await services.query(plan,active);active.throwIfAborted();const text=JSON.stringify(rows);
        if(text.length>24000)return {error:'Result too large; use aggregation or a smaller limit.'};
        const source={id:`C${csv.length+1}`,datasetId:plan.datasetId,filename:dataset.filename,plan,rows,text,possiblyTruncated:rows.length===plan.limit};csv.push(source);return source;
       });
     }
     return { error: 'Unknown tool.' };
   } catch (error) {
     trace?.record(phase,performance.now(),'error',name,error);
     diagnoseAgent('tool-execution', error, name, trace?.requestId);
     active.throwIfAborted();
     if(phase==='tool-validation'&&error instanceof Error&&Object.hasOwn(validationHints,error.message))return {error:validationHints[error.message]};
     return { error: 'Tool request invalid or service unavailable. Do not infer results from this error.' };
   }
 }
 async function execute(name: string, input: unknown,callSignal?:AbortSignal) {
   const toolName = ['searchDocuments','discoverDatasets','inspectDataset','queryDataset'].includes(name) ? name : 'unknown';
   const active=callSignal?AbortSignal.any([signal,callSignal]):signal;
   const work=()=>abortable(()=>runTool(name,input,active),active);
   return trace ? trace.measure('tool',work,toolName) : work();
 }
 function finalize(value: unknown) {
   const synthetic = csv.map(c => ({ id: c.id, text: c.text, documentId: '', chunkId: '', filename: c.filename, chunkIndex: 0, pageNumber: null, similarity: 1 }));
   const result = validateGroundedAnswer(value, [...documents, ...synthetic]);
   return { ...result, answer: result.grounded ? result.answer : "I don't have enough evidence from the available documents and datasets to answer that question.", sources: result.sources.map(s => {
     const c = csv.find(c => c.id === s.id);
     return c ? { ...c, type: 'csv', quotes: s.quotes } : { ...s, type: 'document' };
   }) };
 }
 return { execute, finalize, evidence: () => ({ documents, csv }) };
}

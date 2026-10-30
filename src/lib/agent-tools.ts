import {createHash} from 'node:crypto';
import {parsePolicyContract,policyDocumentText,type Metric} from './policy-predicates';
import {evaluatePolicyRecords} from './policy-record-evaluation';
import {policyCountStatements} from './policy-count-answer';
import {hasAmbiguousSLAScope,extractSLARules} from './agent-sla';
import {requiresCombinedEvidence,combinedStatementSupported,questionMentionsFilename} from './agent-evidence-contract';
import {agentAbstention,type AbstentionReason} from './provider-usage';
import { diagnoseAgent, type AgentTrace } from './agent-diagnostics';
import {agentToolInputs} from './agent-tool-inputs';
import { planSchema, compileCSVQuery, type Column } from './generic-csv';
import { selectEvidence, validateGroundedAnswer, groundedAnswerSchema, insufficientEvidence, type EvidenceSource } from './rag-answer';
import type { DocumentSearchResult } from './search-documents';
import {abortable} from './agent-budget';

export interface Dataset { id: string; filename: string; columns: Column[]; row_count: number }
export interface AgentServices {
 // completePolicy requests must return all bounded owned chunks or throw; never top-K.
 search: (question: string, signal: AbortSignal, options?:{filename:string;completePolicy?:boolean}) => Promise<DocumentSearchResult[]>;
 policies?: (signal:AbortSignal) => Promise<{documents:Array<{id:string;filename:string}>;truncated:boolean}>;
 discover: (signal?:AbortSignal) => Promise<Dataset[]>;
 query: (plan: unknown,signal?:AbortSignal) => Promise<unknown[]>;
 snapshot?: (plan:unknown,signal?:AbortSignal)=>Promise<{dataset:Dataset;rows:unknown[]}>;
}
export function canonical(value:unknown):string{
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
export function createAgentSession(services: AgentServices, signal: AbortSignal, cutoff: number, trace?: AgentTrace, question='') {
 const documents: EvidenceSource[] = [];
 const csv: Array<{ id: string; datasetId: string; filename: string; plan: unknown; rows: unknown[]; text: string; possiblyTruncated: boolean;derivation?:unknown }> = [];
 let datasets: Dataset[] | undefined;
 const inspected = new Set<string>(),cache=new Map<string,Promise<unknown>>();
 let calls = 0,abstentionRecorded=false,renderingPolicy=false;
 let evaluation:ReturnType<typeof evaluatePolicyRecords>&{contract:NonNullable<ReturnType<typeof parsePolicyContract>>;filename:string;sourceId:string;policySources:EvidenceSource[]}|undefined;
 function abstain(reason:AbstentionReason){agentAbstention(reason);abstentionRecorded=true;return {value:{answerable:false,statements:[]},choices:[]};}
 async function cached<T>(key:string,name:string,active:AbortSignal,work:()=>Promise<T>):Promise<T>{
  let pending=cache.get(key);
  if(pending)trace?.record('tool-cache',performance.now(),'ok',name);
  else{pending=abortable(work,active);cache.set(key,pending);}
  try{const result=await abortable(()=>pending! as Promise<T>,active);if(result&&typeof result==='object'&&'error' in result&&cache.get(key)===pending)cache.delete(key);return structuredClone(result);}
  catch(error){if(cache.get(key)===pending)cache.delete(key);throw error;}
 }
 async function runTool(name: string, input: unknown,active:AbortSignal,searchScope?:{filename:string;completePolicy?:boolean}) {
   active.throwIfAborted();
   if (++calls > 10) throw new Error('Tool execution limit reached');
   let phase = 'tool-validation';
   try {
     if (name === 'searchDocuments') {
       const { question } = agentToolInputs.searchDocuments.parse(input);
       phase = 'retrieval';
       return await cached('search:'+canonical({question,filename:searchScope?.filename??null,completePolicy:searchScope?.completePolicy??false}),name,active,async()=>{
        const candidates=(await services.search(question,active,searchScope)).filter(r=>!searchScope||r.filename.toLowerCase()===searchScope.filename.toLowerCase());
        const found=selectEvidence(candidates,cutoff);active.throwIfAborted();
        const sources=found.map(source=>{const existing=documents.find(d=>d.documentId===source.documentId&&d.chunkId===source.chunkId&&d.text===source.text&&d.filename===source.filename&&d.pageNumber===source.pageNumber&&d.chunkIndex===source.chunkIndex);if(existing)return existing;const mapped={...source,id:`D${documents.length+1}`};documents.push(mapped);return mapped;});
        return {sources};
       });
     }
     if (name === 'discoverDatasets') {
       agentToolInputs.discoverDatasets.parse(input);
       return await cached('discover',name,active,async()=>{
        const found=await services.discover(active);active.throwIfAborted();datasets=found;
        return {datasets:found.map(d=>({id:String(d.id),filename:d.filename,rowCount:d.row_count}))};
       });
     }
     if (name === 'inspectDataset') {
       const { datasetId } = agentToolInputs.inspectDataset.parse(input);
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
 async function execute(name: string, input: unknown,callSignal?:AbortSignal,searchScope?:{filename:string;completePolicy?:boolean}) {
   const toolName = ['searchDocuments','discoverDatasets','inspectDataset','queryDataset'].includes(name) ? name : 'unknown';
   const active=callSignal?AbortSignal.any([signal,callSignal]):signal;
   const work=()=>abortable(()=>runTool(name,input,active,searchScope),active);
   return trace ? trace.measure('tool',work,toolName) : work();
 }
 function finalize(value: unknown) {
   if(evaluation&&!renderingPolicy){abstain('ambiguous_rule');return {...insufficientEvidence(),sources:[]};}
   const synthetic = csv.map(c => ({ id: c.id, text: c.text, documentId: '', chunkId: '', filename: c.filename, chunkIndex: 0, pageNumber: null, similarity: 1 }));
   let result = validateGroundedAnswer(value, [...documents, ...synthetic]);
   if(result.grounded&&requiresCombinedEvidence(question)){
    const statements=groundedAnswerSchema.parse(value).statements;
    if(statements.some(s=>!combinedStatementSupported(s.citations.map(c=>c.sourceId),question,documents,csv))){abstain('missing_cross_source_support');result=insufficientEvidence();}
   }
   if(!result.grounded&&!abstentionRecorded)abstain('model_abstention');
   return { ...result, answer: result.grounded ? result.answer : "I don't have enough evidence from the available documents and datasets to answer that question.", sources: result.sources.map(s => {
     const c = csv.find(c => c.id === s.id);
     return c ? { ...c, type: 'csv', quotes: s.quotes } : { ...s, type: 'document' };
   }) };
 }
 async function discoverPolicies(){
  if(!services.policies)return {documents:[],truncated:false};
  if(++calls>10)throw new Error('Tool execution limit reached');
  return abortable(()=>services.policies!(signal),signal);
 }
 // Discovery already checks ownership. This metadata lookup avoids spending a
 // tool execution on every candidate; the selected dataset still gets the
 // regular inspectDataset call before any query can execute.
 // Keep complete applicability context out of model prompts unless needed;
 // retain original source text for guards and eventual source verification.
 const completePolicies=new Map<string,DocumentSearchResult[]>();
 const policyContexts=new Map<string,Promise<'clear'|'ambiguous'|'unavailable'>>();
 async function policyContext(filename:string):Promise<'clear'|'ambiguous'|'unavailable'>{
  const key=filename.toLowerCase();let pending=policyContexts.get(key);
  if(!pending){pending=(async()=>{
   try{
    const rows=await abortable(()=>services.search('Complete policy applicability context',signal,{filename,completePolicy:true}),signal);
    const selected=documents.filter(d=>d.filename.toLowerCase()===key);
    if(selected.length&&rows.some(r=>!selected.some(d=>d.documentId===String(r.document_id))))return 'unavailable' as const;
    if(!rows.length||rows.length>100||rows.some(r=>r.filename.toLowerCase()!==key)||new Set(rows.map(r=>String(r.document_id))).size!==1||rows.reduce((n,r)=>n+r.chunk_text.length,0)>256000)return 'unavailable' as const;
    completePolicies.set(key,rows);
    const rules=new Map<string,string>();
    for(const row of rows)for(const rule of extractSLARules(row.chunk_text)){
     const value=rule.unit+':'+rule.threshold;
     if(rules.has(rule.priority)&&rules.get(rule.priority)!==value)return 'ambiguous' as const;
     rules.set(rule.priority,value);
    }
    return rows.some(r=>hasAmbiguousSLAScope(r.chunk_text))?'ambiguous' as const:'clear' as const;
   }catch{signal.throwIfAborted();return 'unavailable' as const;}
  })();policyContexts.set(key,pending);}
  return pending;
 }
 async function ensureSLAPolicyContexts(applyingToRows=false){
  if(!csv.length&&!applyingToRows)return true; // Reporting a documented rule alone does not apply it to rows.
  const filenames=[...new Set(documents.filter(d=>/first[- ]response|response[- ]sla/i.test(d.text)||/first[- ]response|\bsla\b/i.test(question)).map(d=>d.filename))];
  for(const filename of filenames){
   if(evaluation?.filename.toLowerCase()===filename.toLowerCase())continue;
   const status=await policyContext(filename);
   if(status!=='clear'){abstain(status==='ambiguous'?'ambiguous_rule':'missing_document');return false;}
  }
  return true;
 }
 async function preparePolicyEvaluation(filename:string,q:string,policies:Array<{id:string;filename:string}>){
  if(evaluation)return true;if(!services.snapshot||policies.length>5)return false;
  await policyContext(filename);const context=completePolicies.get(filename.toLowerCase());if(!context)return false;
  const contract=parsePolicyContract(context);if(!contract)return false;
  // Dataset identity is explicitly bound by policy AND requested question.
  if(!questionMentionsFilename(q,contract.dataset))return false;
  for(const other of policies.filter(p=>p.filename.toLowerCase()!==filename.toLowerCase())){
   await policyContext(other.filename);const otherRows=completePolicies.get(other.filename.toLowerCase());if(!otherRows)return false;
   if(policyDocumentText(otherRows).toLowerCase().includes(contract.dataset.toLowerCase()))return false; // No implicit precedence.
  }
  const discovery=await execute('discoverDatasets',{});if(!discovery||typeof discovery!=='object'||!('datasets' in discovery)||!Array.isArray(discovery.datasets))return false;
  if(discovery.datasets.filter(d=>questionMentionsFilename(q,d.filename)).length!==1)return false;
  const matches=discovery.datasets.filter(d=>d.filename.toLowerCase()===contract.dataset.toLowerCase());if(matches.length!==1)return false;
  await execute('inspectDataset',{datasetId:matches[0].id});
  if(++calls>10)throw Error('Tool execution limit reached');
  const inputPlan=planSchema.parse({datasetId:matches[0].id,limit:100});
  try{
   const snapshot=await abortable(()=>services.snapshot!(inputPlan,signal),signal);
   signal.throwIfAborted();
   if(snapshot.dataset.row_count!==snapshot.rows.length||String(snapshot.dataset.id)!==inputPlan.datasetId||snapshot.dataset.filename.toLowerCase()!==contract.dataset.toLowerCase()||JSON.stringify(snapshot.rows).length>24000)return false;
   const computed=evaluatePolicyRecords(contract,snapshot.dataset.columns,snapshot.rows);
   if(!computed.rows.length||computed.rows.length>5)return false;
   const total={...computed.rows[0],priority:'(all)'};
   for(const key of Object.keys(total).filter(k=>k!=='priority') as Array<Exclude<keyof typeof total,'priority'>>)total[key]=computed.rows.reduce((sum,r)=>sum+r[key],0);
   const rows=[...computed.rows,total],sourceId=`C${csv.length+1}`;
   signal.throwIfAborted();
   csv.push({id:sourceId,datasetId:inputPlan.datasetId,filename:snapshot.dataset.filename,plan:inputPlan,rows,text:JSON.stringify(rows),possiblyTruncated:false,derivation:{kind:'policy_applicability_counts',policy:{documentId:String(context[0].document_id),filename,contract},inputPlan,inputRows:snapshot.rows,inputSha256:createHash('sha256').update(canonical(snapshot.rows)).digest('hex'),classifications:computed.classified}});
   const policySources=context.map(row=>{
    const existing=documents.find(d=>d.documentId===String(row.document_id)&&d.chunkId===String(row.chunk_id)&&d.text===row.chunk_text);if(existing)return existing;
    const mapped={id:`D${documents.length+1}`,documentId:String(row.document_id),chunkId:String(row.chunk_id),filename:row.filename,chunkIndex:row.chunk_index,pageNumber:row.page_number,similarity:null,text:row.chunk_text};documents.push(mapped);return mapped;
   });
   evaluation={...computed,contract,filename,sourceId,policySources};return true;
  }catch{signal.throwIfAborted();return false;}
 }
 function policyEvaluationInfo(){return evaluation?{sourceId:evaluation.sourceId,availableMetrics:['first_response','resolution'],view:'qualified_counts',rows:evaluation.rows}:undefined;}
 function renderPolicyCounts(metric:Metric){
  signal.throwIfAborted();
  if(!evaluation)return {...insufficientEvidence(),sources:[]};
  const computed=policyCountStatements(evaluation.contract,evaluation.rows,metric),source=csv.find(s=>s.id===evaluation!.sourceId)!;
  const known=evaluation.rows.reduce((n,r)=>n+(metric==='first_response'?r.firstResponseLate+r.firstResponseOnTime+r.maintenanceExcluded:r.resolutionLate+r.resolutionOnTime),0);
  if((computed.totals.scopeUnknown&&!computed.totals.applicable)||(computed.totals.unknown&&!known)){abstain('missing_lookup');return {...insufficientEvidence(),sources:[]};}
  const statements=computed.statements.map(s=>({text:s.text,citations:[...evaluation!.contract.support[s.kind].map(i=>({sourceId:evaluation!.policySources[i].id,quote:evaluation!.policySources[i].text})),{sourceId:source.id,quote:JSON.stringify(source.rows[s.row])}]}));
  if(statements.length>8)return {...insufficientEvidence(),sources:[]};
  renderingPolicy=true;try{return finalize({answerable:true,statements});}finally{renderingPolicy=false;}
 }
 function inspectDiscoveredDataset(id:string){return datasets?.find(d=>String(d.id)===id);}
 return { execute, finalize, abstain, discoverPolicies, preparePolicyEvaluation,policyEvaluationInfo,renderPolicyCounts, policyContext,ensureSLAPolicyContexts, inspectDiscoveredDataset, evidence: () => ({ documents, csv }) };
}

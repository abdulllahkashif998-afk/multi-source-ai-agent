import {z} from 'zod';
import {cases,datasets,documents,type EvalCase} from './fixtures';
import {prepareCSV,compileCSVQuery,planSchema} from '../src/lib/generic-csv';
import {INSUFFICIENT_EVIDENCE} from '../src/lib/rag-answer';
// Supplemental evidence is allowed, not required. Original benchmark labels stay unchanged.
// conflict-02 explicitly asks for sales comparisons under both policies.
const supplementalSources:Readonly<Record<string,readonly string[]>>={'conflict-02':['csv:201']};
export type Judgment='pass'|'fail'|'needs-review';
export function retrievalMetrics(ranked:string[],relevant:string[],k:number){
 if(!Number.isInteger(k)||k<1)throw Error('K must be a positive integer');
 const gold=new Set(relevant),hits=new Set(ranked.slice(0,k).filter(id=>gold.has(id))).size;
 return {k,hits,relevant:gold.size,returned:ranked.slice(0,k).length,recall:gold.size?hits/gold.size:null,precision:gold.size?hits/k:null};
}
export function distribution(values:number[]){const sorted=values.filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);const percentile=(p:number)=>sorted.length?sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]:null;return {n:sorted.length,min:sorted[0]??null,p50:percentile(.5),p95:percentile(.95),max:sorted.at(-1)??null,mean:sorted.length?sorted.reduce((a,b)=>a+b,0)/sorted.length:null};}
export function mean(values:Array<number|null>){const eligible=values.filter((v):v is number=>v!==null&&Number.isFinite(v));return {n:eligible.length,value:eligible.length?eligible.reduce((a,b)=>a+b,0)/eligible.length:null};}
const sourceSchema=z.object({id:z.string().regex(/^[SDC][1-9]\d*$/),filename:z.string(),type:z.enum(['document','csv']).optional(),documentId:z.string().optional(),chunkId:z.string().optional(),chunkIndex:z.number().int().nonnegative().optional(),pageNumber:z.number().int().nonnegative().nullable().optional(),datasetId:z.string().optional(),text:z.string(),quotes:z.array(z.string().min(1)).min(1),rows:z.array(z.unknown()).optional(),plan:z.unknown().optional(),possiblyTruncated:z.boolean().optional()});
const responseSchema=z.object({success:z.boolean().optional(),grounded:z.boolean(),answer:z.string().min(1),sources:z.array(sourceSchema)});
export const parseEvalAnswer=(value:unknown)=>responseSchema.safeParse(value);
export type EvalAnswer=z.infer<typeof responseSchema>;
export function sourceKey(source:EvalAnswer['sources'][number]){return source.type==='csv'?`csv:${source.datasetId}`:`doc:${source.documentId}:${source.chunkId}`;}
function canonical(value:unknown):string{if(Array.isArray(value))return '['+value.map(canonical).sort().join(',')+']';if(value&&typeof value==='object')return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));return JSON.stringify(value);}
export function scoreAnswer(c:EvalCase,value:unknown):{status:Judgment;automatedStatus:'pass'|'fail';failures:string[];review:string[];citationPrecision:number|null;sourceRecall:number|null;quoteValidity:number|null;numeric:Array<{label:string;expected:number;tolerance:number;observed:number[];correct:boolean|null}>;refusalCorrect:boolean}{
 const parsed=responseSchema.safeParse(value);const failures:string[]=[],review:string[]=[];
 if(!parsed.success||parsed.data.success===false)return {status:'fail' as Judgment,automatedStatus:'fail' as const,failures:['invalid_response'],review:[],citationPrecision:null,sourceRecall:null,quoteValidity:null,numeric:[],refusalCorrect:false};
 const r=parsed.data,markers=[...r.answer.matchAll(/\[([SDC][1-9]\d*)\]/g)].map(m=>m[1]);
 const safeRefusals=[INSUFFICIENT_EVIDENCE,"I don't have enough evidence from the available documents and datasets to answer that question."];
 if(c.refuse){
  if(c.category==='ambiguous'&&r.grounded){
   const expectedSources=c.relevantChunks.map(id=>{const document=documents.find(d=>d.chunkId===id)!;return `doc:${document.id}:${document.chunkId}`;});
   const checked=scoreAnswer({...c,refuse:false,expectedSources},r);
   return {...checked,review:[...checked.review,'sourced_conflict_explanation_or_clarification_requires_review'],refusalCorrect:false};
  }
  if(r.grounded||r.sources.length||markers.length)failures.push('expected_abstention');
  if(!r.grounded&&!safeRefusals.includes(r.answer))review.push('noncanonical_refusal_requires_review');
  if(c.category==='ambiguous')review.push('conflict_or_ambiguity_requires_human_judgment');
  return {status:(failures.length?'fail':review.length?'needs-review':'pass') as Judgment,automatedStatus:failures.length?'fail' as const:'pass' as const,failures,review,citationPrecision:null,sourceRecall:null,quoteValidity:null,numeric:[],refusalCorrect:!r.grounded&&!r.sources.length&&!markers.length&&safeRefusals.includes(r.answer)};
 }
 if(!r.grounded)failures.push('unexpected_abstention');
 const allowedSources=new Set([...c.expectedSources,...(supplementalSources[c.id]??[])]);
 const ids=new Set(r.sources.map(s=>s.id));
 if(ids.size!==r.sources.length||!markers.length||markers.some(id=>!ids.has(id))||r.sources.some(s=>!markers.includes(s.id)))failures.push('invalid_citation_markers');
 let quoteCount=0,validQuotes=0;
 for(const source of r.sources){
  const key=sourceKey(source);
  if(!source.id.startsWith(source.type==='csv'?'C':c.system==='chat'?'S':'D'))failures.push('invalid_citation_namespace');
  if(!allowedSources.has(key))failures.push('irrelevant_or_unknown_source');
  if(source.type==='csv'){
   const dataset=datasets.find(d=>d.id===source.datasetId);
   if(!dataset||dataset.filename!==source.filename||!source.rows||source.text!==JSON.stringify(source.rows)){failures.push('invalid_csv_provenance');continue;}
   try{
    const plan=planSchema.parse(source.plan);if(plan.datasetId!==dataset.id)throw Error('Mismatch');compileCSVQuery(plan,prepareCSV(dataset.csv).columns);
    const known=cases.find(item=>item.plan&&canonical(planSchema.parse(item.plan))===canonical(plan));
    if(known&&canonical(source.rows)!==canonical(known.expectedRows))failures.push('csv_result_mismatch');
    if(!known)review.push('unregistered_valid_query_plan_requires_review');
   }catch{failures.push('invalid_csv_plan');}
   if(source.possiblyTruncated)review.push('limited_csv_evidence_requires_review');
   for(const quote of source.quotes){quoteCount++;if(source.text.includes(quote))validQuotes++;else failures.push('quote_not_in_evidence');}
  }else{
   const document=documents.find(d=>d.id===source.documentId&&d.chunkId===source.chunkId);
   if(!document||document.filename!==source.filename||!document.text.includes(source.text)||(source.chunkIndex!==undefined&&source.chunkIndex!==document.index)||(source.pageNumber!==undefined&&source.pageNumber!==document.page)){failures.push('invalid_document_provenance');continue;}
   for(const quote of source.quotes){quoteCount++;if(document.text.includes(quote)&&source.text.includes(quote))validQuotes++;else failures.push('quote_not_in_evidence');}
  }
 }
 const cited=new Set(r.sources.map(sourceKey));
 const expected=new Set(c.expectedSources);const matching=[...cited].filter(key=>expected.has(key)).length;
 const allowedMatching=[...cited].filter(key=>allowedSources.has(key)).length;
 if([...expected].some(key=>!cited.has(key)))failures.push('missing_required_source');
 const textForFacts=r.answer.replace(/\[[SDC][1-9]\d*\]/g,'');
 const numeric=c.facts.map(f=>{
  const matches=[...textForFacts.matchAll(new RegExp(f.pattern,'gi'))];const observed=matches.map(m=>Number(m[1])).filter(Number.isFinite);
  const correct=observed.length?observed.every(n=>Math.abs(n-f.value)<=f.tolerance):null;
  if(correct===false)failures.push('numeric_value_mismatch');if(correct===null)review.push('numeric_fact_not_reliably_extractable');
  return {label:f.label,expected:f.value,tolerance:f.tolerance,observed,correct};
 });
 review.push('free_text_entailment_units_conditions_and_completeness_require_human_review');
 return {status:(failures.length?'fail':'needs-review') as Judgment,automatedStatus:failures.length?'fail' as const:'pass' as const,failures:[...new Set(failures)],review:[...new Set(review)],citationPrecision:cited.size?allowedMatching/cited.size:null,sourceRecall:expected.size?matching/expected.size:null,quoteValidity:quoteCount?validQuotes/quoteCount:null,numeric,refusalCorrect:false};
}

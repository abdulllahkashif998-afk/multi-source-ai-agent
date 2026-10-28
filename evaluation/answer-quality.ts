import {createHash} from 'node:crypto';
import {z} from 'zod';
import {cases,documents,datasets,corpusDocuments,type EvalCase} from './fixtures';
import {parseEvalAnswer,scoreAnswer,type Judgment} from './metrics';
import {oracleQuery,sameRows} from './answer-oracle';
import type {CaseResult} from './runner';
export const fixtureHash=createHash('sha256').update(JSON.stringify({cases,documents,datasets},null,2)+'\n').digest('hex');
export const dimensions=['factualCorrectness','completeness','groundedness','citationSupport','conflictHandling'] as const;
export const rubric={
 factualCorrectness:'Check every factual claim and calculation, units, signs, entities, dates and strict/inclusive boundaries against canonical evidence. Wrong claims fail; unknown entailment needs review.',
 completeness:'Check every requested part, comparison and required source. Missing a requested conclusion fails. Do not require verbatim expected wording.',
 groundedness:'Check each claim follows from authorized fixture evidence. Extra unsupported claims fail, even with genuine quotes. Missing fields are not zeros.',
 citationSupport:'Map each factual claim to its local citation markers and supporting text/CSV rows. Authentic quotes alone do not prove entailment. Missing or misleading support fails.',
 conflictHandling:'For conflict/ambiguity, require explicit recognition and clarification or abstention; never silently choose. Otherwise pass only if no applicable conflict was overlooked.',
};
const rating=z.enum(['pass','fail','needs-review']);
const annotation=z.object({caseId:z.string(),fixtureHash:z.string(),answerHash:z.string(),reviewer:z.string().min(1).max(100),notes:z.string().min(20).max(5000),dimensions:z.object({factualCorrectness:rating,completeness:rating,groundedness:rating,citationSupport:rating,conflictHandling:rating}).strict()}).strict();
export const reviewFileSchema=z.array(annotation).max(25).superRefine((rows,ctx)=>{if(new Set(rows.map(r=>r.caseId)).size!==rows.length)ctx.addIssue({code:'custom',message:'Duplicate reviews'});});
export type Review=z.infer<typeof annotation>;
export const answerHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(parseEvalAnswer(value).success?parseEvalAnswer(value).data:value)??'null').digest('hex');
export function evaluateAnswer(c:EvalCase,result:CaseResult,review?:Review){
 const reasons:string[]=[],uncertainty:string[]=[];
 const checkedCSV:Array<{sourceId:string;matches:boolean;expectedRows?:unknown[]}>=[];
 const parsed=parseEvalAnswer(result.answer),baseline=parsed.success?scoreAnswer(c,parsed.data):null;
 if(result.executed&&!result.error&&!parsed.success)reasons.push('invalid_response');
 if(parsed.success){
  reasons.push(...baseline!.failures);uncertainty.push(...baseline!.review);
  for(const s of parsed.data.sources){
   if(s.type!=='csv'){
    if(!corpusDocuments(c.corpus).some(d=>d.id===s.documentId&&d.chunkId===s.chunkId)||!s.text.trim())reasons.push('source_outside_case_corpus');
   }else{
    try{const expected=oracleQuery(s.plan);const plan=s.plan as {sort?:unknown};const matches=Array.isArray(s.rows)&&sameRows(s.rows,expected,Boolean(plan.sort));checkedCSV.push({sourceId:s.id,matches,expectedRows:expected});if(!matches)reasons.push('independent_csv_result_mismatch');}
    catch{checkedCSV.push({sourceId:s.id,matches:false});reasons.push('independent_csv_plan_invalid');}
   }
  }
 }
 const categories=new Set<string>();
 if(result.error)categories.add(['rate_limit','authorization'].includes(result.error.category)||result.error.errorType==='AI_APICallError'?'provider_failure':'execution_failure');
 for(const reason of reasons){if(reason.includes('numeric')||reason.includes('csv_result'))categories.add('calculation_error');else if(reason.includes('abstention'))categories.add('abstention_error');else if(/source|citation|quote|provenance/.test(reason))categories.add('citation_issue');else if(reason.includes('plan'))categories.add('tool_selection_failure');else categories.add('response_contract_failure');}
 // Missing sources alone do not distinguish failed retrieval from failed planning or citation omission.
 const suspects:string[]=[];
 if(reasons.includes('missing_required_source')){const last=result.retrieval.filter(r=>r.mode==='hybrid').at(-1);if(c.relevantChunks.length&&last&&!c.relevantChunks.every(id=>last.ranked.includes(id)))suspects.push('retrieval_failure_candidate');else suspects.push('tool_selection_or_citation_omission_requires_trace_review');}
 let status:Judgment=!result.executed?'needs-review':result.error||reasons.length?'fail':baseline?.status??'needs-review';
 let human:'not-reviewed'|'accepted'|'stale'='not-reviewed';
 if(review){
  if(review.caseId!==c.id||review.fixtureHash!==fixtureHash||review.answerHash!==answerHash(result.answer)||!result.executed||!parsed.success)human='stale';
  else{human='accepted';const ratings=dimensions.map(d=>review.dimensions[d]);if(ratings.includes('fail')){status='fail';categories.add('human_review_failure');if(review.dimensions.groundedness==='fail')categories.add('hallucination');if(review.dimensions.citationSupport==='fail')categories.add('citation_issue');}else if(status!=='fail')status=ratings.every(r=>r==='pass')?'pass':'needs-review';}
 }
 return {id:c.id,executed:result.executed,status,automatic:!result.executed?'not-run':result.error||reasons.length?'fail':'pass',reasons:[...new Set(reasons)],uncertainty:[...new Set(uncertainty)],categories:[...categories],suspects,checkedCSV,human,answerHash:answerHash(result.answer),review:human==='accepted'?review:undefined};
}
export type AnswerJudgment=ReturnType<typeof evaluateAnswer>;
export function answerSummary(rows:AnswerJudgment[]){const run=rows.filter(r=>r.executed);return {planned:rows.length,executed:run.length,notRun:rows.length-run.length,pass:run.filter(r=>r.status==='pass').length,fail:run.filter(r=>r.status==='fail').length,needsReview:run.filter(r=>r.status==='needs-review').length,humanReviewed:run.filter(r=>r.human==='accepted').length,automaticPass:run.filter(r=>r.automatic==='pass').length,categories:Object.fromEntries([...new Set(run.flatMap(r=>r.categories))].sort().map(category=>[category,run.filter(r=>r.categories.includes(category)).length]))};}

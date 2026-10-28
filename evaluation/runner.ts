import {performance} from 'node:perf_hooks';
import {safeError} from '../src/lib/reliability';
import {retrievalMetrics,scoreAnswer,distribution,mean,parseEvalAnswer,type Judgment} from './metrics';
import type {EvalCase} from './fixtures';
export interface Stage {stage:string;durationMs:number;outcome:string;tool?:string;requestId?:string}
export interface Observation {mode:'semantic'|'hybrid';ranked:string[];durationMs:number|null}
export interface Context {retrieval:(value:Observation)=>void;stage:(value:Stage)=>void;answer:(value:unknown)=>void}
export type Adapter=(c:EvalCase,context:Context,signal:AbortSignal)=>Promise<void>;
export interface CaseResult {id:string;category:EvalCase['category'];system:EvalCase['system'];expectedRefusal:boolean;executed:boolean;status:Judgment;durationMs:number|null;answerDurationMs:number|null;score:ReturnType<typeof scoreAnswer>|null;retrieval:Array<Observation&ReturnType<typeof retrievalMetrics>>;stages:Stage[];error:ReturnType<typeof safeError>|null;answer?:unknown}
export async function runEvaluation(selected:EvalCase[],adapter:Adapter,options:{k?:number;signal?:AbortSignal;intervalMs?:number}={}){
 const k=options.k??3;if(!Number.isInteger(k)||k<1||k>3)throw Error('Retrieval K must be 1 to 3');
 const results:CaseResult[]=[];
 for(const c of selected){
  if(options.signal?.aborted){results.push({id:c.id,category:c.category,system:c.system,expectedRefusal:c.refuse,executed:false,status:'needs-review',durationMs:null,answerDurationMs:null,score:null,retrieval:[],stages:[],error:null});continue;}
  const start=performance.now();const result:CaseResult={id:c.id,category:c.category,system:c.system,expectedRefusal:c.refuse,executed:true,status:'needs-review',durationMs:null,answerDurationMs:null,score:null,retrieval:[],stages:[],error:null};
  let answer:unknown;let received=false;
  try{
   await adapter(c,{retrieval:value=>{result.retrieval.push({...value,...retrievalMetrics(value.ranked,c.relevantChunks,k)});},stage:value=>{result.stages.push(value);if(value.stage==='answer-end-to-end')result.answerDurationMs=value.durationMs;},answer:value=>{answer=value;received=true;}},options.signal??new AbortController().signal);
   if(received){result.score=scoreAnswer(c,answer);result.status=result.score.status;const parsed=parseEvalAnswer(answer);if(parsed.success)result.answer=parsed.data;}
   else if(result.retrieval.length){result.status='needs-review';}
   else throw Error('No evaluation output');
  }catch(error){result.error=safeError(error);if(result.error.httpStatus===504||result.error.httpStatus===408)result.error.category='timeout';result.status='fail';}
  result.durationMs=performance.now()-start;results.push(result);
  if(options.intervalMs&&c!==selected.at(-1)&&!options.signal?.aborted)await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);options.signal?.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,options.intervalMs);options.signal?.addEventListener('abort',done,{once:true});});
 }
 return results;
}
export function summarize(results:CaseResult[]){
 const executed=results.filter(r=>r.executed);const facts=executed.flatMap(r=>r.score?.numeric??[]),checked=facts.filter(f=>f.correct!==null),refusals=executed.filter(r=>r.expectedRefusal);
const modes=(['semantic','hybrid'] as const).map(mode=>{const observations=executed.flatMap(r=>r.retrieval.filter(x=>x.mode===mode));return [mode,{recall:mean(observations.map(x=>x.recall)),precision:mean(observations.map(x=>x.precision)),latencyMs:distribution(observations.flatMap(x=>x.durationMs===null?[]:[x.durationMs]))}] as const;});
 return {numericFacts:{declared:facts.length,checked:checked.length,correct:checked.filter(f=>f.correct).length,incorrect:checked.filter(f=>!f.correct).length,unscored:facts.length-checked.length,accuracyOnExtracted:checked.length?checked.filter(f=>f.correct).length/checked.length:null},refusalContract:{eligible:refusals.length,canonical:refusals.filter(r=>r.score?.refusalCorrect).length,rate:refusals.length?refusals.filter(r=>r.score?.refusalCorrect).length/refusals.length:null},stageLatencyMs:Object.fromEntries([...new Set(executed.flatMap(r=>r.stages.map(s=>s.stage)))].sort().map(stage=>[stage,distribution(executed.flatMap(r=>r.stages.filter(s=>s.stage===stage).map(s=>s.durationMs)))] as const)),planned:results.length,executed:executed.length,notRun:results.length-executed.length,pass:executed.filter(r=>r.status==='pass').length,fail:executed.filter(r=>r.status==='fail').length,needsReview:executed.filter(r=>r.status==='needs-review').length,automaticChecksPassed:executed.filter(r=>r.score?.automatedStatus==='pass').length,executionErrorRate:executed.length?executed.filter(r=>r.error!==null).length/executed.length:null,failureRate:executed.length?executed.filter(r=>r.status==='fail').length/executed.length:null,timeoutRate:executed.length?executed.filter(r=>r.error?.category==='timeout').length/executed.length:null,latencyMs:distribution(executed.flatMap(r=>r.durationMs===null?[]:[r.durationMs])),answerLatencyMs:distribution(executed.flatMap(r=>r.answerDurationMs===null?[]:[r.answerDurationMs])),retrieval:Object.fromEntries(modes),citations:{precision:mean(executed.map(r=>r.score?.citationPrecision??null)),sourceRecall:mean(executed.map(r=>r.score?.sourceRecall??null)),quoteValidity:mean(executed.map(r=>r.score?.quoteValidity??null))},categories:Object.fromEntries(['document','csv','combined','insufficient','ambiguous'].map(category=>{const group=executed.filter(r=>r.category===category);return [category,{executed:group.length,pass:group.filter(r=>r.status==='pass').length,fail:group.filter(r=>r.status==='fail').length,needsReview:group.filter(r=>r.status==='needs-review').length}];}))};
}

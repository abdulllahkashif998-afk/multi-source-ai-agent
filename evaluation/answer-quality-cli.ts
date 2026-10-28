import {citationVerificationReasons} from '../src/lib/chat-errors';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {cases,type EvalCase} from './fixtures';
import {parseOptions} from './options';
import {runEvaluation,type CaseResult} from './runner';
import {mockAdapter} from './mock-adapter';
import {oracleQuery,sameRows,independentCombinedFacts} from './answer-oracle';
import {parseEvalAnswer,scoreAnswer} from './metrics';
import {redactSecrets} from './report';
import {evaluateAnswer,answerSummary,fixtureHash,rubric,dimensions,answerHash,reviewFileSchema,type AnswerJudgment,type Review} from './answer-quality';
import {safeError} from '../src/lib/reliability';
export function answerOptions(args:string[],env:Record<string,string|undefined>=process.env){
 const extra=new Map<string,string>(),rest:string[]=[];
 for(let i=0;i<args.length;i+=2){if(['--reviews','--input'].includes(args[i])){if(extra.has(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid review arguments');extra.set(args[i],args[i+1]);}else rest.push(args[i],args[i+1]);}
 if(rest.includes('--document-system'))throw Error('Answer benchmark preserves its authored workflows');
 const options=parseOptions(rest,env);if(options.mode==='retrieval')throw Error('Answer evaluation requires mock or live');
 if(options.mode==='live'&&(env.AI_PROVIDER!=='groq'||options.selected.length>3||extra.has('--input')))throw Error('Live answer evaluation requires configured Groq and at most three explicitly selected cases');
 if(extra.has('--input')&&rest.some(f=>['--mode','--cases','--limit','--document-system'].includes(f)))throw Error('Saved input cannot be combined with execution options');
 return {...options,directory:rest.includes('--out')?options.directory:path.resolve('.evaluation-results/answer-quality'),reviews:extra.get('--reviews'),input:extra.get('--input')};
}
// Count actual HTTP attempts (including existing transport retries), not just evaluation cases.
export async function answerNetwork<T>(live:boolean,work:(counts:{groqAttempts:number})=>Promise<T>){
 const original=globalThis.fetch,counts={groqAttempts:0};const ollama=new URL(process.env.OLLAMA_BASE_URL??'http://localhost:11434');
 globalThis.fetch=(async(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input:input.url);
 if(!live)throw Error('Offline evaluation blocked network');
 if(url.origin===ollama.origin&&['/api/embed','/api/tags'].includes(url.pathname))return original(input,init);
 if(url.origin==='https://api.groq.com'&&url.pathname==='/openai/v1/chat/completions'){if(counts.groqAttempts>=12)throw Error('Evaluation HTTP budget exhausted');counts.groqAttempts++;return original(input,init);}
 throw Error('Evaluation blocked unexpected endpoint');}) as typeof fetch;
 try{return await work(counts);}finally{globalThis.fetch=original;}
}
const safeFailure=z.object({category:z.enum(['rate_limit','timeout','cancelled','authorization','validation','connection','other']),errorType:z.enum(['Error','TypeError','ZodError','AbortError','TimeoutError','ChatError','AI_APICallError','AI_NoObjectGeneratedError','AI_NoOutputGeneratedError','AI_InvalidToolInputError','Unknown']).optional(),httpStatus:z.number().int().min(100).max(599).optional(),reason:z.enum(['provider_billing_required','invalid_aggregate_sort','dataset_unavailable','tool_budget_exhausted','incomplete_generation','unknown_column','invalid_filter_type','invalid_count_column','missing_aggregate','numeric_column_required','missing_aggregate_column','aggregate_group_conflict',...citationVerificationReasons]).optional()});
const savedSchema=z.object({metadata:z.object({mode:z.enum(['mock','live']),fixtureHash:z.literal(fixtureHash),generatedAt:z.string(),provider:z.string().optional(),model:z.string().optional(),groqAttempts:z.number().int().min(0).optional()}),results:z.array(z.object({id:z.string(),executed:z.boolean(),answer:z.unknown().optional(),error:safeFailure.nullable(),durationMs:z.number().nonnegative().nullable(),answerDurationMs:z.number().nonnegative().nullable()})).max(25)});
function escape(value:unknown){return String(value??'N/A').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('|','\\|').replaceAll('\n','<br>');}
function render(mode:string,results:CaseResult[],judgments:AnswerJudgment[],metadata:Record<string,unknown>){
 const summary=answerSummary(judgments),byId=new Map(results.map(r=>[r.id,r])),byJudgment=new Map(judgments.map(r=>[r.id,r]));
 const lines=['# Answer correctness and citation evaluation','',mode==='mock'?'**SCRIPTED MOCK: evaluator checks only. No real AI answer accuracy was measured.**':'**LIVE GROQ: automatic checks alone do not establish semantic correctness.**','',`Fixture hash: ${fixtureHash}. Generated: ${metadata.generatedAt}.`, `Provider: ${metadata.provider??'not called'}; model: ${metadata.model??'not called'}; actual Groq HTTP attempts in source run: ${metadata.groqAttempts??0}.`, `Executed ${summary.executed}/25 benchmark cases; pass ${summary.pass}, fail ${summary.fail}, needs review ${summary.needsReview}; human-reviewed ${summary.humanReviewed}. Unselected cases are not run.`, '', ...(metadata.setupError?[`Safe setup failure: ${escape(JSON.stringify(metadata.setupError))}. No cases were executed.`,'']:[]), '## Category summary','','| Category | Executed | Pass | Fail | Needs review |','| --- | ---: | ---: | ---: | ---: |'];
 for(const category of ['document','csv','combined','insufficient','ambiguous']){const group=judgments.filter(r=>r.executed&&cases.find(c=>c.id===r.id)?.category===category);lines.push(`| ${category} | ${group.length} | ${group.filter(r=>r.status==='pass').length} | ${group.filter(r=>r.status==='fail').length} | ${group.filter(r=>r.status==='needs-review').length} |`);}
 lines.push('','## Human review rubric','',...Object.entries(rubric).map(([key,text])=>`- **${key}:** ${text}`),'','Rate every dimension pass, fail, or needs-review. Record concrete claim-to-evidence reasoning and reviewer identity. All five must pass to approve answerable prose. A deterministic failure cannot be overridden. Unknown or disputed meaning stays needs-review. Review binding uses both fixture and exact response hashes; stale annotations are ignored. No human judgments are invented by this runner.','', '## Errors and abstention','',`Confirmed failure categories (can overlap): ${escape(JSON.stringify(summary.categories))}.`,'Retrieval/tool-selection root causes require trace evidence. Missing citations alone cannot establish either. Hallucination requires semantic review; matching numbers and quotes do not exclude it. Canonical missing-evidence abstention can pass only its refusal contract. Conflict/ambiguity needs semantic review even after a canonical refusal.','', '## Per-case evidence and outcomes','');
 for(const c of cases){const r=byId.get(c.id),j=byJudgment.get(c.id),p=parseEvalAnswer(r?.answer);lines.push(`### ${c.id} — ${c.category}`,'',`Question: ${escape(c.question)}`,`Expected: ${escape(c.expectedAnswer)}`,`Required labels: ${escape(JSON.stringify(c.expectedSources))}; relevant chunks: ${escape(JSON.stringify(c.relevantChunks))}.`,`Expected calculation rows: ${escape(JSON.stringify(c.expectedRows??null))}.`);
 if(!r||!j||!r.executed){lines.push('Actual response: **not run**. No outcome or accuracy claim.','');continue;}
 lines.push(`Automatic: **${j.automatic}**. Final classification: **${j.status}**. Human: ${j.human}.`,`Reasons: ${escape([...j.reasons,...j.uncertainty].join('; ')||'Canonical missing-evidence refusal contract passed.')}`,`Error categories: ${escape(j.categories.join(', ')||'none')}; uncertain causes: ${escape(j.suspects.join(', ')||'none')}.`);
 if(r.error)lines.push(`Safe execution error: ${escape(JSON.stringify(r.error))}.`);
 if(p.success){lines.push(`Actual response (scripted=${mode==='mock'}): ${escape(p.data.answer)}`,`grounded=${p.data.grounded}; response hash=${j.answerHash}.`,'','| Citation | Source identity | Reported supporting quotes |','| --- | --- | --- |');for(const s of p.data.sources)lines.push(`| ${s.id} | ${escape(s.type==='csv'?`${s.filename}, dataset ${s.datasetId}`:`${s.filename}, document ${s.documentId}, chunk ${s.chunkId}`)} | ${escape(s.quotes.join(' / '))} |`);if(!p.data.sources.length)lines.push('| none | none | none |');for(const check of j.checkedCSV)lines.push(`Independent CSV check ${check.sourceId}: ${check.matches?'matches':'MISMATCH'}; computed rows: ${escape(JSON.stringify(check.expectedRows))}.`);}
 if(j.review)lines.push(`Reviewer notes: ${escape(j.review.notes)}`);lines.push('');}
 lines.push('## Limitations','','- Source identity/quote membership verifies provenance, not claim entailment. Document, numeric and CSV checks are independently visible in results.json. Semantic accuracy is deliberately unreported without completed human review.','- CSV oracle independently parses fictional rows and performs filters, aggregates, groups and sorting. It shares structural plan validation only; it never executes SQL. Unsorted row order is ignored, while sorted order, duplicates, nulls and numeric tolerance are checked. Original authored expected rows are also asserted before execution.','- Numeric extraction remains case-specific and incomplete. Missing extraction needs review; exact quotes can accompany false prose. Wrong units, negation, omitted conditions, unsupported extrapolation and incorrectly resolved conflicts require the rubric.','- Current backend returns source-level quotes rather than a machine-verifiable claim proof. Human reviewers must inspect local citation markers against claims and canonical fixtures.','- All data are fictional. Operator fixture identity is not a browser/session test. Existing isolation/security regressions cover application boundaries separately.','- Live mode is opt-in, one case by default, maximum three per invocation, 65 seconds between cases, at most 12 actual Groq HTTP attempts per run including existing retries. Existing provider pacing/timeouts remain unchanged. No runner retries or provider fallback. Multiple processes do not share this evaluation budget.','- Results remain probabilistic and small-sample. Error counts are framework diagnostics in mock mode, never model failure rates. Saved-result review makes no provider calls and does not repeat original stage measurements.','');return lines.join('\n');
}
export async function runAnswerQuality(args:string[]){
 const options=answerOptions(args),controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 let results:CaseResult[]=[],metadata:Record<string,unknown>={mode:options.mode,fixtureHash,generatedAt:new Date().toISOString(),groqAttempts:0};
 try{
  // Independent fixture self-checks fail before any provider work.
  for(const c of cases){if(c.plan&&!sameRows(oracleQuery(c.plan),c.expectedRows??[],Boolean(c.plan.sort)))throw Error('Authored CSV oracle disagreement');const derived=independentCombinedFacts(c.id);if(derived&&c.facts.some(f=>Math.abs(derived[f.label]-f.value)>f.tolerance))throw Error('Authored comparison oracle disagreement');}
  const reviews=options.reviews?reviewFileSchema.parse(JSON.parse(await readFile(options.reviews,'utf8'))):[];
  if(reviews.some(r=>!cases.some(c=>c.id===r.caseId)))throw Error('Unknown review case');
  if(options.input){
   const saved=savedSchema.parse(JSON.parse(await readFile(options.input,'utf8')));if(new Set(saved.results.map(r=>r.id)).size!==saved.results.length)throw Error('Duplicate saved cases');metadata={...saved.metadata,reviewedAt:new Date().toISOString(),replayed:true};
   results=saved.results.map(r=>{const c=cases.find(c=>c.id===r.id);if(!c)throw Error('Unknown saved case');const parsed=parseEvalAnswer(r.answer);if(r.answer!==undefined&&!parsed.success)throw Error('Invalid saved answer');const score=parsed.success?scoreAnswer(c,parsed.data):null;return {...r,error:r.error?{category:r.error.category,errorType:r.error.errorType,reason:r.error.reason,httpStatus:r.error.httpStatus}:null,category:c.category,system:c.system,expectedRefusal:c.refuse,status:score?.status??'needs-review',score,answer:parsed.success?parsed.data:undefined,retrieval:[],stages:[]};});
  }else {try{await answerNetwork(options.mode==='live',async counts=>{
   let adapter=mockAdapter;
   if(options.mode==='live'){
    const {getChatConfig}=await import('../src/lib/ai-provider');const config=getChatConfig();if(config.provider!=='groq')throw Error('Configured provider is not Groq');metadata.provider=config.provider;metadata.model=config.model;
    const {databaseAdapter}=await import('./database-adapter');adapter=await databaseAdapter('live',options.retrieval,controller.signal);
   }
   try{results=await runEvaluation(options.selected,adapter,{signal:controller.signal,intervalMs:options.mode==='live'?65_000:0});}finally{metadata.groqAttempts=counts.groqAttempts;}
  });}catch(error){metadata.setupError=safeError(error);process.exitCode=1;results=options.selected.map(c=>({id:c.id,category:c.category,system:c.system,expectedRefusal:c.refuse,executed:false,status:'needs-review',durationMs:null,answerDurationMs:null,score:null,retrieval:[],stages:[],error:null}));}}
  const map=new Map<string,Review>(reviews.map(r=>[r.caseId,r]));
  const judgments=results.map(r=>evaluateAnswer(cases.find(c=>c.id===r.id) as EvalCase,r,map.get(r.id)));
  const secrets=Object.entries(process.env).filter(([key,v])=>/KEY|TOKEN|PASSWORD|SECRET|DATABASE_URL/i.test(key)&&v&&v.length>=8).map(([,v])=>v!);
  try{const password=decodeURIComponent(new URL(process.env.DATABASE_URL??'').password);if(password.length>=8)secrets.push(password);}catch{}
  const bundle=redactSecrets({metadata,summary:answerSummary(judgments),results,judgments},secrets);
  await mkdir(options.directory,{recursive:true});
  for(const [name,data] of [['results.json',JSON.stringify(bundle,null,2)+'\n'],['report.md',render(String(bundle.metadata.mode),bundle.results,bundle.judgments,bundle.metadata)]] as const){const file=path.join(options.directory,name);await writeFile(file+'.tmp',data,{mode:0o600});await rename(file+'.tmp',file);}
  const template=results.filter(r=>parseEvalAnswer(r.answer).success).map(r=>({caseId:r.id,fixtureHash,answerHash:answerHash(r.answer),reviewer:'',notes:'',dimensions:Object.fromEntries(dimensions.map(d=>[d,'needs-review']))}));
  await writeFile(path.join(options.directory,'review-template.json'),JSON.stringify(template,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({mode:metadata.mode,groqAttempts:metadata.groqAttempts,...bundle.summary}));
  if(bundle.summary.fail||controller.signal.aborted)process.exitCode=1;
 }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);if(options.mode==='live'){const {default:pool}=await import('../src/lib/db');await pool.end();}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runAnswerQuality(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({evaluation:'answer-quality',outcome:'failed',...safeError(error)}));process.exitCode=1;});

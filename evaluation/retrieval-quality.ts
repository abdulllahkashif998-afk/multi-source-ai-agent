import {createHash} from 'node:crypto';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import pool from '../src/lib/db';
import {generateEmbedding} from '../src/lib/embeddings';
import {searchDocuments,type DocumentSearchResult} from '../src/lib/search-documents';
import {selectEvidence} from '../src/lib/rag-answer';
import {runWithIdentity} from '../src/lib/identity';
import {safeError} from '../src/lib/reliability';
import {documents,corpusDocuments,owner,cases,datasets} from './fixtures';
import {withFixtureDatabase} from './isolation';
import {captureStages} from './database-adapter';
import {redactSecrets} from './report';
import {retrievalCases,retrievalDocuments,baselineDecoys} from './retrieval-fixtures';
import {rankingMetrics,aggregateRankings} from './retrieval-metrics';
export type Mode='semantic'|'hybrid';
export interface ResultRow {chunkId:string;documentId:string;similarity:number|null;semanticRank?:number;keywordRank?:number;rrfScore?:number}
export interface Observation {mode:Mode;repetition:number;durationMs:number;rows:ResultRow[];ranked:string[];eligible:string[];scopeViolations:string[];metadataViolations:string[];rawMetrics:ReturnType<typeof rankingMetrics>;eligibleMetrics:ReturnType<typeof rankingMetrics>;error?:ReturnType<typeof safeError>}
export interface Comparison {id:string;cohort:'original'|'stress';question:string;tags:string[];owner:string;relevant:string[];labelNotes:string;corpusHash:string;authorizedChunks:number;observations:Observation[];error?:ReturnType<typeof safeError>}
export async function retrievalOnlyNetwork<T>(work:()=>Promise<T>,base=process.env.OLLAMA_BASE_URL??'http://localhost:11434'){
 const original=globalThis.fetch,allowed=new Set([`${base}/api/embed`,`${base}/api/tags`]);
 globalThis.fetch=(input,init)=>{const url=input instanceof Request?input.url:String(input);if(!allowed.has(url))return Promise.reject(new Error('Retrieval evaluation blocks non-Ollama HTTP requests'));return original(input,init);};
 try{return await work();}finally{globalThis.fetch=original;}
}
export function summarizeComparisons(results:Comparison[]){
 const groups=['original','stress'] as const;
 return Object.fromEntries(groups.map(cohort=>{const group=results.filter(r=>r.cohort===cohort);return [cohort,{questions:group.length,positiveQuestions:group.filter(r=>r.relevant.length).length,failedSetups:group.filter(r=>r.error).length,modes:Object.fromEntries((['semantic','hybrid'] as const).map(mode=>{const observations=group.flatMap(r=>r.observations.filter(o=>o.mode===mode).map(o=>({...o,relevant:r.relevant})));return [mode,{...aggregateRankings(observations),errors:observations.filter(o=>o.error).length,scopeViolations:observations.reduce((n,o)=>n+o.scopeViolations.length,0),metadataViolations:observations.reduce((n,o)=>n+o.metadataViolations.length,0),unstableQuestions:group.filter(r=>{const signatures=r.observations.filter(o=>o.mode===mode).map(o=>JSON.stringify(o.ranked));return new Set(signatures).size>1;}).length}];}))}];}));
}
export function parseRetrievalOptions(args:string[]){
 const values=new Map<string,string>();for(let i=0;i<args.length;i+=2){if(!['--out','--repetitions','--suite'].includes(args[i])||!args[i+1]||values.has(args[i]))throw Error('Invalid retrieval evaluation arguments');values.set(args[i],args[i+1]);}
 const repetitions=Number(values.get('--repetitions')??3),suite=values.get('--suite')??'all';if(!Number.isInteger(repetitions)||repetitions<1||repetitions>5||!['all','original','stress'].includes(suite))throw Error('Invalid retrieval evaluation bounds');
 const directory=path.resolve(values.get('--out')??'docs/evaluation/retrieval-quality-data');if(![path.resolve('docs/evaluation'),path.resolve('.evaluation-results')].some(root=>directory.startsWith(root+path.sep)))throw Error('Use an evaluation output subdirectory');
 return {repetitions,suite,directory};
}
function comparisonMarkdown(metadata:Record<string,unknown>,results:Comparison[]){
 const summaries=summarizeComparisons(results);const fmt=(v:number|null)=>v===null?'N/A':v.toFixed(4);
 const lines=['# Real retrieval measurements','','No LLM calls. These are retrieval measurements, not answer accuracy.',`Metadata: ${JSON.stringify(metadata)}`,'','## Aggregate raw service metrics','','| Cohort | Mode | Questions / labelled | R@1 | P@1 | R@3 | P@3 | MRR@3 | Hit@3 | p50 ms | p95 ms |','| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
 for(const [cohort,summary] of Object.entries(summaries))for(const [mode,m] of Object.entries(summary.modes))lines.push(`| ${cohort} | ${mode} | ${summary.questions} / ${summary.positiveQuestions} | ${fmt(m.raw.recall1.value)} | ${fmt(m.raw.precision1.value)} | ${fmt(m.raw.recall3.value)} | ${fmt(m.raw.precision3.value)} | ${fmt(m.raw.mrr3.value)} | ${fmt(m.raw.hitRate3.value)} | ${fmt(m.latencyMs.p50)} | ${fmt(m.latencyMs.p95)} |`);
 lines.push('','## Per-question paired comparisons','','Ranked IDs are chunk IDs. Differences between repeated rankings are reported in JSON. Raw retrieval does not mean every candidate is sufficient evidence.','','| Case | Gold | Semantic raw / eligible | Hybrid raw / eligible | Semantic / hybrid RR@3 | Missed S / H |','| --- | --- | --- | --- | --- | --- |');
 for(const r of results){const s=r.observations.find(o=>o.mode==='semantic'),h=r.observations.find(o=>o.mode==='hybrid');const sm=rankingMetrics(s?.ranked??[],r.relevant),hm=rankingMetrics(h?.ranked??[],r.relevant);lines.push(`| ${r.id} | ${r.relevant.join(',')||'none'} | ${s?.ranked.join(',')||'none'} / ${s?.eligible.join(',')||'none'} | ${h?.ranked.join(',')||'none'} / ${h?.eligible.join(',')||'none'} | ${fmt(sm.reciprocalRank3)} / ${fmt(hm.reciprocalRank3)} | ${sm.missed.join(',')||'none'} / ${hm.missed.join(',')||'none'} |`);}
 lines.push('','## Cases and labels','',...results.flatMap(r=>[`- **${r.id}** (${r.tags.join(', ')}): ${r.question}`,`  Label rationale: ${r.labelNotes}`]),'','## Definitions','','R@K and P@K use unique relevant hits, with K as the precision denominator. Empty-gold queries are excluded from labelled means and reported separately. MRR is truncated at 3 because the service exposes at most three results; zero when no gold chunk appears. Hit@3 needs one relevant chunk, not all relevant chunks. Each question has the same number of repetitions, so macro means over observations weight questions equally. Failed retrieval calls count as empty results for labelled metrics and are also reported as errors. Setup failures have no observations and are disclosed separately.','Latency includes actual BGE embedding, PostgreSQL and ranking work, excluding fixture setup/corpus embeddings. Orders alternate between repetitions and questions. Percentiles use nearest rank; repeated warm measurements are not independent production load samples. Raw outputs and downstream selectEvidence-eligible outputs are both stored; semantic raw results are not threshold-filtered by searchDocuments, whereas hybrid already applies its branch eligibility rules.','The original and stress cohorts have different corpora, so compare modes within a cohort, not one cohort against the other. All fixture text is fictional. No source text from existing public records is used.');
 return lines.join('\n')+'\n';
}
export async function runRetrievalQuality(args:string[]){
 const options=parseRetrievalOptions(args),selected=retrievalCases.filter(c=>options.suite==='all'||c.cohort===options.suite),results:Comparison[]=[];
 const controller=new AbortController(),abort=()=>controller.abort();process.once('SIGINT',abort);process.once('SIGTERM',abort);
 const originalHash=createHash('sha256').update(JSON.stringify({cases,documents,datasets},null,2)+'\n').digest('hex');
 const minSimilarity=Number(process.env.RAG_MIN_SIMILARITY??'.5');
 if(!Number.isFinite(minSimilarity)||minSimilarity<0||minSimilarity>1)throw Error('Invalid existing retrieval threshold');
 const metadata:Record<string,unknown>={schemaVersion:1,kind:'real-retrieval-only',generatedAt:new Date().toISOString(),originalBenchmarkHash:originalHash,repetitions:options.repetitions,modeOrder:'alternating question/repetition',minSimilarity,node:process.versions.node,embeddingModel:process.env.EMBEDDING_MODEL??'hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0',embeddingDimensions:768,llmRequests:0};
 try{await retrievalOnlyNetwork(async()=>{
  metadata.postgres=(await pool.query('SHOW server_version')).rows[0].server_version;metadata.pgvector=(await pool.query("SELECT extversion FROM pg_extension WHERE extname='vector'")).rows[0].extversion;
  // This read-only service metadata is optional; no model is pulled or changed.
  try{const response=await fetch(`${process.env.OLLAMA_BASE_URL??'http://localhost:11434'}/api/tags`,{signal:AbortSignal.timeout(5000)});const tags=await response.json();const model=tags.models?.find((m:{name:string;model:string})=>m.name===metadata.embeddingModel||m.model===metadata.embeddingModel);if(model)metadata.embeddingDigest=model.digest;}catch{metadata.embeddingDigest='unavailable';}
  const embeddings=new Map<string,number[]>();
  for(const d of [...documents,...retrievalDocuments])if(!embeddings.has(d.text))embeddings.set(d.text,await generateEmbedding(d.text,controller.signal));
  await generateEmbedding('Fictional retrieval benchmark warmup.',controller.signal);
  for(const [caseIndex,c] of selected.entries()){
   if(controller.signal.aborted)break;
   const extras=c.cohort==='stress'?retrievalDocuments:[],corpus=[...corpusDocuments(c.fixture.corpus).map(d=>({...d,userId:owner,status:'ready'})),...extras.map(d=>({...d,userId:d.userId??owner,status:d.status??'ready'})),...baselineDecoys.map(d=>({...d,userId:d.userId??owner,status:d.status??'ready'}))];
   const allowed=new Map(corpus.filter(d=>d.userId===c.userId&&d.status==='ready').map(d=>[String(d.chunkId),d]));
   const result:Comparison={id:c.id,cohort:c.cohort,question:c.fixture.question,tags:c.tags,owner:c.userId,relevant:c.fixture.relevantChunks,labelNotes:c.labelNotes,corpusHash:createHash('sha256').update(JSON.stringify(corpus)).digest('hex'),authorizedChunks:allowed.size,observations:[]};
   try{await runWithIdentity(c.userId,()=>withFixtureDatabase(c.fixture,embeddings,()=>captureStages({retrieval:()=>{},answer:()=>{},stage:()=>{}},async()=>{
    for(let repetition=0;repetition<options.repetitions;repetition++)for(const mode of ((caseIndex+repetition)%2?['hybrid','semantic']:['semantic','hybrid']) as Mode[]){
     controller.signal.throwIfAborted();const start=performance.now();let rows:DocumentSearchResult[]=[],error:Observation['error'];
     try{rows=await searchDocuments(c.fixture.question,controller.signal,{mode});}catch(e){error=safeError(e);}
     const scopeViolations=rows.filter(r=>!allowed.has(r.chunk_id)).map(r=>r.chunk_id),metadataViolations=rows.filter(r=>{const d=allowed.get(r.chunk_id);return d&&(r.document_id!==d.id||r.filename!==d.filename||r.chunk_index!==d.index||r.page_number!==d.page||r.chunk_text!==d.text);}).map(r=>r.chunk_id);
     const ranked=rows.map(r=>r.chunk_id),eligible=selectEvidence(rows,minSimilarity).map(r=>r.chunkId);
     result.observations.push({mode,repetition:repetition+1,durationMs:performance.now()-start,rawMetrics:rankingMetrics(ranked,c.fixture.relevantChunks),eligibleMetrics:rankingMetrics(eligible,c.fixture.relevantChunks),rows:rows.map(r=>({chunkId:r.chunk_id,documentId:r.document_id,similarity:r.similarity,semanticRank:r.semantic_rank,keywordRank:r.keyword_rank,rrfScore:r.rrf_score})),ranked,eligible,scopeViolations,metadataViolations,...(error?{error}:{})});
    }
   }),extras));}catch(error){result.error=safeError(error);}
   results.push(result);console.log(JSON.stringify({case:c.id,completed:results.length,total:selected.length}));
  }
 });}catch(error){metadata.error=safeError(error);process.exitCode=1;}
 finally{
  metadata.interrupted=controller.signal.aborted;metadata.planned=selected.length;metadata.completed=results.length;
  const secrets=[process.env.DATABASE_URL,process.env.GROQ_API_KEY,process.env.GOOGLE_GENERATIVE_AI_API_KEY].filter((v):v is string=>Boolean(v));
  const output=redactSecrets({metadata,summary:summarizeComparisons(results),cases:results},secrets);
  await mkdir(options.directory,{recursive:true});for(const [file,content] of [['results.json',JSON.stringify(output,null,2)+'\n'],['report.md',comparisonMarkdown(output.metadata,output.cases)],['fixtures.json',JSON.stringify({original:{cases,documents,datasets},baselineDecoys,additionalDocuments:retrievalDocuments,additionalCases:retrievalCases.filter(c=>c.cohort==='stress')},null,2)+'\n']]){await writeFile(path.join(options.directory,file+'.tmp'),content,{mode:0o600});await rename(path.join(options.directory,file+'.tmp'),path.join(options.directory,file));}
  if(results.some(r=>r.error||r.observations.some(o=>o.error||o.scopeViolations.length||o.metadataViolations.length))||controller.signal.aborted)process.exitCode=1;
  process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);await pool.end();
 }
 return results;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runRetrievalQuality(process.argv.slice(2)).catch(()=>{console.error('Retrieval evaluation failed; no raw error or provider data was logged.');process.exitCode=1;});

import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import os from 'node:os';
import pool from '../src/lib/db';
import {generateEmbedding} from '../src/lib/embeddings';
import {searchDocuments} from '../src/lib/search-documents';
import {discoverDatasets,queryDataset} from '../src/lib/generic-csv';
import {createAgentSession} from '../src/lib/agent-tools';
import {createAgentTrace} from '../src/lib/agent-diagnostics';
import {createProviderTransport} from '../src/lib/provider-transport';
import {runWithIdentity} from '../src/lib/identity';
import {safeError} from '../src/lib/reliability';
import {cases,documents,owner,corpusDocuments} from './fixtures';
import {fixtureHash} from './answer-quality';
import {withFixtureDatabase} from './isolation';
import {captureStages} from './database-adapter';
import {retrievalOnlyNetwork} from './retrieval-quality';
import {distribution} from './metrics';
import {oracleQuery,sameRows} from './answer-oracle';
import {redactSecrets} from './report';
import {runFaultScenarios,type FaultResult} from './reliability-scenarios';
import type {Stage} from './runner';
export interface Timing {component:string;iteration:number;durationMs:number;ok:boolean;stages:Stage[];error?:ReturnType<typeof safeError>}
export function performanceOptions(args:string[]){
 const v=new Map<string,string>();for(let i=0;i<args.length;i+=2){if(!['--mode','--samples','--out'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--')||v.has(args[i]))throw Error('Invalid benchmark arguments');v.set(args[i],args[i+1]);}
 const mode=v.get('--mode')??'offline',samples=Number(v.get('--samples')??30),directory=path.resolve(v.get('--out')??`.evaluation-results/performance-${mode}`);
 if(!['offline','local'].includes(mode)||!Number.isInteger(samples)||samples<10||samples>50)throw Error('Benchmark bounds: offline/local, 10 to 50 serial samples');
 if(![path.resolve('.evaluation-results'),path.resolve('docs/evaluation')].some(root=>directory.startsWith(root+path.sep)))throw Error('Use an evaluation output subdirectory');
 return {mode:mode as 'offline'|'local',samples,directory};
}
export function timingSummary(rows:Timing[]){return Object.fromEntries([...new Set(rows.map(r=>r.component))].sort().map(component=>{const group=rows.filter(r=>r.component===component);return [component,{attempted:group.length,failed:group.filter(r=>!r.ok).length,latencyMs:distribution(group.filter(r=>r.ok).map(r=>r.durationMs))}];}));}
export async function wallClockPacing(provider:'gemini'|'groq',rpm:number,signal:AbortSignal){
 const starts:number[]=[],errors:ReturnType<typeof safeError>[]=[];const beginning=performance.now();
 const fetch=createProviderTransport({provider,rpm,fetch:async()=>{starts.push(performance.now()-beginning);return Response.json({ok:true});}});
 // Provider responses are injected; only the actual application pacing timers run.
 for(let i=0;i<3;i++){signal.throwIfAborted();try{await fetch('https://provider.invalid',{signal});}catch(error){errors.push(safeError(error));}}
 const gaps=starts.slice(1).map((v,i)=>v-starts[i]);return {kind:'real-wall-clock-with-stub-responses',provider,rpm,requiredSpacingMs:60000/rpm,attempts:starts.length,startsMs:starts,gapsMs:gaps,gapDistribution:distribution(gaps),errors,externalProviderRequests:0};
}
function generatedMarkdown(data:{metadata:Record<string,unknown>;timings:Timing[];reliability:FaultResult[];pacing:unknown}){
 const fmt=(n:number|null)=>n===null?'N/A':n.toFixed(3);
 return ['# Performance and reliability measurement artifacts','',`Mode: ${data.metadata.mode}; generated: ${data.metadata.generatedAt}; external LLM requests: 0.`,data.metadata.mode==='offline'?'OFFLINE: all fault clocks/responses are simulated. No local service latency was measured.':'LOCAL: real Ollama and PostgreSQL timings. Tool decisions and final answer text are scripted; no planning/generation latency was measured.','',...(data.metadata.setupError?[`Setup error: ${JSON.stringify(data.metadata.setupError)}. Incomplete run; no success claim.`]:[]),'','## Local component distributions','','| Component | Attempts | Errors | Samples | Min ms | p50 ms | p95 ms | Max ms |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',...Object.entries(timingSummary(data.timings)).map(([key,v])=>`| ${key} | ${v.attempted} | ${v.failed} | ${v.latencyMs.n} | ${fmt(v.latencyMs.min)} | ${fmt(v.latencyMs.p50)} | ${fmt(v.latencyMs.p95)} | ${fmt(v.latencyMs.max)} |`),'','## Simulated faults','','| Scenario | Stage | Passed | Observed |','| --- | --- | --- | --- |',...data.reliability.map(r=>`| ${r.id} | ${r.stage} | ${r.passed} | ${JSON.stringify(r.observed)} |`),'','## Real-timer pacing with injected provider responses','',JSON.stringify(data.pacing,null,2),'','See ../performance-reliability.md for methodology, environment, stage limits, failure analysis and regression results. Service timings exclude corpus embedding/setup and warmups. Successful timing distributions exclude failed samples, which are counted separately. Nearest-rank percentiles; serial warm fictional corpus only. Overlapping stages must not be summed. No provider throughput, concurrency or AI quality conclusion is justified.',''].join('\n');
}
export async function runPerformance(args:string[]){
 const options=performanceOptions(args),controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 const timings:Timing[]=[],metadata:Record<string,unknown>={mode:options.mode,generatedAt:new Date().toISOString(),fixtureHash,node:process.versions.node,samplesPerComponent:options.mode==='local'?options.samples:0,warmups:options.mode==='local'?2:0,externalLLMRequests:0,machine:{platform:os.platform(),release:os.release(),architecture:os.arch(),cpuModel:os.cpus()[0]?.model,logicalCpus:os.cpus().length,availableParallelism:os.availableParallelism(),memoryGiB:Math.round(os.totalmem()/1024**3*100)/100},memoryRssStartMiB:process.memoryUsage().rss/1024**2};
 let reliability:FaultResult[]=[],pacing:unknown=null;
 const sample=async(component:string,iteration:number,work:()=>Promise<unknown>)=>{
  const stages:Stage[]=[];await captureStages({stage:v=>stages.push(v),retrieval:()=>{},answer:()=>{}},async()=>{const start=performance.now();try{await work();timings.push({component,iteration,durationMs:performance.now()-start,ok:true,stages});}catch(error){timings.push({component,iteration,durationMs:performance.now()-start,ok:false,stages,error:safeError(error)});}});
 };
 try{
  reliability=await runFaultScenarios();
  if(options.mode==='local')await retrievalOnlyNetwork(async()=>{
   metadata.postgres=(await pool.query('SHOW server_version')).rows[0].server_version;metadata.pgvector=(await pool.query("SELECT extversion FROM pg_extension WHERE extname='vector'")).rows[0].extversion;
   metadata.embeddingModel=process.env.EMBEDDING_MODEL??'hf.co/CompendiumLabs/bge-base-en-v1.5-gguf:Q8_0';metadata.embeddingDimensions=768;
   try{const res=await fetch(`${process.env.OLLAMA_BASE_URL??'http://localhost:11434'}/api/tags`,{signal:AbortSignal.timeout(5000)});const tags=await res.json();metadata.embeddingDigest=tags.models?.find((v:{name:string;model:string})=>v.name===metadata.embeddingModel||v.model===metadata.embeddingModel)?.digest??'unavailable';}catch{metadata.embeddingDigest='unavailable';}
   const setup=performance.now(),embeddings=new Map<string,number[]>();for(const d of documents){controller.signal.throwIfAborted();embeddings.set(d.text,await generateEmbedding(d.text,controller.signal));}metadata.corpusEmbeddingSetupMs=performance.now()-setup;
   const base=cases[0],allowed=new Set(corpusDocuments(base.corpus).map(d=>String(d.chunkId))),csv=cases.filter(c=>c.category==='csv'),combined=cases.find(c=>c.id==='combined-01')!;
   metadata.fixture={authorizedReadyChunks:allowed.size,datasets:3,rows:11,storage:'temporary tables, no public defaults/indexes/files'};
   const cutoff=Number(process.env.RAG_MIN_SIMILARITY??'.5');if(!Number.isFinite(cutoff)||cutoff<0||cutoff>1)throw Error('Invalid configured cutoff');
   const scopedSearch=async(question:string,signal:AbortSignal,mode:'semantic'|'hybrid')=>{const rows=await searchDocuments(question,signal,{mode});assert.ok(rows.every(r=>allowed.has(r.chunk_id)));assert.ok(rows.length>0);return rows;};
   await runWithIdentity(owner,()=>withFixtureDatabase(base,embeddings,async()=>{
    const workflow=async(iteration:number)=>{
     const trace=createAgentTrace(),session=createAgentSession({search:(q,s)=>scopedSearch(q,s,'hybrid'),discover:()=>discoverDatasets(owner),query:p=>queryDataset(owner,p)},controller.signal,cutoff,trace);
     for(const [name,input] of [['searchDocuments',{question:'What is the minimum monthly total sales target for each team?'}],['discoverDatasets',{}],['inspectDataset',{datasetId:'201'}],['queryDataset',combined.plan!]] as const){const result=await session.execute(name,input);assert.ok(!('error' in result));}
     const evidence=session.evidence(),document=evidence.documents.find(d=>d.chunkId==='101'),csvSource=evidence.csv[0];assert.ok(document&&csvSource);assert.ok(sameRows(csvSource.rows,oracleQuery(combined.plan),true));
     const finalize=()=>{const answer=session.finalize({answerable:true,statements:[{text:combined.expectedAnswer,citations:[{sourceId:document.id,quote:document.text},{sourceId:csvSource.id,quote:csvSource.text}]}]});assert.equal(answer.grounded,true);assert.equal(answer.sources.length,2);};
     if(iteration>0)await sample('citation-verification',iteration,async()=>finalize());else finalize();
     trace.flush('grounded');
    };
    await captureStages({stage:()=>{},retrieval:()=>{},answer:()=>{}},async()=>{for(let w=0;w<2;w++){await generateEmbedding(base.question,controller.signal);for(const mode of ['semantic','hybrid'] as const)await scopedSearch(base.question,controller.signal,mode);for(const c of csv)await queryDataset(owner,c.plan);await discoverDatasets(owner);await workflow(0);}});
    for(let iteration=1;iteration<=options.samples;iteration++){
     controller.signal.throwIfAborted();const question=cases.filter(c=>c.category==='document')[(iteration-1)%6].question;
     await sample('embedding',iteration,()=>generateEmbedding(question,controller.signal));
     for(const mode of (iteration%2?['semantic','hybrid']:['hybrid','semantic']) as Array<'semantic'|'hybrid'>)await sample(`retrieval-${mode}`,iteration,()=>scopedSearch(question,controller.signal,mode));
     for(const c of csv)await sample(`csv-${c.id}`,iteration,async()=>{const rows=await queryDataset(owner,c.plan);assert.ok(sameRows(rows,oracleQuery(c.plan),Boolean(c.plan?.sort)));});
     await sample('dataset-discovery',iteration,async()=>{assert.equal((await discoverDatasets(owner)).length,3);});
     await sample('scripted-tool-workflow',iteration,()=>workflow(iteration));
     console.log(JSON.stringify({benchmark:'local',completed:iteration,total:options.samples}));
    }
   }));
   const provider=process.env.AI_PROVIDER??'gemini';if(provider!=='gemini'&&provider!=='groq')throw Error('Invalid configured provider');
   const rpm=Number(provider==='gemini'?process.env.GEMINI_REQUESTS_PER_MINUTE??12:process.env.GROQ_REQUESTS_PER_MINUTE??12);
   await captureStages({stage:()=>{},retrieval:()=>{},answer:()=>{}},async()=>{pacing=await wallClockPacing(provider,rpm,controller.signal);});
  });
 }catch(error){metadata.setupError=safeError(error);process.exitCode=1;}
 finally{
  metadata.interrupted=controller.signal.aborted;metadata.memoryRssEndMiB=process.memoryUsage().rss/1024**2;
  const stageRows=timings.flatMap(t=>t.stages.map(s=>({component:s.tool?`${s.stage}:${s.tool}`:s.stage,iteration:t.iteration,durationMs:s.durationMs,ok:['ok','grounded'].includes(s.outcome),stages:[]})));
  const secrets=Object.entries(process.env).filter(([k,v])=>/KEY|TOKEN|PASSWORD|SECRET|DATABASE_URL/i.test(k)&&v&&v.length>=8).map(([,v])=>v!);
  try{const password=decodeURIComponent(new URL(process.env.DATABASE_URL??'').password);if(password.length>=8)secrets.push(password);}catch{}
  const data=redactSecrets({metadata,timings,summary:timingSummary(timings),stageSummary:timingSummary(stageRows),reliability,pacing},secrets);
  try{await mkdir(options.directory,{recursive:true});for(const [name,contents] of [['results.json',JSON.stringify(data,null,2)+'\n'],['report.md',generatedMarkdown(data)]] as const){const file=path.join(options.directory,name);await writeFile(file+'.tmp',contents,{mode:0o600});await rename(file+'.tmp',file);}console.log(JSON.stringify({mode:options.mode,samples:timings.length,failed:timings.filter(t=>!t.ok).length,reliabilityPassed:reliability.filter(r=>r.passed).length,reliabilityTotal:reliability.length,externalLLMRequests:0}));if(timings.some(t=>!t.ok)||reliability.some(r=>!r.passed))process.exitCode=1;}
  finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);await pool.end();}
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runPerformance(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({evaluation:'performance-reliability',outcome:'failed',...safeError(error)}));process.exitCode=1;});

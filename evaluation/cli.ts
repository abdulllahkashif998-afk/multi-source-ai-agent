import {createHash} from 'node:crypto';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {cases,documents,datasets} from './fixtures';
import {parseOptions} from './options';
import {runEvaluation,type CaseResult} from './runner';
import {writeReports,type Metadata} from './report';
import {mockAdapter} from './mock-adapter';
import {safeError} from '../src/lib/reliability';
import pool from '../src/lib/db';
async function main(){
 const options=parseOptions(process.argv.slice(2));const controller=new AbortController();const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 const fixtureData=JSON.stringify({cases,documents,datasets},null,2)+'\n';
 const metadata:Metadata={schemaVersion:1,mode:options.mode,qualityClaimsAllowed:options.mode!=='mock',fixtureHash:createHash('sha256').update(fixtureData).digest('hex'),generatedAt:new Date().toISOString(),k:options.k,answerRetrievalMode:options.retrieval,node:process.versions.node,setupDurationMs:0,selectedCases:options.selected.map(c=>c.id),interrupted:false};let results:CaseResult[]=[];
 const start=performance.now();
 try{
  let adapter=mockAdapter;
  if(options.mode!=='mock'){
   if(options.mode==='live'){const {getChatConfig}=await import('../src/lib/ai-provider');const {provider,model}=getChatConfig();metadata.provider=provider;metadata.model=model;}
   const {databaseAdapter}=await import('./database-adapter');adapter=await databaseAdapter(options.mode,options.retrieval,controller.signal);
  }
  metadata.setupDurationMs=performance.now()-start;
  results=await runEvaluation(options.selected,adapter,{k:options.k,signal:controller.signal,intervalMs:options.mode==='live'?65_000:0});
 }catch(error){metadata.setupDurationMs=performance.now()-start;metadata.setupError=safeError(error);results=options.selected.map(c=>({id:c.id,category:c.category,system:c.system,expectedRefusal:c.refuse,executed:false,status:'needs-review',durationMs:null,answerDurationMs:null,score:null,retrieval:[],stages:[],error:null}));process.exitCode=1;}
 finally{
  metadata.interrupted=controller.signal.aborted;
  const secrets=Object.entries(process.env).filter(([key,value])=>/KEY|TOKEN|PASSWORD|SECRET|DATABASE_URL/i.test(key)&&value&&value.length>=8).map(([,value])=>value!);
  try{const password=decodeURIComponent(new URL(process.env.DATABASE_URL??'').password);if(password.length>=8)secrets.push(password);}catch{}
  try{await mkdir(options.directory,{recursive:true});await writeFile(path.join(options.directory,'fixtures.json.tmp'),fixtureData,{mode:0o600});await rename(path.join(options.directory,'fixtures.json.tmp'),path.join(options.directory,'fixtures.json'));
  const report=await writeReports(options.directory,metadata,results,secrets);
  console.log(JSON.stringify({mode:metadata.mode,qualityClaimsAllowed:metadata.qualityClaimsAllowed,...report.summary,output:options.directory}));
  if(metadata.interrupted||report.summary.fail)process.exitCode=1;
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);await pool.end();}
 }
}
main().catch(()=>{console.error('Evaluation could not complete. Check configuration and report output permissions; no raw error was logged.');process.exitCode=1;});

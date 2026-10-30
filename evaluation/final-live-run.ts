import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import {cases} from './fixtures';
import {fixtureHash} from './answer-quality';
import {nextLiveBatch,remainingLiveBatch,evaluationStopReason} from './live-batch-plan';
import {initializeLiveLedger,type LiveLedger} from './live-request-guard';
async function main(){
 const scope=process.argv[2];if(!['all','pilot','batch-02','remaining-17'].includes(scope)||process.argv[3]!=='--approved')throw Error('Requires explicit approved scope');
 const saved=JSON.parse(await readFile(scope==='remaining-17'?'docs/evaluation/final-live/batch-02/cumulative-results.json':'docs/evaluation/final-live/results.json','utf8'));
 const completed=saved.cases.filter((c:{executed:boolean})=>c.executed).map((c:{benchmark:{id:string}})=>c.benchmark.id) as string[];
 const batch=scope==='remaining-17'?remainingLiveBatch(completed,saved.fixtureHash):scope==='batch-02'?nextLiveBatch(completed,saved.fixtureHash):null;
 const selected=batch?.selected??(scope==='all'?cases:cases.filter(c=>['doc-01','csv-01','combined-01'].includes(c.id)));
 if(selected.some(c=>completed.includes(c.id)))throw Error('Supervisor refuses to rerun completed cases');
 const maxAttempts=batch?.maxAttempts??(scope==='all'?161:19),tokenAllowance=batch?.tokenAllowance??(scope==='all'?500000:80000);
 const root=path.resolve('.evaluation-results/final-live',scope==='remaining-17'?'batch-03':scope==='batch-02'?'batch-02':'.');await mkdir(root,{recursive:true});
 const manifest=path.join(root,'run.json');try{await access(manifest);throw Error('Existing run manifest must not be overwritten');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const state={fixtureHash,scope,approvedMaxAttempts:maxAttempts,tokenPlanningAllowance:tokenAllowance,startedAt:new Date().toISOString(),completedAt:null as string|null,attempts:0,knownTotalTokens:0,unknownUsageAttempts:0,conservativeAccountedTokens:0,stopReason:null as string|null,cases:[] as Array<{id:string;exitCode:number|null;attempts:number;resultFile:string;ledgerFile:string}>};
 const save=()=>writeFile(manifest,JSON.stringify(state,null,2)+'\n',{mode:0o600});await save();
 let cancelled=false,child:ReturnType<typeof spawn>|undefined;
 const stop=()=>{cancelled=true;state.stopReason='operator_cancelled';child?.kill('SIGINT');};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
 for(const c of selected){
  if(cancelled||state.stopReason)break;
  const remaining=maxAttempts-state.attempts,remainingTokens=tokenAllowance-state.conservativeAccountedTokens;
  if(remaining<1||remainingTokens<4024){state.stopReason='approved_budget_exhausted';break;}
  const ledgerFile=path.join(root,c.id+'-http.json'),directory=path.join(root,c.id);await mkdir(directory,{recursive:true});
  // Valid missing-evidence cases can abstain before any provider request.
  await initializeLiveLedger(ledgerFile);
  const args=['--env-file=.env.local','--conditions=react-server','--import','tsx','--import','./evaluation/final-live-preload.ts','evaluation/answer-quality-cli.ts','--mode','live','--cases',c.id,'--limit','1','--out',directory];
  let output='';
  const exitCode=await new Promise<number|null>((resolve,reject)=>{
   child=spawn(process.execPath,args,{env:{...process.env,ALLOW_LIVE_AI_EVAL:'1',FINAL_LIVE_LEDGER:ledgerFile,FINAL_LIVE_MAX_ATTEMPTS:String(Math.min(remaining,c.system==='chat'?1:9)),FINAL_LIVE_TOKEN_ALLOWANCE:String(remainingTokens)},stdio:['ignore','pipe','pipe']});
   const timer=setTimeout(()=>{state.stopReason='harness_process_deadline';child?.kill('SIGTERM');},240000);
   child.stdout?.on('data',chunk=>{output+=String(chunk);});child.stderr?.on('data',chunk=>{output+=String(chunk);});child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);resolve(code);});
  });
  await writeFile(path.join(directory,'operator-process.log'),output,{mode:0o600});
  let ledger:LiveLedger={attempts:[],stopReason:null};try{ledger=JSON.parse(await readFile(ledgerFile,'utf8'));}catch{state.stopReason??='missing_http_ledger';}
  state.attempts+=ledger.attempts.length;state.knownTotalTokens+=ledger.attempts.reduce((n,a)=>n+(a.totalTokens??0),0);state.unknownUsageAttempts+=ledger.attempts.filter(a=>a.totalTokens===null).length;state.conservativeAccountedTokens+=ledger.attempts.reduce((n,a)=>n+(a.totalTokens??a.inputBytes+4024),0);
  state.cases.push({id:c.id,exitCode,attempts:ledger.attempts.length,resultFile:path.join(directory,'results.json'),ledgerFile});state.stopReason??=ledger.stopReason;
  // A failed deadline or setup must not silently advance into more paid cases.
  try{const artifact=JSON.parse(await readFile(path.join(directory,'results.json'),'utf8'));const result=artifact.results.find((r:{id:string})=>r.id===c.id);state.stopReason??=result?evaluationStopReason(result):'missing_case_result';}catch{state.stopReason??='missing_case_result';}
  await save();
  console.log(JSON.stringify({case:c.id,exitCode,caseAttempts:ledger.attempts.length,totalAttempts:state.attempts,knownTokens:state.knownTotalTokens,stopReason:state.stopReason}));
  if(!state.stopReason&&!cancelled&&c!==selected.at(-1)){
   // Between cases only; never retry an earlier case or change production pacing.
   const until=Date.now()+65000;while(Date.now()<until&&!cancelled)await new Promise(r=>setTimeout(r,Math.min(1000,until-Date.now())));
  }
 }
 }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);state.completedAt=new Date().toISOString();await save();}
}
main().catch(()=>{console.error('Guarded evaluation supervisor failed; inspect safe checkpoint files.');process.exitCode=1;});

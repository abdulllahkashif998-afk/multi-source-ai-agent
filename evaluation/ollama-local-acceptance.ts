// Opt-in local-only component acceptance. No database connection or paid provider.
import {writeFile} from 'node:fs/promises';
import {generateEvidenceAnswer} from '../src/lib/gemini';
import {answerWithAgent} from '../src/lib/knowledge-agent';
import {runWithIdentity} from '../src/lib/identity';
import {validateGroundedAnswer} from '../src/lib/rag-answer';
import {withRequest} from '../src/lib/reliability';
async function main(){
if(process.env.RUN_LOCAL_OLLAMA_ACCEPTANCE!=='1')throw Error('Explicit local acceptance opt-in required');
process.env.AI_PROVIDER='ollama';
const nativeFetch=globalThis.fetch;let nativeCalls=0;
globalThis.fetch=async(input,init)=>{const url=new URL(String(input));if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/api/chat')throw Error('Non-local or non-chat network request blocked');nativeCalls++;return nativeFetch(input,init);};
const text='Fictional reimbursement guidance: approval is required above 75 credits. Exactly 75 credits does not require approval.';
const document={document_id:'21',chunk_id:'51',filename:'fictional-guidance.pdf',chunk_index:0,page_number:1,similarity:.99,chunk_text:text};
const evidence=[{id:'S1',documentId:'21',chunkId:'51',filename:document.filename,chunkIndex:0,pageNumber:1,similarity:.99,text}];
const results:unknown[]=[];
for(const id of ['rag','csv','combined','missing']){
 const start=performance.now(),before=nativeCalls;
 try{
  let result:{grounded:boolean;answer:string;sources:Array<{id:string;filename:string;text:string;quotes:string[]}>}|undefined;
  await withRequest(new Request('http://localhost/local-acceptance'),async()=>{
   if(id==='rag')result=validateGroundedAnswer(await generateEvidenceAnswer('What is the approval threshold?',evidence,AbortSignal.timeout(30000)),evidence);
   else result=await runWithIdentity('101',()=>answerWithAgent(id==='csv'?'How many records are in ledger.csv?':id==='combined'?'Compare the 20-credit ledger amount with the approval guidance. State the threshold and difference, with both sources.':'Who opened a fictional office on Neptune?',new AbortController().signal,{search:async()=>id==='missing'?[]:[document],discover:async()=>id==='missing'?[]:[{id:'101',filename:'ledger.csv',row_count:1,columns:[{name:'amount',type:'number'}]}],query:async(plan)=>{const p=plan as {aggregate?:{op:string}};return p.aggregate?.op==='count'?[{value:1}]:[{amount:20}];}}));
   return Response.json({success:true});
  });
  results.push({id,status:'completed',durationMs:Math.round(performance.now()-start),nativeCalls:nativeCalls-before,grounded:result!.grounded,answer:result!.answer,sources:result!.sources.map(s=>({id:s.id,filename:s.filename,quotesVerified:s.quotes.every(q=>s.text.includes(q))})),semanticReview:'pending actual human decision'});
 }catch(error){const e=error as {code?:string;name?:string;status?:number};results.push({id,status:'failed',durationMs:Math.round(performance.now()-start),nativeCalls:nativeCalls-before,errorType:e.name,code:e.code,httpStatus:e.status});}
 // Sequential; never retry a failed case.
}
const report={kind:'real-local-Qwen-with-injected-fictional-evidence-not-database-or-browser-E2E',model:'qwen3.5:4b',paidProviderCalls:0,databaseAccess:false,results};
await writeFile(process.env.LOCAL_ACCEPTANCE_OUTPUT??'/tmp/ollama-local-acceptance.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));

}
void main().catch(()=>{console.error("Local acceptance runner failed before completing its report.");process.exitCode=1;});

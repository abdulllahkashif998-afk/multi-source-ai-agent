import {encode} from 'gpt-tokenizer/encoding/o200k_harmony';
import {requiresCombinedEvidence,questionMentionsFilename} from './agent-evidence-contract';
import type {createAgentSession} from './agent-tools';
type Session=ReturnType<typeof createAgentSession>;

// Reuse an explicitly requested, owned source; never guess which policy applies.
// Unnamed/ambiguous/incomplete discovery retains the ordinary planner tools.
export async function prepareAgentEvidence(question:string,session:Session,signal?:AbortSignal){
 if(!requiresCombinedEvidence(question)||/\b(?:not|never|ignore|except|without|exclude|instead)\b|\bdon't\b/i.test(question))return undefined;
 let catalog;try{catalog=await session.discoverPolicies();}catch{signal?.throwIfAborted();return undefined;}
 if(catalog.truncated)return undefined;
 const named=catalog.documents.filter(d=>questionMentionsFilename(question,d.filename));
 if(named.length!==1)return undefined;
 const filename=named[0].filename;
 const result=await session.execute('searchDocuments',{question},undefined,{filename});
 if(!result||typeof result!=='object'||'error' in result)return undefined;
 const sources=session.evidence().documents.filter(d=>d.filename.toLowerCase()===filename.toLowerCase());
 if(!sources.length)return undefined;
 await session.preparePolicyEvaluation(filename,question,catalog.documents);
 if(!await session.ensureSLAPolicyContexts(true))return {blocked:true as const};
 const previews:Array<{id:string;filename:string;text:string;partial:boolean}>=[];
 // Keep extra initial context bounded; tools retain full original evidence.
 for(const source of sources){
  let text=source.text.slice(0,2000);
  while(text&&encode(JSON.stringify([...previews,{id:source.id,filename:source.filename,text,partial:text.length<source.text.length}]),{disallowedSpecial:new Set()}).length>800)text=text.slice(0,-200);
  if(!text)break;
  previews.push({id:source.id,filename:source.filename,text,partial:text.length<source.text.length});
 }
 return {blocked:false as const,documents:previews,policyEvaluation:session.policyEvaluationInfo(),additionalSearchAvailable:true as const};
}

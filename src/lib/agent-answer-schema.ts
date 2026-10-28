import type {DocumentQuoteChoice} from './document-answer-schema';

// Agent limits are already enforced by tools (10 calls, 6000-character document
// excerpts, 24000-character CSV results). Cover every collected source; do not
// apply Document RAG's three-source/6000-character truncation to agent evidence.
export function agentQuoteChoices(evidence:{documents:ReadonlyArray<{id:string;text:string}>;csv:ReadonlyArray<{id:string;text:string}>}):DocumentQuoteChoice[]{
 const choices:DocumentQuoteChoice[]=[],seen=new Set<string>();
 for(const source of [...evidence.documents,...evidence.csv]){
  if(seen.has(source.id))throw new Error('Duplicate agent evidence identity');
  seen.add(source.id);
  for(let start=0;start<source.text.length;start+=1800){
   const quote=source.text.slice(start,start+2000).trim();
   if(quote)choices.push({quoteId:`Q${choices.length+1}`,sourceId:source.id,quote});
   if(start+2000>=source.text.length)break;
  }
 }
 return choices;
}

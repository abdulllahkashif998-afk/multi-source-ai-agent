import {z} from 'zod';
import {groundedAnswerSchema,type EvidenceSource} from './rag-answer';
import {CitationVerificationError} from './chat-errors';
export interface DocumentQuoteChoice {quoteId:string;sourceId:string;quote:string}

// The model selects a reference; it never reconstructs PDF quote formatting.
export function documentQuoteChoices(evidence:EvidenceSource[]):DocumentQuoteChoice[]{
 const choices:DocumentQuoteChoice[]=[];
 for(const source of evidence.slice(0,3)){
  const text=source.text.slice(0,6000),local=new Set<string>();
  const add=(value:string)=>{const quote=value.trim();if(quote&&quote.length<=2000&&text.includes(quote)&&local.size<32)local.add(quote);};
  for(let offset=0;offset<text.length;offset+=1800){add(text.slice(offset,offset+2000));if(offset+2000>=text.length)break;}
  for(const match of text.matchAll(/[^.!?\n]+[.!?](?=\s|$)/g))add(match[0]);
  for(const line of text.split('\n'))add(line);
  for(const quote of local)choices.push({quoteId:`Q${choices.length+1}`,sourceId:source.id,quote});
 }
 if(!choices.length)throw new Error('No document quote choices');
 return choices;
}
const statement=groundedAnswerSchema.shape.statements.element;
// Basic object/string schema, with no provider-dependent dynamic enums.
export const documentReferenceSchema=groundedAnswerSchema.extend({statements:z.array(statement.extend({citations:z.array(z.object({sourceId:z.string().min(1),quoteId:z.string().min(1)})).min(1).max(3)})).max(8)});
export function resolveDocumentAnswer(value:unknown,choices:DocumentQuoteChoice[]){
 const parsed=documentReferenceSchema.safeParse(value);
 if(!parsed.success)throw new CitationVerificationError('citation_invalid_shape');
 // A refusal contains no cited claims, matching the existing final verifier.
 if(!parsed.data.answerable)return {answerable:false,statements:[]};
 return {...parsed.data,statements:parsed.data.statements.map(s=>({...s,citations:s.citations.map(c=>{
  if(!choices.some(q=>q.sourceId===c.sourceId))throw new CitationVerificationError('citation_unknown_source');
  const choice=choices.find(q=>q.quoteId===c.quoteId);
  if(!choice)throw new CitationVerificationError('citation_unknown_quote_reference');
  if(choice.sourceId!==c.sourceId)throw new CitationVerificationError('citation_reference_source_mismatch');
  return {sourceId:c.sourceId,quote:choice.quote};
 })}))};
}

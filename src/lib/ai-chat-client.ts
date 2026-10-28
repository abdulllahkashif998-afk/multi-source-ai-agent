import { z } from 'zod';
import { AuthUiError, getBrowserSession } from './auth-client';
export type ChatMode='agent'|'documents';
export const modeLabel=(mode:ChatMode)=>mode==='agent'?'Multi-Source Agent':'Document RAG';
const questionSchema=z.string().trim().min(1).max(2000);
const documentFields={filename:z.string().min(1),chunkIndex:z.number().int().nonnegative().optional(),pageNumber:z.number().int().nonnegative().nullable().optional(),text:z.string(),quotes:z.array(z.string().min(1)).min(1).max(24)};
const ragSource=z.object({...documentFields,id:z.string().regex(/^S[1-9]\d*$/),type:z.literal('document').optional()});
const agentDocument=z.object({...documentFields,id:z.string().regex(/^D[1-9]\d*$/),type:z.literal('document')});
const agentCSV=z.object({id:z.string().regex(/^C[1-9]\d*$/),type:z.literal('csv'),filename:z.string().min(1),text:z.string(),quotes:z.array(z.string().min(1)).min(1).max(24),rows:z.array(z.unknown()).max(100),possiblyTruncated:z.boolean()});
export type DocumentCitation=z.infer<typeof agentDocument>|(Omit<z.infer<typeof ragSource>,'type'>&{type:'document'});
export type CSVCitation=z.infer<typeof agentCSV>;
export type ChatCitation=DocumentCitation|CSVCitation;
export type ChatAnswer={grounded:boolean;answer:string;sources:ChatCitation[]};
const messages:Record<string,string>={
 INVALID_QUESTION:'Enter a question between 1 and 2,000 characters.',
 REQUEST_TOO_LARGE:'This question is too large to send. Please shorten it.',
 PROVIDER_RATE_LIMITED:'The answer service is rate limited. Please wait before retrying manually.',
 REQUEST_TIMEOUT:'The request timed out. It may already have been processed. Retry manually when you are ready.',
 CONNECTION_FAILED:'The connection was interrupted. The server may have processed your question. Retry manually when you are ready.',
 CHAT_NOT_CONFIGURED:'The answer service is not configured. Please contact the workspace operator.',
 RETRIEVAL_FAILED:'Document retrieval is temporarily unavailable. Please try again later.',
 UNSUPPORTED_ANSWER:'The service could not verify an answer against its sources. Try a more specific question.',
 CSRF_REJECTED:'This request could not be verified. Refresh the page and try again.',
 SERVICE_UNAVAILABLE:'The answer service is temporarily unavailable. Please try again later.',
 INVALID_RESPONSE:'The service returned an unreadable answer. Please retry manually.',
 REQUEST_FAILED:'The answer request could not be completed. Please try again later.',
 INTERRUPTED:'This request was interrupted when you left the page. It may have been processed. Retry manually if needed.',
};
export class AIUiError extends Error{constructor(public code:string){super(messages[code]??messages.REQUEST_FAILED);}}
export function validateQuestion(value:unknown){
 const parsed=questionSchema.safeParse(value);if(!parsed.success)throw new AIUiError('INVALID_QUESTION');
 const body=JSON.stringify({question:parsed.data});if(new TextEncoder().encode(body).byteLength>16384)throw new AIUiError('REQUEST_TOO_LARGE');return parsed.data;
}
export function parseChatAnswer(mode:ChatMode,value:unknown):ChatAnswer{
 const base=z.object({success:z.literal(true),grounded:z.boolean(),answer:z.string().min(1).max(20000),sources:z.array(z.unknown()).max(40)}).safeParse(value);
 if(!base.success)throw new AIUiError('INVALID_RESPONSE');
 const sources:ChatCitation[]=[];
 for(const source of base.data.sources){
  if(mode==='documents'){
   const parsed=ragSource.safeParse(source);if(!parsed.success)throw new AIUiError('INVALID_RESPONSE');sources.push({...parsed.data,type:'document'});
  }else{
   const parsed=z.discriminatedUnion('type',[agentDocument,agentCSV]).safeParse(source);if(!parsed.success)throw new AIUiError('INVALID_RESPONSE');sources.push(parsed.data);
  }
 }
 const ids=new Set(sources.map(source=>source.id));
 const markers=[...base.data.answer.matchAll(/\[(?:S|D|C)[1-9]\d*\]/g)].map(match=>match[0].slice(1,-1));
 if(ids.size!==sources.length||(!base.data.grounded&&sources.length!==0)||(base.data.grounded&&(!sources.length||!markers.length||markers.some(id=>!ids.has(id))||sources.some(source=>!markers.includes(source.id)))))throw new AIUiError('INVALID_RESPONSE');
 // Backend quote verification remains authoritative; reject inconsistent payloads.
 if(sources.some(source=>source.quotes.some(quote=>!source.text.includes(quote))))throw new AIUiError('INVALID_RESPONSE');
 return {grounded:base.data.grounded,answer:base.data.answer,sources};
}
export function csvEvidenceTable(rows:unknown[]){
 const headers:string[]=[];
 for(const row of rows){
  if(row===null||typeof row!=='object'||Array.isArray(row))return null;
  for(const [key,value] of Object.entries(row)){
   if(!(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)))return null;
   if(!headers.includes(key))headers.push(key);
  }
 }
 if(!headers.length||headers.length>100)return null;
 return {headers,rows:rows as Array<Record<string,string|number|boolean|null>>};
}
export async function askAI(mode:ChatMode,value:unknown,signal?:AbortSignal):Promise<ChatAnswer>{
 if(mode!=='agent'&&mode!=='documents')throw new AIUiError('REQUEST_FAILED');
 const question=validateQuestion(value);
 const session=await getBrowserSession();signal?.throwIfAborted();
 const timeout=AbortSignal.timeout(mode==='agent'?65_000:50_000);
 const combined=signal?AbortSignal.any([signal,timeout]):timeout;
 let response:Response;
 try{response=await fetch(mode==='agent'?'/api/agent':'/api/chat',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify({question}),signal:combined});}
 catch{throw new AIUiError(timeout.aborted?'REQUEST_TIMEOUT':signal?.aborted?'INTERRUPTED':'CONNECTION_FAILED');}
 if(response.status===401)throw new AuthUiError('UNAUTHENTICATED');
 if(response.status===429)throw new AIUiError('PROVIDER_RATE_LIMITED');
 if(response.status===403)throw new AIUiError('CSRF_REJECTED');
 if(response.status===504)throw new AIUiError('REQUEST_TIMEOUT');
 let body;try{body=await response.json();}catch{throw new AIUiError(timeout.aborted?'REQUEST_TIMEOUT':'INVALID_RESPONSE');}
 if(!response.ok){
  const code=body&&typeof body==='object'&&'code' in body?body.code:undefined;
  const safe=['CHAT_NOT_CONFIGURED','RETRIEVAL_FAILED','UNSUPPORTED_ANSWER','INVALID_QUESTION','REQUEST_TOO_LARGE'];
  throw new AIUiError(typeof code==='string'&&safe.includes(code)?code:response.status===503?'SERVICE_UNAVAILABLE':'REQUEST_FAILED');
 }
 return parseChatAnswer(mode,body);
}

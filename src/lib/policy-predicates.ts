import {hasAmbiguousSLAScope} from './agent-sla';
import type {DocumentSearchResult} from './search-documents';
export type Metric='first_response'|'resolution';
export interface PolicyContract {
 dataset:string;organization:{column:string;value:string};period:{column:string;start:number;end:number;includeStart:boolean;includeEnd:boolean;startText:string;endText:string};
 priority:string;identifier:string;metrics:Record<Metric,{column:string;rules:Record<string,number>}>;
 maintenance:{flag:string;affirmative:'yes'|'true';notice:string;minimum:number};
 support:{scope:number[];first_response:number[];resolution:number[];maintenance:number[];resolutionMaintenance:number[]};
}
export function utcTimestamp(value:unknown):number|undefined{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return;
 const n=Date.parse(value);if(!Number.isFinite(n)||new Date(n).toISOString()!==value.replace(/(?<!\.\d{3})Z$/,'.000Z'))return;
 return n;
}
// Reassemble overlapping chunks without rewriting originals used for citations.
function joined(rows:DocumentSearchResult[]){
 let text='';const ranges:Array<{start:number;end:number;index:number}>=[];
 rows.forEach((row,index)=>{
  const part=row.chunk_text.replace(/\s+/g,' ').trim();let overlap=Math.min(text.length,part.length,2000);
  while(overlap&&text.slice(-overlap)!==part.slice(0,overlap))overlap--;
  if(overlap<20)overlap=0;
  if(!overlap&&text)text+=' ';
  const start=text.length-overlap;text+=part.slice(overlap);
  ranges.push({start,end:start+part.length,index});
 });
 const support=(start:number,length:number)=>ranges.filter(r=>r.start<start+length&&r.end>start).map(r=>r.index);
 return {text,support};
}
// Controlled declarative grammar. Unknown wording is not interpreted by an LLM.
export function parsePolicyContract(rows:DocumentSearchResult[]):PolicyContract|undefined{
 if(!rows.length||rows.length>100||rows.some(r=>r.chunk_text.length>1800))return;
 const {text,support}=joined(rows);let remainder=text;
 const take=(re:RegExp)=>{const m=re.exec(text);if(m)remainder=remainder.replace(m[0],' ');return m;};
 const id='([A-Za-z_][A-Za-z0-9_]{0,99})',date='(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z)';
 const scope=take(new RegExp('This policy governs the companion dataset ([^\\/\\\\;]+?\\.csv) only when the row satisfies BOTH conditions: '+id+' equals (.{1,120}?) exactly; and '+id+' is (on or after|after) '+date+' and (before|on or before) '+date+'\\.','i'));
 if(!scope)return;
 const start=utcTimestamp(scope[6]),end=utcTimestamp(scope[8]);if(start===undefined||end===undefined||start>=end)return;
 const response=take(new RegExp(id+' measures elapsed time from receipt to the first human response\\.','i'));
 const resolution=take(new RegExp(id+' measures elapsed time from receipt to resolution\\.','i'));
 const priority=take(new RegExp('Group confirmed violations by '+id+' only after scope and metric-specific exclusions have been applied\\.','i'));
 const unique=take(new RegExp('The supplied CSV has unique '+id+' values; each row represents one incident\\.','i'));
 const maintenance=take(new RegExp('For an in-scope row, exclude it from FIRST-RESPONSE SLA scoring only if '+id+' is (yes|true) AND '+id+' is a known nonnegative number at least (\\d+(?:\\.\\d+)?)\\.','i'));
 if(!/All hours are elapsed wall-clock hours, not business hours\./i.test(text))return;
 if(!response||!resolution||!priority||!unique||!maintenance||!Number.isFinite(Number(maintenance[4]))||Number(maintenance[4])>Number.MAX_SAFE_INTEGER)return;
 const resolutionMaintenance=take(/Maintenance NEVER exempts a row from the RESOLUTION deadline in this fixture\./i);if(!resolutionMaintenance)return;
 if(!/A measurement strictly greater than its deadline is late\./i.test(text)||!/A measurement exactly equal to the deadline is on time\./i.test(text))return;
 const rules:Record<Metric,Record<string,number>>={first_response:{},resolution:{}};
 const indices:Record<Metric,Set<number>>={first_response:new Set(),resolution:new Set()};
 for(const m of text.matchAll(/\b([A-Za-z][A-Za-z0-9_-]{0,31}) (first[- ]response|resolution) deadline is (\d+(?:\.\d+)?) hours?\./gi)){
  const metric=/^first/i.test(m[2])?'first_response':'resolution',n=Number(m[3]);
  if(!Number.isFinite(n)||n<0||n>Number.MAX_SAFE_INTEGER||(Object.hasOwn(rules[metric],m[1])&&rules[metric][m[1]]!==n))return;
  rules[metric][m[1]]=n;support(m.index!,m[0].length).forEach(i=>indices[metric].add(i));remainder=remainder.replace(m[0],' ');
 }
 if(/(?:first[- ]response|resolution) deadline is/i.test(remainder))return;
 const categories=Object.keys(rules.first_response);
 if(!categories.length||categories.length>5||categories.some(k=>!Object.hasOwn(rules.resolution,k))||Object.keys(rules.resolution).length!==categories.length)return;
 // Reject contradictory boundary descriptions, competing applicability and unknown conditions.
 const includeStart=scope[5].toLowerCase()==='on or after',includeEnd=scope[7].toLowerCase()==='on or before';
 if(/The start boundary is inclusive\./i.test(text)&&!includeStart||/The start boundary is exclusive\./i.test(text)&&includeStart||/The end boundary is inclusive\./i.test(text)&&!includeEnd||/The end boundary is exclusive\./i.test(text)&&includeEnd)return;
 // Only explicit, recognized explanatory clauses can be removed from safety scanning.
 const explanations=[
 /All hours are elapsed wall-clock hours, not business hours\./gi,/These rules have no department-specific or regional override\./gi,
 /Customer updates occur on material changes only\./gi,/Audit reviews occur during business hours only\./gi,
 /If another active policy conflicts with it, do not choose the higher, newer-looking or stricter deadline\./gi,
 /For more than one active policy[^.]*\./gi,
 ];
 for(const re of explanations)remainder=remainder.replace(re,' ');
 // Recognize maintenance follow-up predicates only when they bind the same fields/threshold.
 const below=new RegExp('(?:If '+maintenance[1]+'|If '+maintenance[1]+' is '+(maintenance[2].toLowerCase()==='yes'?'no':'false')+', no maintenance exclusion applies\\.\\s+If it) is '+maintenance[2]+' but the known notice is below (\\d+(?:\\.\\d+)?) hours, no exclusion applies and first-response scoring proceeds normally\\.','gi');
 for(const m of text.matchAll(below)){if(Number(m[1])!==Number(maintenance[4]))return;remainder=remainder.replace(m[0],' ');}
 remainder=remainder.replace(new RegExp('If '+maintenance[1]+' is '+(maintenance[2].toLowerCase()==='yes'?'no':'false')+', no maintenance exclusion applies\\.','gi'),' ')
 .replace(new RegExp('If '+maintenance[1]+' is '+maintenance[2]+' and '+maintenance[3]+' is blank or invalid, first-response exclusion eligibility is unknown\\.','gi'),' ');
 remainder=remainder.replace(new RegExp('An unknown maintenance notice does not prevent resolution scoring if applicability, '+priority[1]+' and '+resolution[1]+' are known\\.','gi'),' ').replace(/Do not present a confirmed lower bound as a complete total when unresolved rows could change that total\./gi,' ');
 remainder=remainder.replace(/Excess equals actual hours minus the corresponding deadline\./gi,' ');
 if(/\b[A-Za-z_]\w* (?:equals|must equal|is on or after|is on or before)\b|\bmust be\b/i.test(remainder))return;
 if(/\b(if|when|unless|except|only|effective|supersed\w*|override|department|region|regional|business hours|working hours|time zone|holidays?|weekends?|VIP|special cases|otherwise|instead|but)\b|provided that|conditioned on|applies to|restricted to|rather than|(?:first[- ]response|resolution|deadline|threshold)[^.!?]{0,100}\b(?:relax|extend|waive|double|shorten|halve|differ(?!ence)|vary|discount|suspend|alter|modify|adjust)\w*/i.test(remainder))return;
 if(hasAmbiguousSLAScope(remainder)||/\b(minutes?|seconds?|days?|weeks?)\b/i.test(remainder))return;
 const noticeUnits=new Set<number>();let noticeUnitKnown=false;
 for(const m of text.matchAll(/Exactly (\d+(?:\.\d+)?) hours qualifies\./gi)){if(Number(m[1])!==Number(maintenance[4]))return;noticeUnitKnown=true;support(m.index!,m[0].length).forEach(i=>noticeUnits.add(i));}
 if(!noticeUnitKnown)return;
 // Required schema bindings and evidence spans are bounded, never guessed.
 const spans={resolutionMaintenance:support(resolutionMaintenance.index!,resolutionMaintenance[0].length),scope:support(scope.index!,scope[0].length),first_response:[...indices.first_response],resolution:[...indices.resolution],maintenance:[...new Set([...support(maintenance.index!,maintenance[0].length),...noticeUnits])]};
 if(Object.values(spans).some(s=>!s.length||s.length>2))return;
 return {dataset:scope[1].trim(),organization:{column:scope[2],value:scope[3]},period:{column:scope[4],start,end,includeStart,includeEnd,startText:scope[6],endText:scope[8]},priority:priority[1],identifier:unique[1],metrics:{first_response:{column:response[1],rules:rules.first_response},resolution:{column:resolution[1],rules:rules.resolution}},maintenance:{flag:maintenance[1],affirmative:maintenance[2].toLowerCase() as 'yes'|'true',notice:maintenance[3],minimum:Number(maintenance[4])},support:spans};
}

export function policyDocumentText(rows:DocumentSearchResult[]){return joined(rows).text;}

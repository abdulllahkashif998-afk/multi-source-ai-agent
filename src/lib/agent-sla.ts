import type {createAgentSession} from './agent-tools';
import {agentQuoteChoices} from './agent-answer-schema';
import {decimalDifference} from './agent-structured-operations';
type Session=ReturnType<typeof createAgentSession>;
function record(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
function number(v:unknown):v is number{return typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=Number.MAX_SAFE_INTEGER;}
export function parseSLARequest(question:string){
 // Only remove a presentation-only suffix whose fields this operation already
 // returns. Unknown fields, filters and applicability qualifiers must still
 // reach the general agent; never silently discard substantive requirements.
 const presentation=/^(.*\?)\s+include\s+(.+?)\.?$/i.exec(question.trim());
 if(presentation){
  const fields=presentation[2].replace(/^their\s+/i,'').split(/\s*,\s*|\s+and\s+/i).map(field=>field.trim());
  if(fields.length&&fields.every(field=>/^(?:ticket ids|response times|policy deadline|citations(?: from both sources)?)$/i.test(field))){
   const request=parseSLAIntent(presentation[1]);
   if(request)return request;
  }
 }
 return parseSLAIntent(question);
}
function parseSLAIntent(question:string){
 // Do not guess filenames, metrics or arbitrary question intent. Extra lookup,
 // date, regional or resolution requirements stay on the general-agent path.
 const count=/^how many (?:tickets|incidents) missed (?:the )?first[- ]response SLA across all priorities\??$/i.test(question.trim());
 if(count)return {document:null,dataset:null,priorities:[],unit:null,op:'gt' as const};
 const short=/^which\s+(P\d{1,2}(?:\s+and\s+P\d{1,2})*)\s+(?:incidents|tickets)\s+(?:exceeded|missed)\s+the policy first[- ]response (?:deadline|sla)\??$/i.exec(question.trim());
 if(short)return {document:null,dataset:null,priorities:short[1].toUpperCase().split(/\s+AND\s+/),unit:null,op:'gt' as const};
 const missed=/^which\s+(P\d{1,2}(?:\s+and\s+P\d{1,2})*)\s+tickets missed the first[- ]response SLA according to ["']?([^\/\\]+?\.(?:pdf|docx))["']? and ["']?([^\/\\]+?\.csv)["']?\?\s*Include ticket IDs, response times, policy deadline, and citations from both sources\.?$/i.exec(question.trim());
 if(missed)return {document:missed[2].trim(),dataset:missed[3].trim(),priorities:missed[1].toUpperCase().split(/\s+AND\s+/),unit:null,op:'gt' as const};
 const match=/^using ["']?([^\/\\]+?\.(?:pdf|docx))["']? and ["']?([^\/\\]+?\.csv)["']?,\s*list\b/i.exec(question.trim());
 if(!match||!/\bfirst[- ]response\b/i.test(question)||!/\btickets?\b/i.test(question)||/\b(region|regional|lead|resolution|last year|last month)\b/i.test(question))return null;
 const tail=question.trim().slice(match[0].length).trim();
 const grammar=/^(?:all )?(?:(P\d{1,2}(?:\s+and\s+P\d{1,2})*)\s+)?(?:late\s+)?tickets?\s+(?:whose\s+((?:first_response|response)_(?:hours|minutes))\s+is\s+(greater than or equal to|greater than|at least|at or above)\s+(?:the\s+)?(?:(P\d{1,2})\s+)?first[- ]response\s+(?:deadline|sla)(?:\s+of\s+\d+(?:\.\d+)?\s+(?:hours?|minutes?))?|against the first[- ]response sla)\.\s*include ticket ids, actual (hours|minutes),? and citations from both files\.?$/i.exec(tail);
 if(!grammar)return null;
 const priorities=grammar[1]?grammar[1].toUpperCase().split(/\s+AND\s+/):[];
 if(grammar[4]&&(priorities.length!==1||priorities[0]!==grammar[4].toUpperCase()))return null;
 const inclusive=grammar[3]&&grammar[3].toLowerCase()!=='greater than';
 return {document:match[1].trim(),dataset:match[2].trim(),priorities,unit:grammar[5].toLowerCase(),op:inclusive?'gte' as const:'gt' as const};
}
export function extractSLARules(text:string){
 const rules:Array<{priority:string;threshold:number;unit:'hours'|'minutes';text:string}>=[];
 // A compound commitment inherits ONLY the explicitly named first-response
 // metric. Keep the entire original sentence as the verifiable quote.
 for(const match of text.matchAll(/(?:^|(?<=[.!?])\s+|\n)(P\d{1,2} tickets require first[- ]response within \d+(?:\.\d+)? (?:hours?|minutes?)(?:;\s*P\d{1,2} within \d+(?:\.\d+)? (?:hours?|minutes?))+\.)(?=\s|$)/gi)){
  const sentence=match[1];
  for(const part of sentence.matchAll(/\b(P\d{1,2})(?: tickets require first[- ]response)? within (\d+(?:\.\d+)?) (hours?|minutes?)/gi)){
   if(number(Number(part[2])))rules.push({priority:part[1].toUpperCase(),threshold:Number(part[2]),unit:/^h/i.test(part[3])?'hours':'minutes',text:sentence});
  }
 }

 for(const raw of text.split(/\r?\n|(?<=[.!?])\s+/)){
  const line=raw.trim().replace(/^[•*-]\s*/, '');
  const forward=/^(?:priority\s+|severity\s+)?(P\d{1,2})\s*[:|\-]?\s*first[- ]response\s*(?:deadline|sla|target)?\s*(?:is|of|:|=|within)?\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\.?$/i.exec(line);
  const reverse=/^first[- ]response\s*(?:deadline|sla|target)\s+for\s+(P\d{1,2})\s*(?:is|:|=)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\.?$/i.exec(line);
  const match=forward??reverse;if(match&&number(Number(match[2])))rules.push({priority:match[1].toUpperCase(),threshold:Number(match[2]),unit:/^(h|hr)/i.test(match[3])?'hours':'minutes',text:line});
 }
 return rules;
}
// Region metadata and escalation recipients do not make a deadline regional.
// Keep unknown conditions conservative; reject region language tied to rule scope.
export function hasAmbiguousSLAScope(text:string){
 return text.split(/(?<=[.!?])\s+/).some(raw=>{
  const sentence=raw.trim();
  // An explicit subject establishes a separate rule relationship. Never infer
  // scope from proximity, chunk ranking, headings alone or an ambiguous pronoun.
  const separateTopic=/^(?:customer updates?|resolution (?:targets?|deadlines?|sla)|audit (?:reviews?|requirements?))\b/i.test(sentence)
   &&!/first[- ]response|response[- ]sla|\b(?:this|entire|whole) policy\b/i.test(sentence);
  if(separateTopic)return false;
  if(/\b(exception|except|only|unless|effective|supersed\w*)\b|business hours|working hours|time zone/i.test(sentence))return true;
  return /\b(region|regional)\b/i.test(sentence)&&/first[- ]response|\b(deadline|sla|threshold|target|within|apply|applies|applicable|differ\w*|vary|varies|specific)\b/i.test(sentence);
 });
}
export async function trySLAComparison(question:string,session:Session){
 let request=parseSLARequest(question);if(!request)return null;
 if(request.document===null){
  const policies=await session.discoverPolicies();
  if(policies.truncated||policies.documents.length!==1)return session.abstain(policies.documents.length||policies.truncated?'ambiguous_rule':'missing_document');
  const discovery:unknown=await session.execute('discoverDatasets',{});
  if(!record(discovery)||!Array.isArray(discovery.datasets))return session.abstain('missing_dataset');
  // Schema is inspected before data queries; use stored column metadata only
  // to narrow candidates, never invent a source relationship or precedence.
  const candidates=[];
  if(discovery.datasets.length>20)return session.abstain('ambiguous_dataset');
  for(const candidate of discovery.datasets){
   if(!record(candidate)||typeof candidate.id!=='string'||typeof candidate.filename!=='string')return session.abstain('unsupported_schema');
   const schema=await session.inspectDiscoveredDataset(candidate.id);
   if(!schema)continue;
   const names=schema.columns;
   if(names.filter(c=>['severity','priority'].includes(c.name.toLowerCase())&&c.type==='text').length===1&&names.filter(c=>['ticket_id','ticket','id'].includes(c.name.toLowerCase())).length===1&&names.filter(c=>/^(first_response|response)_(hours|minutes)$/i.test(c.name)&&c.type==='number').length===1)candidates.push(candidate);
  }
  if(candidates.length!==1)return session.abstain(candidates.length?'ambiguous_dataset':'missing_dataset');
  request={...request,document:policies.documents[0].filename,dataset:String(candidates[0].filename)};
  if(/^how many /i.test(question.trim())){
   const selected=session.inspectDiscoveredDataset(String(candidates[0].id))!;
   const priorityColumn=selected.columns.find(c=>['severity','priority'].includes(c.name.toLowerCase())&&c.type==='text')!.name;
   await session.execute('inspectDataset',{datasetId:String(candidates[0].id)});
   const grouped:unknown=await session.execute('queryDataset',{datasetId:String(candidates[0].id),aggregate:{op:'count'},groupBy:[priorityColumn],limit:100});
   if(!record(grouped)||grouped.possiblyTruncated||!Array.isArray(grouped.rows)||grouped.rows.some(r=>!record(r)||typeof r[priorityColumn]!=='string'||!/^P\d{1,2}$/.test(r[priorityColumn] as string)||!Number.isSafeInteger(r.value)||Number(r.value)<1))return session.abstain('ambiguous_rule');
   const observed=grouped.rows.map(r=>String(r[priorityColumn])).sort();
   if(observed.length>5)return session.abstain('ambiguous_rule');
   // Anchor the existing focused retrieval on an observed category, rather
   // than a category invented by the model. Every category is checked below.
   request={...request,priorities:observed.slice(0,1)};
  }
 }
 await session.execute('searchDocuments',{question:`${request.document} first-response SLA deadline ${request.priorities.join(' ')}`},undefined,{filename:request.document});
 const applicability=await session.policyContext(request.document);
 if(applicability!=='clear')return session.abstain(applicability==='ambiguous'?'ambiguous_rule':'missing_document');
 const docs=session.evidence().documents.filter(d=>d.filename.toLowerCase()===request.document.toLowerCase());
 if(!docs.length)return session.abstain('missing_document');
 if(docs.some(d=>hasAmbiguousSLAScope(d.text)||d.text.split(/\r?\n|(?<=[.!?])\s+/).some(line=>/\bP\d{1,2}\b/i.test(line)&&/first[- ]response/i.test(line)&&!extractSLARules(line).length)))return session.abstain('ambiguous_rule');
 const allRules=docs.flatMap(d=>extractSLARules(d.text).map(rule=>({...rule,source:d})));
 const discovery:unknown=await session.execute('discoverDatasets',{});
 if(!record(discovery)||!Array.isArray(discovery.datasets))return session.abstain('missing_dataset');
 const found=discovery.datasets.filter(d=>record(d)&&typeof d.filename==='string'&&d.filename.toLowerCase()===request.dataset.toLowerCase());
 if(found.length!==1)return session.abstain(found.length?'ambiguous_dataset':'missing_dataset');
 const id=found[0].id;
 const inspection:unknown=await session.execute('inspectDataset',{datasetId:id});
 if(!record(inspection)||!record(inspection.dataset)||!Array.isArray(inspection.dataset.columns))return session.abstain('unsupported_schema');
 const columns=inspection.dataset.columns.filter(record);
 const one=(names:string[],type?:string)=>{const match=columns.filter(c=>typeof c.name==='string'&&names.includes(c.name.toLowerCase())&&(!type||c.type===type));return match.length===1?String(match[0].name):null;};
 const priority=one(['severity','priority'],'text'),ticket=one(['ticket_id','ticket','id']);
 const measures=columns.filter(c=>c.type==='number'&&typeof c.name==='string'&&/^(first_response|response)_(hours|minutes)$/i.test(c.name));
 const explicit=measures.filter(c=>question.toLowerCase().includes(String(c.name).toLowerCase()));
 const measure=explicit.length===1?String(explicit[0].name):measures.length===1?String(measures[0].name):null;
 if(!priority||!ticket||!measure)return session.abstain('unsupported_schema');
 const unit=measure.toLowerCase().endsWith('hours')?'hours':'minutes';
 if(request.unit!==null&&unit!==request.unit)return session.abstain('unsupported_schema');
 if(/^how many /i.test(question.trim())){
  // Grouping preserves exact row counts without a limited raw-row sample.
  // Compare each response-time bucket to its own documented priority rule.
  const result:unknown=await session.execute('queryDataset',{datasetId:id,aggregate:{op:'count'},groupBy:[priority,measure],limit:100});
  if(!record(result)||typeof result.id!=='string')return session.abstain('unsupported_schema');
  const source=session.evidence().csv.find(s=>s.id===result.id);
  if(!source||source.possiblyTruncated)return session.abstain('truncated_evidence');
  if(source.rows.some(r=>!record(r)||typeof r[priority]!=='string'||!/^P\d{1,2}$/.test(r[priority] as string)||!number(r[measure])||!Number.isSafeInteger(r.value)||Number(r.value)<1))return session.abstain('unsupported_schema');
  const categories=[...new Set([...source.rows.map(r=>String((r as Record<string,unknown>)[priority])),...allRules.map(r=>r.priority)])].sort();
  if(!categories.length||categories.length>5)return session.abstain('ambiguous_rule');
  const counts=[];
  for(const category of categories){
   const rules=allRules.filter(r=>r.priority===category);
   if(!rules.length||rules.some(r=>r.threshold!==rules[0].threshold||r.unit!==rules[0].unit)||rules[0].unit!==unit)return session.abstain('ambiguous_rule');
   const rule=rules[0];let count=0;
   for(const row of source.rows as Record<string,unknown>[])if(row[priority]===category&&(row[measure] as number)>rule.threshold)count+=Number(row.value);
   if(!Number.isSafeInteger(count))return session.abstain('unsupported_schema');
   counts.push({rule,count});
  }
  const choices=agentQuoteChoices(session.evidence());
  // Keep all operands in verified excerpts. Large grouped evidence abstains
  // rather than silently dropping bins or relaxing citation limits.
  const data=choices.find(c=>c.sourceId===source.id&&c.quote===source.text.trim());
  if(!data)return session.abstain('unquotable_evidence');
  const statements=[],totalReferences=new Map<string,{sourceId:string;quoteId:string}>();let total=0;
  for(const {rule,count} of counts){
   const doc=choices.find(c=>c.sourceId===rule.source.id&&c.quote.includes(rule.text));if(!doc)return session.abstain('unquotable_evidence');
   const ref={sourceId:doc.sourceId,quoteId:doc.quoteId};totalReferences.set(doc.quoteId,ref);total+=count;
   statements.push({text:`${rule.priority}: ${count} tickets missed the first-response SLA; the deadline is ${rule.threshold} ${unit}. Response times equal to the deadline are on time.`,citations:[ref,{sourceId:data.sourceId,quoteId:data.quoteId}]});
  }
  if(!Number.isSafeInteger(total)||totalReferences.size>2)return session.abstain('unquotable_evidence');
  statements.push({text:`Total across all priorities: ${total} tickets missed the first-response SLA.`,citations:[...totalReferences.values(),{sourceId:data.sourceId,quoteId:data.quoteId}]});
  return {value:{answerable:true,statements},choices};
 }
 let priorities=request.priorities;
 if(!priorities.length){
  const result:unknown=await session.execute('queryDataset',{datasetId:id,aggregate:{op:'count'},groupBy:[priority],limit:100});
  if(!record(result)||result.possiblyTruncated||!Array.isArray(result.rows))return session.abstain('truncated_evidence');
  if(result.rows.some(r=>!record(r)||typeof r[priority]!=='string'||!/^P\d{1,2}$/.test(r[priority] as string)))return session.abstain('ambiguous_rule');
  priorities=result.rows.map(r=>String(r[priority]));
 }
 if(!priorities.length||priorities.length>5)return session.abstain('ambiguous_rule');
 const collected:Array<{rule:typeof allRules[number];source:ReturnType<Session['evidence']>['csv'][number];rows:Record<string,unknown>[]}> = [];
 for(const category of priorities){
  const rules=allRules.filter(r=>r.priority===category);
  if(!rules.length||rules.some(r=>r.threshold!==rules[0].threshold||r.unit!==rules[0].unit)||rules[0].unit!==unit)return session.abstain('ambiguous_rule');
  const rule=rules[0];
  const result:unknown=await session.execute('queryDataset',{datasetId:id,filters:[{column:priority,op:'eq',value:category},{column:measure,op:request.op,value:rule.threshold}],sort:{column:measure,direction:'desc'},limit:100});
  if(!record(result)||typeof result.id!=='string')return session.abstain('unsupported_schema');
  const source=session.evidence().csv.find(s=>s.id===result.id);
  if(!source||source.possiblyTruncated||!source.rows.every(record))return session.abstain('truncated_evidence');
  const rows=source.rows as Record<string,unknown>[];
  if(rows.some(r=>r[priority]!==category||!number(r[measure])||!(request.op==='gt'?(r[measure] as number)>rule.threshold:(r[measure] as number)>=rule.threshold)||!['string','number'].includes(typeof r[ticket])))return session.abstain('unsupported_schema');
  collected.push({rule,source,rows});
 }
 if(collected.reduce((n,c)=>n+Math.max(1,c.rows.length),0)>8)return session.abstain('truncated_evidence');
 const choices=agentQuoteChoices(session.evidence());const statements=[];
 for(const {rule,source,rows} of collected){
  const doc=choices.find(c=>c.sourceId===rule.source.id&&c.quote.includes(rule.text));if(!doc)return session.abstain('unquotable_evidence');
  for(const row of rows.length?rows:[null]){
   const data=choices.find(c=>c.sourceId===source.id&&c.quote.includes(row?JSON.stringify(row):'[]'));if(!data)return session.abstain('unquotable_evidence');
   const text=row?`Ticket ${row[ticket]} (${rule.priority}): actual first-response time is ${row[measure]} ${unit}; the documented deadline is ${rule.threshold} ${unit}; difference is ${decimalDifference(row[measure] as number,rule.threshold)} ${unit}.`:`No ${rule.priority} tickets have first-response time ${request.op==='gt'?'greater than':'at or above'} the documented deadline of ${rule.threshold} ${unit}.`;
   if(text.length>2000||/\[[^\]]*\]/.test(text))return session.abstain('unsupported_schema');
   statements.push({text,citations:[{sourceId:doc.sourceId,quoteId:doc.quoteId},{sourceId:data.sourceId,quoteId:data.quoteId}]});
  }
 }
 return {value:{answerable:true,statements},choices};
}

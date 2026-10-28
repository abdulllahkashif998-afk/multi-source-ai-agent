import type {createAgentSession} from './agent-tools';
import {agentQuoteChoices} from './agent-answer-schema';

// Deliberately narrow: no filters, dates, policy comparisons or inferred roles.
// Other questions retain the general agent, including combined reasoning.
export function parseRoleCountQuestion(question:string){
 const match=/^how many (.+?) are (?:listed|recorded|present) in (.+\.csv)[?]?$/i.exec(question.trim());
 if(!match)return null;
 const roles=match[1].split(/\s+and\s+|,\s*/).map(s=>s.trim().toLowerCase());
 if(!roles.length||roles.length>2||roles.some(r=>!['student','students','teacher','teachers'].includes(r)))return null;
 const categories=roles.map(r=>r.replace(/s$/,''));if(new Set(categories).size!==categories.length)return null;
 const filename=match[2].trim();if(!filename||filename.length>255)return null;
 return {filename,categories};
}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
export async function tryStructuredRoleCount(question:string,session:ReturnType<typeof createAgentSession>){
 const request=parseRoleCountQuestion(question);if(!request)return null;
 const discovered:unknown=await session.execute('discoverDatasets',{});
 if(!object(discovered)||!Array.isArray(discovered.datasets))return null;
 const matches=discovered.datasets.filter((d:unknown)=>object(d)&&d.filename===request.filename&&typeof d.id==='string');
 if(matches.length!==1)return null;
 const inspected:unknown=await session.execute('inspectDataset',{datasetId:matches[0].id});
 if(!object(inspected)||!object(inspected.dataset)||!Array.isArray(inspected.dataset.columns))return null;
 const dataset=inspected.dataset;
 const columns=dataset.columns;if(!Array.isArray(columns))return null;
 const roleColumns=columns.filter((c:unknown)=>object(c)&&c.type==='text'&&typeof c.name==='string'&&['role','role_name','user_type','usertype','category'].includes(c.name.toLowerCase()));
 if(roleColumns.length!==1)return null;
 const column=roleColumns[0].name as string;
 const queried:unknown=await session.execute('queryDataset',{datasetId:matches[0].id,aggregate:{op:'count'},groupBy:[column],sort:{column,direction:'asc'},limit:100});
 if(!object(queried)||typeof queried.id!=='string')return null;
 const source=session.evidence().csv.find(s=>s.id===queried.id);
 if(!source||source.possiblyTruncated)return null;
 if(source.rows.some(r=>!object(r)||typeof r.value!=='number'||!Number.isSafeInteger(r.value)||r.value<0))return null;
 const rows=source.rows as Array<Record<string,unknown>&{value:number}>;
 if(rows.reduce((sum,r)=>sum+r.value,0)!==dataset.row_count)return null;
 const selected:typeof rows=[];
 for(const category of request.categories){
  const found=rows.filter(r=>typeof r[column]==='string'&&[category,category+'s'].includes((r[column] as string).trim().toLowerCase()));
  if(found.length!==1)return null;selected.push(found[0]);
 }
 const choices=agentQuoteChoices(session.evidence()),citations:Array<{sourceId:string;quoteId:string}>=[];
 for(const row of selected){const choice=choices.find(q=>q.sourceId===source.id&&q.quote.includes(JSON.stringify(row)));if(!choice)return null;if(!citations.some(c=>c.quoteId===choice.quoteId))citations.push({sourceId:source.id,quoteId:choice.quoteId});}
 const facts=selected.map((r,i)=>`${r.value} ${request.categories[i]}s`);
 const text=`There are ${facts.join(' and ')} listed in ${request.filename}.`;if(text.length>2000)return null;
 return {value:{answerable:true,statements:[{text,citations}]},choices};
}

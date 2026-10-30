import type {createAgentSession} from './agent-tools';
import {agentQuoteChoices} from './agent-answer-schema';

type Session=ReturnType<typeof createAgentSession>;
type Intent={kind:'listing';filename:string;region:string;direction:'asc'|'desc'}|{kind:'teams';filename:string}|{kind:'approval';filename:string};
type Reference={sourceId:string;quoteId:string};
type Statement={text:string;citations:Reference[]};
export function parseStructuredOperation(question:string):Intent|null{
 // Anchored grammars deliberately reject extra filters, dates and instructions.
 const listing=/^list the ([a-z][a-z -]{0,49})-region ([a-z][a-z0-9_-]{0,59}) amounts, (largest|smallest) first[.?]?$/i.exec(question.trim());
 if(listing)return {kind:'listing',filename:listing[2]+'.csv',region:listing[1],direction:listing[3].toLowerCase()==='largest'?'desc':'asc'};
 if(/^according to the policy, which teams fall short when all sales rows are added per team[?]?$/i.test(question.trim()))return {kind:'teams',filename:'sales.csv'};
 const approval=/^apply the travel approval rule to ([a-z0-9][a-z0-9 ._()-]{0,240}\.csv)\. who needs approval and by how much is the limit exceeded[?]?$/i.exec(question.trim());
 return approval?{kind:'approval',filename:approval[1]}:null;
}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function numeric(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER;}
// Exact subtraction of the decimal representations already returned by the query
// service. No binary subtraction artifacts or fixture-specific numeric constants.
export function decimalDifference(a:number,b:number){
 if(!numeric(a)||!numeric(b))throw Error('Invalid comparison operand');
 const parts=(n:number)=>{const m=/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(n))!;return {n:BigInt(m[1]+m[2]+(m[3]??'')),scale:(m[3]?.length??0)-Number(m[4]??0)};};
 const x=parts(a),y=parts(b),scale=Math.max(0,x.scale,y.scale);
 const value=x.n*BigInt(10)**BigInt(scale-x.scale)-y.n*BigInt(10)**BigInt(scale-y.scale);
 const sign=value<BigInt(0)?'-':'',digits=(value<BigInt(0)?-value:value).toString().padStart(scale+1,'0');
 const formatted=scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits;
 return sign+(formatted.includes('.')?formatted.replace(/0+$/,'').replace(/\.$/,''):formatted);
}
function policy(session:Session,kind:'teams'|'approval'){
 const pattern=kind==='teams'?/^(?:[a-z][a-z '-]{0,80} policy: )?the minimum monthly total sales target for each team is (\d+(?:\.\d+)?) (units)\.$/i:/^travel expenses above (\d+(?:\.\d+)?) (credits) require manager approval\.$/i;
 const relevant=session.evidence().documents.filter(s=>kind==='teams'?/sales target/i.test(s.text):/travel|approval|expenses/i.test(s.text));
 // Do not infer applicability, resolve conflicting policies, or ignore extra
 // conditions. Only a single complete, unqualified supported rule is eligible.
 if(relevant.length!==1)return null;
 const match=pattern.exec(relevant[0].text.trim());if(!match||!numeric(Number(match[1])))return null;
 return {source:relevant[0],threshold:Number(match[1]),unit:match[2]};
}
function statementsForRows(session:Session,sourceId:string,rows:Record<string,unknown>[],texts:string[],ruleSource?:{id:string;text:string}){
 const choices=agentQuoteChoices(session.evidence()),statements:Statement[]=[];
 if(rows.length>8||rows.length!==texts.length)return session.abstain('unsupported_schema');
 for(let i=0;i<rows.length;i++){
  const csv=choices.find(q=>q.sourceId===sourceId&&q.quote.includes(JSON.stringify(rows[i])));
  const doc=ruleSource?choices.find(q=>q.sourceId===ruleSource.id&&q.quote===ruleSource.text.trim()):undefined;
  if(!csv||(ruleSource&&!doc)||texts[i].length>2000||/\[[^\]]*\]/.test(texts[i]))return session.abstain('unsupported_schema');
  statements.push({text:texts[i],citations:[...(doc?[{sourceId:doc.sourceId,quoteId:doc.quoteId}]:[]),{sourceId:csv.sourceId,quoteId:csv.quoteId}]});
 }
 if(!statements.length)return session.abstain('unsupported_schema');
 return {value:{answerable:true,statements},choices};
}
export async function tryStructuredOperation(question:string,session:Session){
 const intent=parseStructuredOperation(question);if(!intent)return null;
 // These calls still use discovery/inspection, planSchema, compileCSVQuery,
 // owner-scoped read-only query execution, cancellation and tool-call limits.
 if(intent.kind!=='listing')await session.execute('searchDocuments',{question});
 const rule=intent.kind==='listing'?null:policy(session,intent.kind);
 if(intent.kind!=='listing'&&!rule)return session.abstain('unsupported_schema');
 const found:unknown=await session.execute('discoverDatasets',{});
 if(!record(found)||!Array.isArray(found.datasets))return session.abstain('unsupported_schema');
 const matches=found.datasets.filter(d=>record(d)&&typeof d.filename==='string'&&d.filename.toLowerCase()===intent.filename.toLowerCase());
 if(matches.length!==1||!record(matches[0])||typeof matches[0].id!=='string')return session.abstain('unsupported_schema');
 const id=matches[0].id;
 const inspected:unknown=await session.execute('inspectDataset',{datasetId:id});
 if(!record(inspected)||!record(inspected.dataset)||!Array.isArray(inspected.dataset.columns))return session.abstain('unsupported_schema');
 const dataset=inspected.dataset,columns=dataset.columns as unknown[];
 const required=intent.kind==='listing'?{region:'text',amount:'number'}:intent.kind==='teams'?{team:'text',amount:'number'}:{employee:'text',cost:'number'};
 if(Object.entries(required).some(([name,type])=>!columns.some(c=>record(c)&&c.name===name&&c.type===type)))return session.abstain('unsupported_schema');
 const plan=intent.kind==='listing'?{datasetId:id,filters:[{column:'region',op:'eq',value:intent.region}],sort:{column:'amount',direction:intent.direction},limit:100}:intent.kind==='teams'?{datasetId:id,aggregate:{op:'sum',column:'amount'},groupBy:['team'],sort:{column:'team',direction:'asc'},limit:100}:{datasetId:id,limit:100};
 const result:unknown=await session.execute('queryDataset',plan);
 if(!record(result)||typeof result.id!=='string')return session.abstain('unsupported_schema');
 const source=session.evidence().csv.find(s=>s.id===result.id);
 if(!source||source.possiblyTruncated||!source.rows.every(record))return session.abstain('unsupported_schema');
 const rows=source.rows as Record<string,unknown>[];
 if(intent.kind==='listing'){
  // Preserve individual row identity and duplicates: never SUM or GROUP BY.
  if(rows.length>8||rows.some(r=>r.region!==intent.region||!numeric(r.amount)))return session.abstain('unsupported_schema');
  const amounts=rows.map(r=>r.amount as number);
  if(amounts.some((v,i)=>i>0&&(intent.direction==='desc'?v>amounts[i-1]:v<amounts[i-1])))return session.abstain('unsupported_schema');
  return statementsForRows(session,source.id,rows,rows.map(r=>`${intent.region}-region ${intent.filename.slice(0,-4)} amount: ${r.amount}.`));
 }
 if(!rule)return session.abstain('unsupported_schema');
 if(intent.kind==='teams'){
  if(rows.some(r=>typeof r.team!=='string'||!numeric(r.value))||new Set(rows.map(r=>r.team)).size!==rows.length)return session.abstain('unsupported_schema');
  return statementsForRows(session,source.id,rows,rows.map(r=>{const actual=r.value as number;return `${r.team} total is ${actual} ${rule.unit}; the policy minimum is ${rule.threshold} ${rule.unit}; ${actual<rule.threshold?`shortfall is ${decimalDifference(rule.threshold,actual)} ${rule.unit}`:`meets the target; surplus is ${decimalDifference(actual,rule.threshold)} ${rule.unit}`}.`;}),rule.source);
 }
 // Whole-dataset rows let us explicitly cover equality without interpreting an
 // omitted/filtered row as zero or claiming an exhaustive result from a limit.
 if(rows.length!==dataset.row_count||rows.some(r=>typeof r.employee!=='string'||!numeric(r.cost))||new Set(rows.map(r=>r.employee)).size!==rows.length)return session.abstain('unsupported_schema');
 return statementsForRows(session,source.id,rows,rows.map(r=>{const actual=r.cost as number;return `${r.employee} cost is ${actual} ${rule.unit}; the approval limit is ${rule.threshold} ${rule.unit}; ${actual>rule.threshold?`approval required; excess is ${decimalDifference(actual,rule.threshold)} ${rule.unit}`:'approval is not required because the amount is at or below the limit'}.`;}),rule.source);
}

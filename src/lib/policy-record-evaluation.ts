import {utcTimestamp,type PolicyContract,type Metric} from './policy-predicates';
import type {Column} from './generic-csv';
export interface PolicySummaryRow {priority:string;applicable:number;notApplicable:number;unknownApplicability:number;firstResponseLate:number;firstResponseOnTime:number;maintenanceExcluded:number;unknownFirstResponse:number;resolutionLate:number;resolutionOnTime:number;unknownResolution:number}
export function evaluatePolicyRecords(contract:PolicyContract,columns:Column[],rows:unknown[]){
 const expected:Array<[string,Column['type']]>=[[contract.organization.column,'text'],[contract.period.column,'text'],[contract.priority,'text'],[contract.metrics.first_response.column,'number'],[contract.metrics.resolution.column,'number'],[contract.maintenance.flag,contract.maintenance.affirmative==='true'?'boolean':'text'],[contract.maintenance.notice,'number']];
 const idColumn=columns.filter(c=>c.name===contract.identifier);
 if(idColumn.length!==1||!['text','number'].includes(idColumn[0].type))throw Error('Unsupported identifier type');
 if(expected.some(([name,type])=>columns.filter(c=>c.name===name&&c.type===type).length!==1)||new Set([...expected.map(([n])=>n),contract.identifier]).size!==expected.length+1||rows.length>=100)throw Error('Unsupported policy bindings');
 const summaries=new Map<string,PolicySummaryRow>(),seen=new Set<string>();
 const classified=rows.map(input=>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid policy row');const row=input as Record<string,unknown>;
  const rawId=row[contract.identifier],identifier=String(rawId);if((idColumn[0].type==='text'?(typeof rawId!=='string'||!rawId):(typeof rawId!=='number'||!Number.isSafeInteger(rawId)))||seen.has(identifier))throw Error('Invalid record identity');seen.add(identifier);
  const category=row[contract.priority],priority=typeof category==='string'&&Object.hasOwn(contract.metrics.first_response.rules,category)?category:'(unknown)';
  if(!summaries.has(priority))summaries.set(priority,{priority,applicable:0,notApplicable:0,unknownApplicability:0,firstResponseLate:0,firstResponseOnTime:0,maintenanceExcluded:0,unknownFirstResponse:0,resolutionLate:0,resolutionOnTime:0,unknownResolution:0});
  const summary=summaries.get(priority)!;
  const organization=row[contract.organization.column],at=utcTimestamp(row[contract.period.column]);
  const organizationKnown=typeof organization==='string'&&organization.trim().length>0;
  const dateMatches=at!==undefined&&(contract.period.includeStart?at>=contract.period.start:at>contract.period.start)&&(contract.period.includeEnd?at<=contract.period.end:at<contract.period.end);
  const scope=organizationKnown&&organization!==contract.organization.value||at!==undefined&&!dateMatches?'not_applicable':!organizationKnown||at===undefined?'unknown':'applicable';
  summary[scope==='applicable'?'applicable':scope==='unknown'?'unknownApplicability':'notApplicable']++;
  const result:Record<Metric,string>={first_response:scope,resolution:scope};
  if(scope==='applicable')for(const metric of ['first_response','resolution'] as const){
   const value=row[contract.metrics[metric].column],threshold=contract.metrics[metric].rules[priority];
   let state='unknown';
   if(threshold!==undefined){
    const valid=typeof value==='number'&&Number.isFinite(value)&&value>=0;
    state=valid?(Number(value)>threshold?'late':'on_time'):'unknown';
    if(metric==='first_response'){
     const flag=row[contract.maintenance.flag],notice=row[contract.maintenance.notice];
     if(flag===(contract.maintenance.affirmative==='true'?true:'yes'))state=typeof notice!=='number'||!Number.isFinite(notice)||notice<0?'unknown':notice>=contract.maintenance.minimum?'excluded':state;
     else if(flag!==(contract.maintenance.affirmative==='true'?false:'no'))state='unknown';
    }
   }
   result[metric]=state;
   const key=metric==='first_response'?(state==='late'?'firstResponseLate':state==='on_time'?'firstResponseOnTime':state==='excluded'?'maintenanceExcluded':'unknownFirstResponse'):(state==='late'?'resolutionLate':state==='on_time'?'resolutionOnTime':'unknownResolution');summary[key]++;
  }
  return {identifier,priority,scope,...result};
 });
 return {rows:[...summaries.values()].sort((a,b)=>a.priority.localeCompare(b.priority)),classified};
}

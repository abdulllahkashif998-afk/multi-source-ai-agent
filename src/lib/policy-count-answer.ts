import type {PolicyContract,Metric} from './policy-predicates';
import type {PolicySummaryRow} from './policy-record-evaluation';
export function policyCountStatements(contract:PolicyContract,rows:PolicySummaryRow[],metric:Metric){
 const late=metric==='first_response'?'firstResponseLate':'resolutionLate',unknown=metric==='first_response'?'unknownFirstResponse':'unknownResolution';
 const totals=rows.reduce((a,r)=>({late:a.late+r[late],unknown:a.unknown+r[unknown],scopeUnknown:a.scopeUnknown+r.unknownApplicability,outside:a.outside+r.notApplicable,applicable:a.applicable+r.applicable}),{late:0,unknown:0,scopeUnknown:0,outside:0,applicable:0});
 return {totals,statements:[
  {kind:'scope' as const,text:`Counts are limited to known-applicable records: ${contract.organization.column} equals ${contract.organization.value}; ${contract.period.column} ${contract.period.includeStart?'>=':'>'} ${contract.period.startText} and ${contract.period.includeEnd?'<=':'<'} ${contract.period.endText}.`,row:0},
  ...(metric==='first_response'?[{kind:'maintenance' as const,text:`First-response exclusions require ${contract.maintenance.flag}=${contract.maintenance.affirmative} and known ${contract.maintenance.notice} >= ${contract.maintenance.minimum} hours; missing evidence is unresolved.`,row:0}]:[{kind:'resolutionMaintenance' as const,text:'Maintenance does not exempt known-applicable records from resolution scoring.',row:0}]),
  ...rows.map((r,index)=>({kind:metric,text:`${r.priority}: ${r[late]} confirmed ${metric==='first_response'?'first-response':'resolution'} violations among ${r.applicable} known-applicable records; ${r[unknown]} metric outcomes unresolved. ${Object.hasOwn(contract.metrics[metric].rules,r.priority)?`The deadline is ${contract.metrics[metric].rules[r.priority]} ${contract.metrics[metric].rules[r.priority]===1?'hour':'hours'}; equality is on time.`:'Priority has no supported deadline.'}`,row:index})),
  {kind:'scope' as const,text:`Confirmed total: ${totals.late}. There are ${totals.scopeUnknown} records with unknown applicability, ${totals.unknown} unresolved in-scope metric outcomes, and ${totals.outside} outside-scope records. ${totals.scopeUnknown||totals.unknown?'This is a qualified confirmed count, not an unconditional complete total.':'No unresolved applicability or in-scope metric outcomes remain.'}`,row:rows.length},
 ]};
}

import {retrievalMetrics,distribution,mean} from './metrics';
export function rankingMetrics(ranked:string[],relevant:string[]){
 const at1=retrievalMetrics(ranked,relevant,1),at3=retrievalMetrics(ranked,relevant,3),gold=new Set(relevant);
 const first=ranked.slice(0,3).findIndex(id=>gold.has(id));
 return {recall1:at1.recall,precision1:at1.precision,recall3:at3.recall,precision3:at3.precision,reciprocalRank3:gold.size?(first<0?0:1/(first+1)):null,hit3:gold.size?(first<0?0:1):null,falsePositiveSlots:ranked.slice(0,3).filter(id=>!gold.has(id)).length,falsePositives:[...new Set(ranked.slice(0,3).filter(id=>!gold.has(id)))],missed:[...gold].filter(id=>!ranked.slice(0,3).includes(id)),returned:ranked.slice(0,3).length};
}
export interface RankedObservation {ranked:string[];eligible:string[];durationMs:number}
export function aggregateRankings(rows:Array<RankedObservation&{relevant:string[]}>){
 const metrics=rows.map(r=>rankingMetrics(r.ranked,r.relevant)),eligible=rows.map(r=>rankingMetrics(r.eligible,r.relevant));
 const aggregate=(values:ReturnType<typeof rankingMetrics>[])=>({recall1:mean(values.map(m=>m.recall1)),precision1:mean(values.map(m=>m.precision1)),recall3:mean(values.map(m=>m.recall3)),precision3:mean(values.map(m=>m.precision3)),mrr3:mean(values.map(m=>m.reciprocalRank3)),hitRate3:mean(values.map(m=>m.hit3))});
 const empty=rows.filter(r=>r.relevant.length===0);
 return {observations:rows.length,raw:aggregate(metrics),eligible:aggregate(eligible),latencyMs:distribution(rows.map(r=>r.durationMs)),emptyGold:{observations:empty.length,rawNonempty:empty.filter(r=>r.ranked.length).length,eligibleNonempty:empty.filter(r=>r.eligible.length).length},falsePositiveSlots:metrics.reduce((n,m)=>n+m.falsePositiveSlots,0),missedLabels:metrics.reduce((n,m)=>n+m.missed.length,0)};
}

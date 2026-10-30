import {encode} from 'gpt-tokenizer/encoding/o200k_harmony';
import type {createAgentSession} from './agent-tools';
// Request-local only. Never cache schemas across users or treat them as evidence.
export async function preparePlanningCatalog(session:ReturnType<typeof createAgentSession>){
 const discovery=await session.execute('discoverDatasets',{});
 if(!discovery||typeof discovery!=='object'||!('datasets' in discovery)||!Array.isArray(discovery.datasets))return {datasets:[],discoveryUnavailable:true};
 const datasets=[];
 // Keep both added context and backend work bounded. Other schemas remain
 // available through normal discovery/inspection tools when needed.
 for(const candidate of discovery.datasets.slice(0,3)){
  if(!candidate||typeof candidate.id!=='string')continue;
  const metadata=session.inspectDiscoveredDataset(candidate.id);
  if(!metadata)continue;
  if(encode(JSON.stringify([...datasets,metadata]),{disallowedSpecial:new Set()}).length>480){
   const summary={id:candidate.id,filename:candidate.filename,schemaOmitted:true};
   if(encode(JSON.stringify([...datasets,summary]),{disallowedSpecial:new Set()}).length<=480)datasets.push(summary);
   continue;
  }
  const inspected=await session.execute('inspectDataset',{datasetId:candidate.id});
  if(inspected&&typeof inspected==='object'&&'dataset' in inspected&&inspected.dataset)datasets.push(inspected.dataset);
 }
 return {datasets,additionalDatasetsRequireDiscovery:discovery.datasets.length>datasets.filter(d=>!('schemaOmitted' in d)).length};
}
export const AGENT_PLANNING_OUTPUT_TOKENS=1536;

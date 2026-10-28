import {createAgentSession} from '../src/lib/agent-tools';
import {selectEvidence,validateGroundedAnswer} from '../src/lib/rag-answer';
import {prepareCSV} from '../src/lib/generic-csv';
import {corpusDocuments,datasets,relevantSource,type EvalCase} from './fixtures';
import type {Adapter} from './runner';
export function fixtureSearch(c:EvalCase){const gold=relevantSource(c);return [...gold,...corpusDocuments(c.corpus).filter(d=>!gold.some(g=>g.id===d.id))].slice(0,3).map((d,index)=>({document_id:d.id,chunk_id:d.chunkId,filename:d.filename,chunk_index:d.index,page_number:d.page,chunk_text:d.text,similarity:0.95-index*.02}));}
export const mockAdapter:Adapter=async(c,context,signal)=>{
 signal.throwIfAborted();
 if(c.category!=='csv')for(const mode of ['semantic','hybrid'] as const)context.retrieval({mode,ranked:fixtureSearch(c).map(r=>r.chunk_id),durationMs:null});
 const started=performance.now();
 if(c.system==='chat'){
  const evidence=selectEvidence(fixtureSearch(c),.5);
  const citations=c.relevantChunks.map(id=>{const s=evidence.find(e=>e.chunkId===id)!;return {sourceId:s.id,quote:s.text};});
  context.answer(validateGroundedAnswer({answerable:!c.refuse,statements:c.refuse?[]:[{text:c.expectedAnswer,citations}]},evidence));
 }else{
  const session=createAgentSession({search:async()=>fixtureSearch(c),discover:async()=>datasets.map(d=>({id:d.id,filename:d.filename,columns:prepareCSV(d.csv).columns,row_count:prepareCSV(d.csv).rows.length})),query:async()=>c.expectedRows??[]},signal,.5);
  if(c.relevantChunks.length)await session.execute('searchDocuments',{question:c.question});
  if(c.plan){await session.execute('discoverDatasets',{});await session.execute('inspectDataset',{datasetId:c.plan.datasetId});await session.execute('queryDataset',c.plan);}
  const evidence=session.evidence();const citations=[...evidence.documents.filter(s=>c.relevantChunks.includes(s.chunkId)).map(s=>({sourceId:s.id,quote:s.text})),...evidence.csv.map(s=>({sourceId:s.id,quote:s.text}))];
  context.answer(session.finalize({answerable:!c.refuse,statements:c.refuse?[]:[{text:c.expectedAnswer,citations}]}));
 }
 context.stage({stage:'answer-end-to-end',durationMs:performance.now()-started,outcome:'ok'});
};

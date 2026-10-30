// Only the model-facing view is compacted. Session evidence remains unchanged.
export function modelToolResult(value:unknown,seen:Set<string>):unknown{
 if(!value||typeof value!=='object')return value;
 const v=value as Record<string,unknown>;
 if(Array.isArray(v.sources))return {sources:v.sources.map(s=>modelToolResult(s,seen))};
 if(typeof v.id==='string'&&/^[DC]\d+$/.test(v.id)){
  if(seen.has(v.id))return {id:v.id,previouslyRetrieved:true};seen.add(v.id);
  if('rows' in v){const {text,plan,...rest}=v;void text;void plan;return rest;}
 }
 return value;
}
export function sourceCatalog(evidence:{documents:ReadonlyArray<{id:string;filename:string;documentId:string;chunkId:string}>;csv:ReadonlyArray<{id:string;filename:string;datasetId:string;plan:unknown;possiblyTruncated:boolean}>}){
 return [...evidence.documents.map(({id,filename,documentId,chunkId})=>({id,filename,documentId,chunkId})),...evidence.csv.map(({id,filename,datasetId,plan,possiblyTruncated})=>({id,filename,datasetId,plan,possiblyTruncated}))];
}

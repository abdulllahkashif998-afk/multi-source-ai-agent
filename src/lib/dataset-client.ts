import { z } from 'zod';
import { AuthUiError, getBrowserSession } from './auth-client';
import { planSchema, type CSVQueryPlan } from './csv-query-schema';
const idSchema=z.string().regex(/^[1-9]\d{0,18}$/).refine(value=>/^[1-9]\d{0,18}$/.test(value)&&BigInt(value)<=BigInt('9223372036854775807'));
export const columnSchema=z.object({name:z.string().min(1).max(200),type:z.enum(['number','boolean','text'])});
export const datasetSchema=z.object({id:idSchema,filename:z.string(),row_count:z.number().int().nonnegative(),columns:z.array(columnSchema).min(1).max(100)});
export type DatasetItem=z.infer<typeof datasetSchema>;
export type DatasetColumn=z.infer<typeof columnSchema>;
export type QueryRow=Record<string,string|number|boolean|null>;
export type QueryDraft={operation:'rows'|'count'|'sum'|'avg';aggregateColumn:string;groupBy:string[];sortColumn:string;direction:'asc'|'desc';limit:string;filters:Array<{key:number;column:string;op:'eq'|'ne'|'gt'|'gte'|'lt'|'lte';value:string}>};
export const emptyQuery=():QueryDraft=>({operation:'rows',aggregateColumn:'',groupBy:[],sortColumn:'',direction:'asc',limit:'20',filters:[]});
const messages:Record<string,string>={
 INVALID_FILE:'Choose a nonempty CSV file up to 10 MiB.',
 IDENTICAL_DATASET:'This dataset already contains the same data. No changes were made.',
 MUTATION_FAILED:'The dataset could not be changed. Refresh the list before trying again.',
 DATASET_UNAVAILABLE:'This dataset is no longer available. Refresh the list.',
 MUTATION_INTERRUPTED:'The response was interrupted. Refresh the dataset list before trying again; the change may have completed.',
 IMPORT_FAILED:'This CSV could not be imported. Check for unique column headings and at least one consistent data row.',
 LIST_FAILED:'Datasets could not be loaded. Please try again.',
 QUERY_FAILED:'The query could not be completed. Check your settings or refresh the dataset list.',
 INVALID_QUERY:'Check the selected columns, filter values, grouping, sorting, and row limit.',
 CSRF_REJECTED:'This request could not be verified. Refresh the page and try again.',
 UPLOAD_INTERRUPTED:'The upload response was interrupted. Refresh the dataset list before uploading again.',
};
export class DatasetUiError extends Error{constructor(public code:string){super(messages[code]??'The dataset request could not be completed. Please try again.');}}
export function validateCSVFile(file:File){
 if(!file||!file.name.toLowerCase().endsWith('.csv')||!file.size||file.size>10*1024*1024||file.name.length>255||/[\\/\x00-\x1f]/.test(file.name))throw new DatasetUiError('INVALID_FILE');return file;
}
export function buildDatasetPlan(dataset:DatasetItem,draft:QueryDraft):CSVQueryPlan{
 const invalid=()=>new DatasetUiError('INVALID_QUERY');
 const column=(name:string)=>{const found=dataset.columns.find(c=>c.name===name);if(!found)throw invalid();return found;};
 if(!/^[1-9]\d{0,2}$/.test(draft.limit))throw invalid();
 const filters=draft.filters.map(filter=>{
  const type=column(filter.column).type;
  let value:string|number|boolean=filter.value;
  if(type==='number'){
   if(!filter.value.trim()||!Number.isFinite(Number(filter.value))||Math.abs(Number(filter.value))>Number.MAX_SAFE_INTEGER)throw invalid();value=Number(filter.value);
  }else if(type==='boolean'){
   if(!['eq','ne'].includes(filter.op)||!['true','false'].includes(filter.value))throw invalid();value=filter.value==='true';
  }
  return {column:filter.column,op:filter.op,value};
 });
 const groupBy=[...new Set(draft.groupBy)];groupBy.forEach(column);
 if((draft.operation==='rows'&&groupBy.length)||groupBy.includes('value'))throw invalid();
 let aggregate:CSVQueryPlan['aggregate'];
 if(draft.operation!=='rows'){
  if(draft.operation==='count')aggregate={op:'count'};
  else {if(column(draft.aggregateColumn).type!=='number')throw invalid();aggregate={op:draft.operation,column:draft.aggregateColumn};}
 }
 if(draft.sortColumn){
  if(aggregate){if(draft.sortColumn!=='value'&&!groupBy.includes(draft.sortColumn))throw invalid();}
  else column(draft.sortColumn);
 }
 const parsed=planSchema.safeParse({datasetId:dataset.id,filters,groupBy,...(aggregate?{aggregate}:{}),...(draft.sortColumn?{sort:{column:draft.sortColumn,direction:draft.direction}}:{}),limit:Number(draft.limit)});
 if(!parsed.success)throw invalid();return parsed.data;
}
async function send(path:string,init:RequestInit|undefined,signal:AbortSignal|undefined,operation:'list'|'upload'|'query'|'replace'|'delete'){
 let response:Response;
 const timeout=AbortSignal.timeout(operation==='upload'||operation==='replace'?45_000:15_000);
 try{response=await fetch(path,{...init,credentials:'same-origin',cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout});}
 catch{throw new DatasetUiError(operation==='upload'?'UPLOAD_INTERRUPTED':operation==='replace'||operation==='delete'?'MUTATION_INTERRUPTED':operation==='list'?'LIST_FAILED':'QUERY_FAILED');}
 let body;try{body=await response.json();}catch{throw new DatasetUiError(operation==='upload'?'UPLOAD_INTERRUPTED':operation==='replace'||operation==='delete'?'MUTATION_INTERRUPTED':operation==='list'?'LIST_FAILED':'QUERY_FAILED');}
 if(response.status===401)throw new AuthUiError('UNAUTHENTICATED');
 if(response.status===403)throw new DatasetUiError('CSRF_REJECTED');
 if(response.status===409&&operation==='replace'&&body?.code==='IDENTICAL_DATASET')throw new DatasetUiError('IDENTICAL_DATASET');
 if(response.status===404&&(operation==='replace'||operation==='delete'))throw new DatasetUiError('DATASET_UNAVAILABLE');
 if(!response.ok||body?.success!==true)throw new DatasetUiError(operation==='upload'?'IMPORT_FAILED':operation==='replace'||operation==='delete'?'MUTATION_FAILED':operation==='list'?'LIST_FAILED':'QUERY_FAILED');
 return body;
}
export async function fetchDatasets(signal?:AbortSignal):Promise<DatasetItem[]>{
 const body=await send('/api/datasets',undefined,signal,'list');
 const parsed=z.array(datasetSchema).max(100).safeParse(body.datasets);if(!parsed.success)throw new DatasetUiError('LIST_FAILED');return parsed.data;
}
export async function uploadDataset(file:File,signal?:AbortSignal){
 validateCSVFile(file);const session=await getBrowserSession();signal?.throwIfAborted();
 const form=new FormData();form.set('file',file);
 const body=await send('/api/datasets',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken},body:form},signal,'upload');
 const parsed=z.object({datasetId:idSchema,importedRows:z.number().int().nonnegative(),columns:z.array(columnSchema).min(1).max(100)}).safeParse(body);
 if(!parsed.success)throw new DatasetUiError('UPLOAD_INTERRUPTED');return parsed.data;
}
export async function runDatasetQuery(dataset:DatasetItem,draft:QueryDraft,signal?:AbortSignal){
 const plan=buildDatasetPlan(dataset,draft);
 const serialized=JSON.stringify(plan);if(new TextEncoder().encode(serialized).byteLength>16384)throw new DatasetUiError('INVALID_QUERY');
 const session=await getBrowserSession();signal?.throwIfAborted();
 const body=await send('/api/datasets/query',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:serialized},signal,'query');
 const expectedColumns=plan.aggregate?[...plan.groupBy,'value']:dataset.columns.map(column=>column.name);
 const scalar=(value:unknown)=>value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value));
 if(!Array.isArray(body.rows)||body.rows.length>plan.limit||!body.rows.every((row:unknown)=>row!==null&&typeof row==='object'&&!Array.isArray(row)&&Object.values(row).every(scalar)&&expectedColumns.every(name=>Object.hasOwn(row,name))))throw new DatasetUiError('QUERY_FAILED');
 return {plan,rows:body.rows as QueryRow[]};
}

export async function replaceDatasetFile(id:string,file:File,signal?:AbortSignal){
 if(!idSchema.safeParse(id).success)throw new DatasetUiError('MUTATION_FAILED');
 validateCSVFile(file);const session=await getBrowserSession();signal?.throwIfAborted();
 const form=new FormData();form.set('file',file);
 const body=await send(`/api/datasets/${id}`,{method:'PUT',headers:{'X-CSRF-Token':session.csrfToken},body:form},signal,'replace');
 const result=z.object({datasetId:idSchema,importedRows:z.number().int().positive(),columns:z.array(columnSchema).min(1).max(100)}).safeParse(body);
 if(!result.success||result.data.datasetId!==id)throw new DatasetUiError('MUTATION_INTERRUPTED');return result.data;
}
export async function removeDataset(id:string,signal?:AbortSignal){
 if(!idSchema.safeParse(id).success)throw new DatasetUiError('MUTATION_FAILED');
 const session=await getBrowserSession();signal?.throwIfAborted();
 const body=await send(`/api/datasets/${id}`,{method:'DELETE',headers:{'X-CSRF-Token':session.csrfToken}},signal,'delete');
 if(body.datasetId!==id)throw new DatasetUiError('MUTATION_INTERRUPTED');
}

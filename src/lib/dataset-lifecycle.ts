import pool, { timedQuery } from './db';
import { requireUserId } from './identity';
import { prepareCSV } from './generic-csv';

export class DatasetMutationError extends Error {
 constructor(public status:400|404|409,public code:'INVALID_DATASET'|'INVALID_FILE'|'DATASET_UNAVAILABLE'|'IDENTICAL_DATASET'){
  super(code==='IDENTICAL_DATASET'?'This dataset already contains the same data. No changes were made.':code==='DATASET_UNAVAILABLE'?'Dataset unavailable.':code==='INVALID_FILE'?'Provide a valid CSV file up to 10 MiB with unique headings and consistent rows.':'Invalid dataset ID.');
 }
}
export function datasetId(value:string){
 if(!/^[1-9]\d{0,18}$/.test(value)||BigInt(value)>BigInt('9223372036854775807'))throw new DatasetMutationError(400,'INVALID_DATASET');
 return value;
}
export async function readDatasetUpload(request:Request){
 let form:FormData;try{form=await request.formData();}catch{throw new DatasetMutationError(400,'INVALID_FILE');}
 const files=form.getAll('file'),file=files[0];
 if(files.length!==1||!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv')||!file.size||file.size>10*1024*1024||file.name.length>255||/[\\/\x00-\x1f]/.test(file.name))throw new DatasetMutationError(400,'INVALID_FILE');
 return file;
}
async function mutate(id:string,replacement:{filename:string;content:string}|undefined,signal?:AbortSignal){
 const owner=requireUserId();datasetId(id);signal?.throwIfAborted();
 let parsed:ReturnType<typeof prepareCSV>|undefined;
 if(replacement){
  if(!replacement.filename.toLowerCase().endsWith('.csv')||replacement.filename.length>255||/[\\/\x00-\x1f]/.test(replacement.filename))throw new DatasetMutationError(400,'INVALID_FILE');
  try{parsed=prepareCSV(replacement.content);}catch{throw new DatasetMutationError(400,'INVALID_FILE');}
 }
 const client=await pool.connect();
 try{
  await timedQuery(()=>client.query('BEGIN'));
  await timedQuery(()=>client.query("SET LOCAL statement_timeout = '10s'"));
  await timedQuery(()=>client.query("SET LOCAL lock_timeout = '5s'"));
  const owned=await timedQuery(()=>client.query("SELECT id FROM generic_csv_datasets WHERE id=$1 AND user_id=$2 AND status='ready' FOR UPDATE",[id,owner]));
  if(!owned.rows.length)throw new DatasetMutationError(404,'DATASET_UNAVAILABLE');
  signal?.throwIfAborted();
  if(parsed){
   // Compare parsed typed content, not CSV bytes or filename. The owner row lock
   // serializes this check with replacement/deletion, including older datasets.
   const comparison=await timedQuery(()=>client.query(`SELECT columns=$2::jsonb AND
    (SELECT coalesce(jsonb_agg(data ORDER BY row_index),'[]'::jsonb)
     FROM generic_csv_rows WHERE dataset_id=$1)=$3::jsonb AS identical
    FROM generic_csv_datasets WHERE id=$1 AND user_id=$4`,[id,JSON.stringify(parsed.columns),JSON.stringify(parsed.rows),owner]));
   if(comparison.rows[0]?.identical===true)throw new DatasetMutationError(409,'IDENTICAL_DATASET');
   signal?.throwIfAborted();
  }
  await timedQuery(()=>client.query('DELETE FROM generic_csv_rows WHERE dataset_id=$1',[id]));
  if(parsed&&replacement){
   await timedQuery(()=>client.query('INSERT INTO generic_csv_rows(dataset_id,row_index,data) SELECT $1, ordinality - 1, value FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY',[id,JSON.stringify(parsed.rows)]));
   await timedQuery(()=>client.query("UPDATE generic_csv_datasets SET filename=$3,columns=$4,row_count=$5 WHERE id=$1 AND user_id=$2",[id,owner,replacement.filename,JSON.stringify(parsed.columns),parsed.rows.length]));
  }else await timedQuery(()=>client.query('DELETE FROM generic_csv_datasets WHERE id=$1 AND user_id=$2',[id,owner]));
  signal?.throwIfAborted();
  await timedQuery(()=>client.query('COMMIT'));
  return parsed?{datasetId:id,importedRows:parsed.rows.length,columns:parsed.columns}:{datasetId:id};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}
export function replaceDataset(id:string,filename:string,content:string,signal?:AbortSignal){return mutate(id,{filename,content},signal);}
export function deleteDataset(id:string,signal?:AbortSignal){return mutate(id,undefined,signal);}
export function datasetMutationFailure(error:unknown){
 const known=error instanceof DatasetMutationError;
 return Response.json({success:false,code:known?error.code:'DATASET_MUTATION_FAILED',error:known?error.message:'The dataset could not be changed. Refresh the list before trying again.'},{status:known?error.status:503,headers:{'Cache-Control':'no-store'}});
}

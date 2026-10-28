import {mock} from 'node:test';
import pool from '../src/lib/db';
import {prepareCSV} from '../src/lib/generic-csv';
import type {RetrievalDocument} from './retrieval-fixtures';
import {corpusDocuments,datasets,owner,foreignOwner,type EvalCase} from './fixtures';
export interface FixtureConnection {query:(sql:string,values?:unknown[])=>Promise<unknown>;release:()=>void}
export async function withFixtureDatabase<T>(c:EvalCase,embeddings:Map<string,number[]>,work:()=>Promise<T>,extraDocuments:readonly RetrievalDocument[]=[]):Promise<T>{
 const client=await pool.connect(),raw=client.query.bind(client);let restoreQuery:()=>void=()=>{},restoreConnect:()=>void=()=>{};
 try{
  await raw('BEGIN');await raw("SET LOCAL statement_timeout='10s'");
  for(const table of ['documents','document_chunks','generic_csv_datasets','generic_csv_rows']){
   // No defaults/identity/FKs from public: fixture inserts always supply IDs.
   await raw(`CREATE TEMP TABLE ${table} (LIKE public.${table}) ON COMMIT DROP`);
   const result=await raw("SELECT n.nspname FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace WHERE r.oid=$1::regclass",[table]);
   if(!result.rows[0]?.nspname?.startsWith('pg_temp_'))throw Error('Fixture isolation failed');
  }
  const docs:Array<RetrievalDocument&{userId:string;status:string}>=corpusDocuments(c.corpus).map(d=>({...d,userId:owner,status:'ready'}));
  const base=docs[0];
  for(const decoy of [{id:'91',chunkId:'191',userId:foreignOwner,status:'ready'},{id:'92',chunkId:'192',userId:owner,status:'deleted'},{id:'93',chunkId:'193',userId:owner,status:'processing'}])docs.push({...base,...decoy} as typeof base);
  for(const document of extraDocuments)docs.push({...document,userId:document.userId??owner,status:document.status??'ready'});
  if(new Set(docs.map(d=>d.id)).size!==docs.length||new Set(docs.map(d=>d.chunkId)).size!==docs.length)throw Error('Duplicate fixture identifiers');
  for(const d of docs){
   await raw('INSERT INTO documents(id,user_id,filename,file_path,file_hash,status,version,uploaded_at) VALUES($1,$2,$3,$4,$5,$6,1,$7)',[d.id,d.userId,d.filename,'fictional-evaluation-no-stored-file',`fixture-${d.id}`,d.status,'2026-01-01T00:00:00Z']);
   const vector=embeddings.get(d.text);if(!vector)throw Error('Missing fixture embedding');
   await raw('INSERT INTO document_chunks(id,document_id,chunk_index,chunk_text,embedding,page_number) VALUES($1,$2,$3,$4,$5::vector,$6)',[d.chunkId,d.id,d.index,d.text,JSON.stringify(vector),d.page]);
  }
  // Explicit identities prevent advancement of any public sequence.
  for(const dataset of datasets){const data=prepareCSV(dataset.csv);await raw("INSERT INTO generic_csv_datasets(id,user_id,filename,columns,status,row_count,created_at) VALUES($1,$2,$3,$4,'ready',$5,'2026-01-01T00:00:00Z')",[dataset.id,owner,dataset.filename,JSON.stringify(data.columns),data.rows.length]);
   for(const [index,row] of data.rows.entries())await raw('INSERT INTO generic_csv_rows(dataset_id,row_index,data) VALUES($1,$2,$3)',[dataset.id,index,JSON.stringify(row)]);
  }
  let counter=0;const savepoints:string[]=[];
  const query=async(input:string|{text:string;values?:unknown[]},values?:unknown[])=>{
   const sql=typeof input==='string'?input:input.text,parameters=typeof input==='string'?values:input.values;
   if(sql.startsWith('BEGIN')){const name=`eval_operation_${++counter}`;savepoints.push(name);return raw(`SAVEPOINT ${name}`);}
   if(sql==='COMMIT'){const name=savepoints.pop();if(!name)throw Error('Unbalanced fixture transaction');return raw(`RELEASE SAVEPOINT ${name}`);}
   if(sql==='ROLLBACK'){const name=savepoints.pop();if(!name)throw Error('Unbalanced fixture transaction');await raw(`ROLLBACK TO SAVEPOINT ${name}`);return raw(`RELEASE SAVEPOINT ${name}`);}
   return typeof input==='string'?raw(sql,parameters):raw(input);
  };
  const q=mock.method(pool,'query',query as typeof pool.query);restoreQuery=()=>q.mock.restore();
  let lease=Promise.resolve();
  const connect=mock.method(pool,'connect',(async()=>{let unlock=()=>{};const next=new Promise<void>(resolve=>{unlock=resolve;});const previous=lease;lease=previous.then(()=>next);await previous;return {query,release:unlock};}) as unknown as typeof pool.connect);restoreConnect=()=>connect.mock.restore();
  return await work();
 }finally{restoreConnect();restoreQuery();try{await raw('ROLLBACK');}finally{client.release(true);}}
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { AuthUiError } from '@/src/lib/auth-client';
import { DatasetUiError, fetchDatasets, uploadDataset, validateCSVFile, type DatasetItem } from '@/src/lib/dataset-client';
import { DatasetExplorer } from './dataset-explorer';
export function DatasetManager(){
 const [datasets,setDatasets]=useState<DatasetItem[]>([]),[selected,setSelected]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[listError,setListError]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const operation=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null),selectAfterLoad=useRef<string|null>(null);
 function message(caught:unknown){
  if(caught instanceof AuthUiError&&caught.code==='UNAUTHENTICATED'){window.location.replace('/login?reason=expired');return '';}
  return caught instanceof DatasetUiError||caught instanceof AuthUiError?caught.message:'The dataset request could not be completed. Please try again.';
 }
 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   setLoading(true);setListError('');
   try{const rows=await fetchDatasets(controller.signal);if(!controller.signal.aborted){
    setDatasets(rows);const desired=selectAfterLoad.current;selectAfterLoad.current=null;
    setSelected(current=>desired&&rows.some(d=>d.id===desired)?desired:rows.some(d=>d.id===current)?current:null);
    if(desired&&!rows.some(d=>d.id===desired))setSuccess(rows.length===100?'CSV uploaded. This dataset is outside the current 100-dataset discovery limit.':'CSV uploaded, but it is not visible in discovery yet. Refresh the list before uploading again.');
   }}catch(caught){if(!controller.signal.aborted){setDatasets([]);setSelected(null);setListError(message(caught));}}
   finally{if(!controller.signal.aborted)setLoading(false);}
  }
  void load();return()=>controller.abort();
 },[revision]);
 useEffect(()=>()=>operation.current?.abort(),[]);
 function choose(files:FileList|null){
  setError('');setSuccess('');
  try{if(!files?.length){setFile(null);return;}if(files.length!==1)throw new DatasetUiError('INVALID_FILE');setFile(validateCSVFile(files[0]));}
  catch(caught){setFile(null);if(input.current)input.current.value='';setError(message(caught));}
 }
 async function upload(){
  if(operation.current||!file)return;const controller=new AbortController();operation.current=controller;setBusy(true);setError('');setSuccess('');
  try{const result=await uploadDataset(file,controller.signal);if(!controller.signal.aborted){setFile(null);if(input.current)input.current.value='';setSuccess(`CSV uploaded successfully. ${result.importedRows} rows imported.`);selectAfterLoad.current=result.datasetId;setRevision(value=>value+1);}}
  catch(caught){if(!controller.signal.aborted)setError(message(caught));}
  finally{operation.current=null;setBusy(false);}
 }
 const dataset=datasets.find(item=>item.id===selected);
 return <>
  <div className="page-heading document-heading"><div><p className="eyebrow">STRUCTURED DATA, IN CONTEXT</p><h1>Datasets</h1><p className="muted">Upload a CSV, inspect its columns, and explore the values that matter.</p></div><button className="button secondary" disabled={loading||busy} onClick={()=>setRevision(value=>value+1)}>Refresh datasets ↻</button></div>
  <section className="upload-panel" aria-labelledby="csv-upload-title" aria-busy={busy} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!busy)choose(event.dataTransfer.files);}}><span className="area-icon" aria-hidden="true">▦</span><div className="upload-copy"><h2 id="csv-upload-title">Add a CSV dataset</h2><p>CSV · Up to 10 MiB · Up to 10,000 rows and 100 columns</p><p className="input-hint">Use unique column headings and consistent rows. Each upload creates a new dataset, even if the file was imported before.</p></div><div className="upload-controls"><label className="file-label" htmlFor="csv-file">Select CSV file</label><input ref={input} id="csv-file" type="file" accept=".csv,text/csv" disabled={busy} onChange={event=>choose(event.target.files)}/>{file&&<p className="selected-file">Selected: {file.name}</p>}<button className="button primary" disabled={!file||busy} onClick={()=>void upload()}>{busy?'Uploading and importing…':'Upload CSV'} <span aria-hidden="true">↗</span></button></div>{busy&&<p className="document-progress" role="status">Uploading and validating your CSV…</p>}</section>
  {error&&<p className="notice error" role="alert">{error}</p>}{success&&<p className="notice info" role="status">{success}</p>}
  <div className={`dataset-workspace ${datasets.length===0?'no-datasets':''}`}><section className="dataset-list" aria-labelledby="datasets-title" aria-busy={loading}><div className="section-title"><h2 id="datasets-title">Your datasets</h2><span>{!loading&&!listError?datasets.length:''}</span></div>{loading?<p className="document-state" role="status">Loading your datasets…</p>:listError?<div className="document-state"><p role="alert">{listError}</p><button className="button secondary" onClick={()=>setRevision(value=>value+1)} disabled={busy}>Try again</button></div>:datasets.length===0?<div className="document-state"><span className="empty-icon" aria-hidden="true">▦</span><h3>Your first dataset starts here</h3><p>Upload a CSV above to inspect and query your data.</p></div>:<><ul>{datasets.map(item=><li key={item.id}><button className="dataset-select" disabled={busy} aria-pressed={selected===item.id} onClick={()=>{setSelected(item.id);setError('');}}><strong>{item.filename}</strong><span>{item.row_count.toLocaleString()} rows · {item.columns.length} columns</span></button></li>)}</ul>{datasets.length===100&&<p className="input-hint">Showing the first 100 available datasets. Discovery is limited by the current service.</p>}</>}</section>
  {!loading&&!listError&&(dataset?<DatasetExplorer key={`${dataset.id}:${revision}`} dataset={dataset}/>:datasets.length>0?<section className="dataset-selection-state document-state"><span className="empty-icon" aria-hidden="true">▦</span><h2>Select a dataset</h2><p>Choose a filename to see its schema and build a query.</p></section>:null)}</div>
 </>;
}

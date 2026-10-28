'use client';
import { useEffect, useRef, useState } from 'react';
import { AuthUiError } from '@/src/lib/auth-client';
import { DatasetUiError, fetchDatasets, uploadDataset, replaceDatasetFile, removeDataset, validateCSVFile, type DatasetItem } from '@/src/lib/dataset-client';
import { DatasetExplorer } from './dataset-explorer';
export function DatasetManager(){
 const [datasets,setDatasets]=useState<DatasetItem[]>([]),[selected,setSelected]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[listError,setListError]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const [action,setAction]=useState<{kind:'replace'|'delete';dataset:DatasetItem}|null>(null),[replacement,setReplacement]=useState<File|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null);
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
 useEffect(()=>{const modal=dialog.current;if(action&&!modal?.open){modal?.showModal();cancel.current?.focus();}if(!action&&modal?.open)modal.close();},[action]);
 function openAction(kind:'replace'|'delete',item:DatasetItem){setError('');setSuccess('');setReplacement(null);setAction({kind,dataset:item});}
 async function mutate(){
  if(operation.current||!action||(action.kind==='replace'&&!replacement))return;
  const target=action,controller=new AbortController();operation.current=controller;setBusy(true);setError('');setSuccess('');setSelected(null);
  try{
   if(target.kind==='replace')await replaceDatasetFile(target.dataset.id,replacement!,controller.signal);else await removeDataset(target.dataset.id,controller.signal);
   if(!controller.signal.aborted){setAction(null);setReplacement(null);setSuccess(target.kind==='replace'?'Dataset replaced successfully. Its ID is unchanged.':'Dataset deleted.');selectAfterLoad.current=target.kind==='replace'?target.dataset.id:null;setRevision(value=>value+1);}
  }catch(caught){if(!controller.signal.aborted){setError(message(caught));setRevision(value=>value+1);}}
  finally{if(!controller.signal.aborted){operation.current=null;setBusy(false);}}
 }

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
  <section className="upload-panel" aria-labelledby="csv-upload-title" aria-busy={busy} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!busy)choose(event.dataTransfer.files);}}><span className="area-icon" aria-hidden="true">▦</span><div className="upload-copy"><h2 id="csv-upload-title">Add a CSV dataset</h2><p>CSV · Up to 10 MiB · Up to 10,000 rows and 100 columns</p><p className="input-hint">Use unique column headings and consistent rows. Each upload creates a new dataset, even if the file was imported before.</p></div><div className="upload-controls"><label className="file-label" htmlFor="csv-file">Select CSV file</label><input ref={input} id="csv-file" type="file" accept=".csv,text/csv" disabled={busy} onChange={event=>choose(event.target.files)}/>{file&&<p className="selected-file">Selected: {file.name}</p>}<button className="button primary" disabled={!file||busy} onClick={()=>void upload()}>{busy&&!action?'Uploading and importing…':'Upload CSV'} <span aria-hidden="true">↗</span></button></div>{busy&&!action&&<p className="document-progress" role="status">Uploading and validating your CSV…</p>}</section>
  {error&&!action&&<p className="notice error" role="alert">{error}</p>}{success&&<p className="notice info" role="status">{success}</p>}
  <div className={`dataset-workspace ${datasets.length===0?'no-datasets':''}`}><section className="dataset-list" aria-labelledby="datasets-title" aria-busy={loading}><div className="section-title"><h2 id="datasets-title">Your datasets</h2><span>{!loading&&!listError?datasets.length:''}</span></div>{loading?<p className="document-state" role="status">Loading your datasets…</p>:listError?<div className="document-state"><p role="alert">{listError}</p><button className="button secondary" onClick={()=>setRevision(value=>value+1)} disabled={busy}>Try again</button></div>:datasets.length===0?<div className="document-state"><span className="empty-icon" aria-hidden="true">▦</span><h3>Your first dataset starts here</h3><p>Upload a CSV above to inspect and query your data.</p></div>:<><ul>{datasets.map(item=><li key={item.id}><button className="dataset-select" disabled={busy} aria-pressed={selected===item.id} onClick={()=>{setSelected(item.id);setError('');}}><strong>{item.filename}</strong><span>{item.row_count.toLocaleString()} rows · {item.columns.length} columns</span></button><div className="document-actions"><button className="button secondary" disabled={busy||loading} aria-label={`Replace ${item.filename}`} onClick={()=>openAction('replace',item)}>Replace</button><button className="button secondary danger-text" disabled={busy||loading} aria-label={`Delete ${item.filename}`} onClick={()=>openAction('delete',item)}>Delete</button></div></li>)}</ul>{datasets.length===100&&<p className="input-hint">Showing the first 100 available datasets. Discovery is limited by the current service.</p>}</>}</section>
  {!loading&&!listError&&(dataset?<DatasetExplorer key={`${dataset.id}:${revision}`} dataset={dataset}/>:datasets.length>0?<section className="dataset-selection-state document-state"><span className="empty-icon" aria-hidden="true">▦</span><h2>Select a dataset</h2><p>Choose a filename to see its schema and build a query.</p></section>:null)}</div>
 <dialog ref={dialog} className="document-dialog" aria-labelledby="dataset-dialog-title" aria-describedby="dataset-dialog-description" onCancel={event=>{event.preventDefault();if(!operation.current)setAction(null);}} onClose={()=>{if(!operation.current)setAction(null);}}>
  {action&&<><p className="eyebrow">DATASET MANAGEMENT</p><h2 id="dataset-dialog-title">{action.kind==='replace'?'Replace this dataset?':'Delete this dataset?'}</h2><p className="dialog-filename">{action.dataset.filename}</p><p id="dataset-dialog-description" className="muted">{action.kind==='replace'?'The new CSV replaces every row and column under the same dataset ID. The original stays intact if processing fails. This is not version history.':'This permanently removes the dataset and all its rows. It will no longer be available to queries or new AI requests. You cannot undo this action.'}</p>
  {action.kind==='replace'&&<div className="field"><label htmlFor="replacement-csv">Replacement CSV (up to 10 MiB)</label><input key={action.dataset.id} id="replacement-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={event=>{setError('');try{setReplacement(event.target.files?.[0]?validateCSVFile(event.target.files[0]):null);}catch(caught){setReplacement(null);event.target.value='';setError(message(caught));}}}/></div>}
  {busy&&<p role="status">{action.kind==='replace'?'Replacing and validating CSV…':'Deleting dataset…'}</p>}{error&&<p className="notice error" role="alert">{error}</p>}
  <div className="dialog-actions"><button ref={cancel} className="button secondary" disabled={busy} onClick={()=>setAction(null)}>Cancel</button><button className={`button ${action.kind==='delete'?'danger':'primary'}`} disabled={busy||(action.kind==='replace'&&!replacement)} onClick={()=>void mutate()}>{busy?'Working…':action.kind==='replace'?'Replace dataset':'Delete dataset'}</button></div></>}
 </dialog>
 </>;
}

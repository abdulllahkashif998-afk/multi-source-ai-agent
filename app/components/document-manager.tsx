'use client';

import { useEffect, useRef, useState } from 'react';
import { AuthUiError } from '@/src/lib/auth-client';
import { DocumentUiError, fetchDocuments, mutateDocument, validateDocumentFile, type DocumentItem, type DocumentProgress } from '@/src/lib/document-client';

type Action = { kind: 'replace' | 'delete'; document: DocumentItem };
const phaseLabels = { session:'Verifying your session…', uploading:'Uploading your file…', processing:'Processing your document. This may take a little while…', deleting:'Deleting your document…' };
export function DocumentManager() {
  const [documents,setDocuments] = useState<DocumentItem[]>([]);
  const [nextCursor,setNextCursor] = useState<string | null>(null);
  const [cursors,setCursors] = useState<Array<string | undefined>>([undefined]);
  const [revision,setRevision] = useState(0);
  const [loading,setLoading] = useState(true);
  const [listError,setListError] = useState('');
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const [file,setFile] = useState<File | null>(null);
  const [replacement,setReplacement] = useState<File | null>(null);
  const [action,setAction] = useState<Action | null>(null);
  const [progress,setProgress] = useState<DocumentProgress | null>(null);
  const operation = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const successNotice = useRef<HTMLParagraphElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cursor = cursors.at(-1);
  const busy = progress !== null;
  function fail(caught: unknown) {
    if (caught instanceof AuthUiError && caught.code === 'UNAUTHENTICATED') { window.location.replace('/login?reason=expired'); return ''; }
    return caught instanceof DocumentUiError || caught instanceof AuthUiError ? caught.message : 'The document request could not be completed. Please try again.';
  }
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);setListError('');
      try {
        const result = await fetchDocuments(cursor,controller.signal);
        if (!controller.signal.aborted) {setDocuments(result.documents);setNextCursor(result.nextCursor);}
      } catch (caught) {if (!controller.signal.aborted) {setDocuments([]);setNextCursor(null);setListError(fail(caught));}}
      finally {if (!controller.signal.aborted) setLoading(false);}
    }
    void load();return () => controller.abort();
  },[cursor,revision]);
  useEffect(() => () => { operation.current?.abort(); },[]);
  useEffect(() => {
    const modal = dialog.current;
    if (action && dialog.current && !dialog.current.open) {dialog.current.showModal();cancel.current?.focus();}
    if (!action && dialog.current?.open) dialog.current.close();
    return () => { if(modal?.open)modal.close(); };
  },[action]);
  useEffect(() => { if(success)successNotice.current?.focus(); },[success]);
  function refresh() {setCursors([undefined]);setRevision(value=>value+1);}
  function choose(files: FileList | null, replacing = false) {
    setError('');setSuccess('');
    try {
      if (!files?.length) {if (replacing) setReplacement(null); else setFile(null);return;}
      if (files.length !== 1) throw new DocumentUiError('INVALID_FILE');
      const selected = validateDocumentFile(files[0]);
      if (replacing) setReplacement(selected); else setFile(selected);
    } catch (caught) {if (replacing) setReplacement(null); else {setFile(null);if(fileInput.current)fileInput.current.value='';}setError(fail(caught));}
  }
  async function run(kind: 'upload' | 'replace' | 'delete') {
    if (operation.current) return;
    const target = action?.document;
    if (kind !== 'upload' && !target) return;
    const selected = kind === 'replace' ? replacement : file;
    if (kind !== 'delete' && !selected) {setError('Choose a PDF or DOCX file first.');return;}
    const controller = new AbortController(); operation.current = controller;
    setError('');setSuccess('');setProgress({phase:'session'});
    try {
      const result = await mutateDocument(kind,{id:target?.id,file:selected ?? undefined,signal:controller.signal,onProgress:value=>{if(!controller.signal.aborted)setProgress(value);}});
      if (controller.signal.aborted) return;
      const note = result.cleanupPending ? ' File cleanup is pending; the retired document is already excluded from search.' : '';
      setSuccess((kind==='delete'?'Document deleted.':kind==='replace'?`Document replaced successfully. Version ${result.version} is now active.`:'Document uploaded and ready to search.')+note);
      if (kind==='upload') {setFile(null);if(fileInput.current)fileInput.current.value='';}
      setReplacement(null);setAction(null);refresh();
    } catch (caught) {if(!controller.signal.aborted)setError(fail(caught));}
    finally {setProgress(null);operation.current=null;}
  }
  function open(kind: Action['kind'], document: DocumentItem) {setError('');setSuccess('');setReplacement(null);setAction({kind,document});}
  const progressView = progress && <div className="document-progress" role="status" aria-live="polite"><span>{phaseLabels[progress.phase]}{progress.phase==='uploading'&&progress.percent!==undefined?` ${progress.percent}%`:''}</span><progress aria-label="Document operation progress" max={100} value={progress.phase==='uploading'?progress.percent:undefined} /></div>;
  return <>
    <div className="page-heading document-heading"><div><p className="eyebrow">YOUR SOURCE MATERIAL</p><h1>Documents</h1><p className="muted">Manage the documents that ground your answers.</p></div><button className="button secondary" ref={refreshButton} onClick={refresh} disabled={busy||loading}>Refresh list ↻</button></div>
    <section className="upload-panel" aria-labelledby="upload-heading" aria-busy={busy&&!action} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!busy)choose(event.dataTransfer.files);}}>
      <span className="area-icon" aria-hidden="true">▤</span><div className="upload-copy"><h2 id="upload-heading">Add a document</h2><p>PDF or DOCX · Up to 10 MiB per file</p><p className="input-hint">Choose a file, or drop one into this area. It becomes searchable after processing.</p></div>
      <div className="upload-controls"><label htmlFor="document-file" className="file-label">Select document</label><input ref={fileInput} id="document-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={event=>choose(event.target.files)} />{file&&<p className="selected-file">Selected: {file.name}</p>}<button className="button primary" disabled={!file||busy} onClick={()=>void run('upload')}>{busy&&!action?'Working…':'Upload document'} <span aria-hidden="true">↗</span></button></div>
      {!action&&progressView}
    </section>
    {!action&&error&&<p className="notice error" role="alert">{error}</p>}
    {success&&<p className="notice info" role="status" ref={successNotice} tabIndex={-1}>{success}</p>}
    <section className="document-list" aria-labelledby="list-heading" aria-busy={loading}>
      <div className="section-title"><h2 id="list-heading">Your documents</h2><span>ACTIVE VERSIONS</span></div>
      {loading ? <div className="document-state" role="status">Loading your documents…</div> : listError ? <div className="document-state"><p role="alert">{listError}</p><button className="button secondary" disabled={busy} onClick={refresh}>Try again</button></div> : documents.length===0 ? <div className="document-state"><span className="empty-icon" aria-hidden="true">▤</span><h3>{cursors.length>1?'No more documents on this page':'Your first source starts here'}</h3><p>{cursors.length>1?'Use Previous to return to your documents.':'Upload a PDF or DOCX above to build your knowledge workspace.'}</p></div> : <ul className="document-rows">{documents.map(document=><li className="document-row" key={document.id}><div className="document-filename"><span className="document-type" aria-hidden="true">{document.fileType==='unknown'?'FILE':document.fileType.toUpperCase()}</span><div><h3>{document.filename}</h3><p><span>Version {document.version}</span><span aria-hidden="true"> · </span><time dateTime={document.uploadedAt ?? undefined}>{document.uploadedAt?new Date(document.uploadedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Upload date unavailable'}</time></p></div></div><span className={`document-status ${document.status==='ready'?'ready':''}`}>{document.status==='ready'?'Ready':document.status==='processing'?'Processing':document.status==='failed'?'Failed':document.status}</span><div className="document-actions"><button className="button secondary" disabled={busy||document.status!=='ready'} onClick={()=>open('replace',document)} aria-label={`Replace ${document.filename}`}>Replace</button><button className="button secondary danger-text" disabled={busy} onClick={()=>open('delete',document)} aria-label={`Delete ${document.filename}`}>Delete</button></div></li>)}</ul>}
      {!loading&&!listError&&<div className="document-pagination"><span>{documents.length} {documents.length===1?'document':'documents'} on this page</span><div><button className="button secondary" disabled={busy||cursors.length===1} onClick={()=>setCursors(value=>value.slice(0,-1))}>← Previous</button><span>Page {cursors.length}</span><button className="button secondary" disabled={busy||!nextCursor} onClick={()=>{if(nextCursor)setCursors(value=>[...value,nextCursor]);}}>Next →</button></div></div>}
    </section>
    <dialog className="document-dialog" ref={dialog} aria-labelledby="document-dialog-title" aria-describedby="document-dialog-description" onCancel={event=>{event.preventDefault();if(!operation.current)setAction(null);}} onClose={()=>{if(!operation.current)setAction(null);}}>
      {action&&<><p className="eyebrow">{action.kind==='delete'?'DOCUMENT DELETION':'NEW DOCUMENT VERSION'}</p><h2 id="document-dialog-title">{action.kind==='delete'?'Delete this document?':'Replace this document?'}</h2><p className="dialog-filename">{action.document.filename}</p><p id="document-dialog-description" className="muted">{action.kind==='delete'?'This removes the document from active knowledge and search. Its stored file and extracted content will be cleaned up. You cannot undo this action.':`The replacement becomes version ${action.document.version+1}. The current version stays active until the new file is successfully processed, then it is retired.`}</p>{action.kind==='replace'&&<div className="field"><label htmlFor="replacement-file">Replacement PDF or DOCX (up to 10 MiB)</label><input key={action.document.id} type="file" id="replacement-file" accept=".pdf,.docx" disabled={busy} onChange={event=>choose(event.target.files,true)} /></div>}{progressView}{error&&<p className="notice error" role="alert">{error}</p>}<div className="dialog-actions"><button ref={cancel} className="button secondary" disabled={busy} onClick={()=>setAction(null)}>Cancel</button><button className={`button ${action.kind==='delete'?'danger':'primary'}`} disabled={busy||(action.kind==='replace'&&!replacement)} onClick={()=>void run(action.kind)}>{busy?'Working…':action.kind==='delete'?'Delete document':'Replace document'}</button></div></>}
    </dialog>
  </>;
}

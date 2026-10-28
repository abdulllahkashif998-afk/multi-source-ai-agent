'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {AuthUiError} from '@/src/lib/auth-client';
import {AIUiError,askAI,modeLabel,validateQuestion,type ChatAnswer,type ChatMode} from '@/src/lib/ai-chat-client';
import {ChatCitations} from './chat-citations';
type Turn={id:number;question:string;mode:ChatMode;status:'pending'|'done'|'error';result?:ChatAnswer;error?:string};
export function AIChat(){
 const [mode,setMode]=useState<ChatMode>('agent'),[question,setQuestion]=useState('');
 const [announcement,setAnnouncement]=useState('');
 const [turns,setTurns]=useState<Turn[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
 const operation=useRef<AbortController|null>(null),activeTurn=useRef<number|null>(null),counter=useRef(0);
 const textarea=useRef<HTMLTextAreaElement>(null),dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null);
 useEffect(()=>()=>{
  const id=activeTurn.current;operation.current?.abort();
  if(id!==null)setAnnouncement('Request interrupted.');
  if(id!==null)setTurns(current=>current.map(turn=>turn.id===id&&turn.status==='pending'?{...turn,status:'error',error:new AIUiError('INTERRUPTED').message}:turn));
 },[]);
 useEffect(()=>{const modal=dialog.current;if(confirm&&!modal?.open){modal?.showModal();cancel.current?.focus();}if(!confirm&&modal?.open)modal.close();return()=>{if(modal?.open)modal.close();};},[confirm]);
 const newestId=turns.at(-1)?.id;
 useEffect(()=>{if(newestId!==undefined)document.getElementById(`chat-turn-${newestId}`)?.scrollIntoView({block:'nearest'});},[newestId]);
 async function request(turn:Turn){
  if(operation.current)return;const controller=new AbortController();operation.current=controller;activeTurn.current=turn.id;setBusy(true);setError('');setAnnouncement('Processing your question.');
  setTurns(current=>current.map(item=>item.id===turn.id?{...item,status:'pending',error:undefined,result:undefined}:item));
  try{const result=await askAI(turn.mode,turn.question,controller.signal);if(!controller.signal.aborted){setTurns(current=>current.map(item=>item.id===turn.id?{...item,status:'done',result}:item));setAnnouncement(result.grounded?'Answer ready.':'Insufficient evidence to answer.');}}
  catch(caught){if(!controller.signal.aborted){if(caught instanceof AuthUiError&&caught.code==='UNAUTHENTICATED'){window.location.replace('/login?reason=expired');return;}setAnnouncement('Request failed.');const message=caught instanceof AIUiError||caught instanceof AuthUiError?caught.message:'The request could not be completed. Please try again later.';setTurns(current=>current.map(item=>item.id===turn.id?{...item,status:'error',error:message}:item));}}
  finally{operation.current=null;activeTurn.current=null;setBusy(false);}
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(operation.current)return;
  let normalized:string;try{normalized=validateQuestion(question);}catch(caught){setError(caught instanceof AIUiError?caught.message:'Check your question.');textarea.current?.focus();return;}
  const turn:Turn={id:++counter.current,question:normalized,mode,status:'pending'};
  setTurns(current=>[...current,turn]);setQuestion('');await request(turn);
 }
 function clear(){setAnnouncement('Conversation cleared.');setTurns([]);setQuestion('');setError('');setConfirm(false);requestAnimationFrame(()=>textarea.current?.focus());}
 return <>
  <div className="page-heading document-heading"><div><p className="eyebrow">ASK A QUESTION. FOLLOW THE SOURCES.</p><h1>AI Chat</h1><p className="muted">Grounded answers from the knowledge in your workspace.</p></div><button className="button secondary" disabled={busy||!turns.length} onClick={()=>setConfirm(true)}>Clear conversation</button></div>
  <fieldset className="chat-modes" disabled={busy}><legend>Answer mode</legend>{(['agent','documents'] as const).map(value=><label className={`chat-mode ${mode===value?'selected':''}`} key={value}><input type="radio" name="chat-mode" value={value} checked={mode===value} onChange={()=>setMode(value)}/><span><strong>{modeLabel(value)}{value==='agent'&&<small>DEFAULT</small>}</strong><span>{value==='agent'?'Uses documents, CSV datasets, or both to gather evidence.':'Answers from retrieved PDF and DOCX document text.'}</span></span></label>)}</fieldset>
  <p className="chat-session-note">Messages stay in this page’s memory, not a saved chat history. Each question is answered independently; include the context you need.</p>
  <section className="chat-conversation" aria-label="Conversation" role="log" aria-live="polite" aria-relevant="additions">
   {turns.length===0?<div className="chat-empty"><span className="empty-icon" aria-hidden="true">✳</span><h2>Start with a question.</h2><p>Ask about your documents, your datasets, or the connections between them. Answers need evidence from your available sources.</p><div><Link href="/dashboard/documents" className="text-link">Manage documents ↗</Link><Link href="/dashboard/datasets" className="text-link">Explore datasets ↗</Link></div></div>:turns.map((turn,index)=><div className="chat-turn" key={turn.id} id={`chat-turn-${turn.id}`}>
    <article className="chat-message user-message" aria-label={`Your question ${index+1}`}><div className="chat-message-label"><span>You</span><span>{modeLabel(turn.mode)}</span></div><p className="chat-answer-text">{turn.question}</p></article>
    <article className="chat-message assistant-message" aria-label={`AI response ${index+1}`} aria-busy={turn.status==='pending'}><div className="chat-message-label"><span><span aria-hidden="true">✳ </span>Knowledge</span><span>{turn.status==='pending'?'Processing':turn.status==='error'?'Request failed':turn.result?.grounded?'Answer with sources':'Insufficient evidence'}</span></div>
     {turn.status==='pending'?<div className="chat-pending"><span className="chat-spinner" aria-hidden="true"/><p>Gathering evidence and preparing your answer. This may take a little while.</p></div>:turn.status==='error'?<><p className="notice error" role="alert">{turn.error}</p><button className="button secondary" disabled={busy} onClick={()=>void request(turn)} aria-label={`Retry question ${index+1}`}>Retry manually</button><p className="input-hint">Resends this question in {modeLabel(turn.mode)} mode and may use another API request.</p></>:turn.result?<><p className="chat-answer-text">{turn.result.answer}</p>{!turn.result.grounded&&<p className="chat-abstention">Try a more specific question or add relevant documents and datasets.</p>}<ChatCitations sources={turn.result.sources}/></>:null}
    </article>
   </div>)}
  </section>
  <form className="chat-composer" onSubmit={submit} noValidate aria-busy={busy}>
   <label htmlFor="chat-question">Your question</label><textarea ref={textarea} id="chat-question" rows={3} maxLength={2000} value={question} disabled={busy} aria-invalid={Boolean(error)} aria-describedby={`chat-question-hint${error?' chat-question-error':''}`} placeholder={mode==='agent'?'Ask about a document, dataset, or both…':'Ask a question about your PDF or DOCX documents…'} onChange={event=>{setQuestion(event.target.value);setError('');}} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.nativeEvent.keyCode!==229){event.preventDefault();if(!event.repeat&&!operation.current)event.currentTarget.form?.requestSubmit();}}}/>
   <div className="chat-composer-footer"><p id="chat-question-hint">Enter to send · Shift+Enter for a new line<span>{question.length.toLocaleString()} / 2,000 characters</span></p><button className="button primary" type="submit" disabled={busy||!question.trim()}>{busy?'Processing…':'Send question'} <span aria-hidden="true">↗</span></button></div>
   {error&&<p className="notice error" id="chat-question-error" role="alert">{error}</p>}
   <p role="status" className="sr-only">{announcement}</p>
  </form>
  <dialog ref={dialog} className="document-dialog" aria-labelledby="clear-chat-title" aria-describedby="clear-chat-description" onCancel={event=>{event.preventDefault();if(!operation.current)setConfirm(false);}} onClose={()=>{if(!operation.current)setConfirm(false);}}><p className="eyebrow">PAGE-SESSION HISTORY</p><h2 id="clear-chat-title">Clear this conversation?</h2><p id="clear-chat-description" className="muted">Remove the messages and draft from this page? This cannot be undone. Your documents and datasets will stay unchanged.</p><div className="dialog-actions"><button ref={cancel} className="button secondary" onClick={()=>setConfirm(false)}>Cancel</button><button className="button danger" onClick={clear}>Clear messages</button></div></dialog>
 </>;
}

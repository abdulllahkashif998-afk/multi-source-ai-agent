'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AuthUiError } from '@/src/lib/auth-client';
import { DatasetUiError, emptyQuery, runDatasetQuery, type DatasetItem, type QueryDraft, type QueryRow } from '@/src/lib/dataset-client';
import type { CSVQueryPlan } from '@/src/lib/csv-query-schema';
const operators=[['eq','equals'],['ne','does not equal'],['gt','greater than'],['gte','at least'],['lt','less than'],['lte','at most']] as const;
export function DatasetExplorer({dataset}:{dataset:DatasetItem}){
 const [draft,setDraft]=useState<QueryDraft>(emptyQuery);
 const [result,setResult]=useState<{plan:CSVQueryPlan;rows:QueryRow[]}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const operation=useRef<AbortController|null>(null),filterKey=useRef(0);
 useEffect(()=>()=>operation.current?.abort(),[]);
 function update(change:Partial<QueryDraft>){setDraft(value=>({...value,...change}));setResult(null);setError('');}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(operation.current)return;
  const controller=new AbortController();operation.current=controller;setBusy(true);setError('');setResult(null);
  try{const next=await runDatasetQuery(dataset,draft,controller.signal);if(!controller.signal.aborted)setResult(next);}
  catch(caught){if(!controller.signal.aborted){if(caught instanceof AuthUiError&&caught.code==='UNAUTHENTICATED')window.location.replace('/login?reason=expired');else setError(caught instanceof DatasetUiError||caught instanceof AuthUiError?caught.message:'The query could not be completed.');}}
  finally{operation.current=null;setBusy(false);}
 }
 const numeric=dataset.columns.filter(column=>column.type==='number');
 const aggregated=draft.operation!=='rows';
 const sortable=aggregated?['value',...draft.groupBy]:dataset.columns.map(column=>column.name);
 const headers=result?(result.plan.aggregate?[...result.plan.groupBy,'value']:dataset.columns.map(c=>c.name)):[];
 const aggregateTitle=result?.plan.aggregate?`${result.plan.aggregate.op.toUpperCase()}${result.plan.aggregate.column?` (${result.plan.aggregate.column})`:' (rows)'}`:'';
 return <section className="dataset-explorer" aria-labelledby="dataset-title">
  <div className="section-title dataset-title"><div><p className="eyebrow">SELECTED DATASET</p><h2 id="dataset-title">{dataset.filename}</h2></div><span>{dataset.row_count.toLocaleString()} rows · {dataset.columns.length} columns</span></div>
  <details className="schema-panel" open><summary>Column schema <span>Inferred from your CSV</span></summary><ul>{dataset.columns.map(column=><li key={column.name}><strong>{column.name}</strong><span>{column.type==='number'?'Number':column.type==='boolean'?'Boolean':'Text'}</span></li>)}</ul></details>
  <form className="query-builder" onSubmit={submit} noValidate aria-busy={busy}>
   <div className="section-title"><h3>Explore your data</h3><span>STRUCTURED QUERIES</span></div>
   <fieldset disabled={busy} className="query-fieldset"><legend className="sr-only">Query settings</legend>
    <div className="query-controls">
     <div className="field"><label htmlFor="query-operation">Result</label><select id="query-operation" value={draft.operation} onChange={event=>{const next=event.target.value as QueryDraft['operation'];update({operation:next,aggregateColumn:next==='sum'||next==='avg'?numeric[0]?.name??'':'',groupBy:next==='rows'?[]:draft.groupBy,sortColumn:''});}}><option value="rows">Rows</option><option value="count">COUNT — count rows</option><option value="sum" disabled={!numeric.length}>SUM — total a numeric column</option><option value="avg" disabled={!numeric.length}>AVG — average a numeric column</option></select></div>
     {(draft.operation==='sum'||draft.operation==='avg')&&<div className="field"><label htmlFor="aggregate-column">Numeric column</label><select id="aggregate-column" value={draft.aggregateColumn} onChange={event=>update({aggregateColumn:event.target.value})}>{numeric.map(column=><option key={column.name} value={column.name}>{column.name}</option>)}</select></div>}
     <div className="field"><label htmlFor="query-limit">Maximum result rows</label><input id="query-limit" type="number" min={1} max={100} step={1} value={draft.limit} onChange={event=>update({limit:event.target.value})} aria-describedby="query-limit-hint" /></div>
    </div>
    {aggregated&&<fieldset className="group-fields"><legend>Group by <span>(optional, up to 5 columns)</span></legend><div>{dataset.columns.map((column,index)=><label key={column.name} htmlFor={`group-${index}`}><input id={`group-${index}`} type="checkbox" checked={draft.groupBy.includes(column.name)} disabled={column.name==='value'||(!draft.groupBy.includes(column.name)&&draft.groupBy.length>=5)} onChange={event=>{const groupBy=event.target.checked?[...draft.groupBy,column.name]:draft.groupBy.filter(name=>name!==column.name);update({groupBy,sortColumn:draft.sortColumn!=='value'&&!groupBy.includes(draft.sortColumn)?'':draft.sortColumn});}} />{column.name}</label>)}</div>{dataset.columns.some(c=>c.name==='value')&&<p className="input-hint">The current service reserves “value” for aggregate output, so it cannot be a group column.</p>}</fieldset>}
    <fieldset className="filter-fields"><legend>Filters <span>(all filters must match)</span></legend>{draft.filters.length===0&&<p className="input-hint">No filters. All source rows are included.</p>}{draft.filters.map((filter,index)=>{
     const column=dataset.columns.find(c=>c.name===filter.column)!;
     function change(value:Partial<QueryDraft['filters'][number]>){update({filters:draft.filters.map(row=>row.key===filter.key?{...row,...value}:row)});}
     return <div className="filter-row" key={filter.key}><div className="field"><label htmlFor={`filter-column-${filter.key}`}>Filter {index+1} column</label><select id={`filter-column-${filter.key}`} value={filter.column} onChange={event=>{const next=dataset.columns.find(c=>c.name===event.target.value)!;change({column:next.name,op:'eq',value:next.type==='boolean'?'true':''});}}>{dataset.columns.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></div><div className="field"><label htmlFor={`filter-op-${filter.key}`}>Comparison {index+1}</label><select id={`filter-op-${filter.key}`} value={filter.op} onChange={event=>change({op:event.target.value as typeof filter.op})}>{operators.filter(([op])=>column.type!=='boolean'||op==='eq'||op==='ne').map(([op,label])=><option key={op} value={op}>{label}</option>)}</select></div><div className="field"><label htmlFor={`filter-value-${filter.key}`}>Value {index+1}</label>{column.type==='boolean'?<select id={`filter-value-${filter.key}`} value={filter.value} onChange={event=>change({value:event.target.value})}><option value="true">true</option><option value="false">false</option></select>:<input id={`filter-value-${filter.key}`} type={column.type==='number'?'number':'text'} step={column.type==='number'?'any':undefined} value={filter.value} onChange={event=>change({value:event.target.value})} />}</div><button type="button" className="button secondary" aria-label={`Remove filter ${index+1}`} onClick={()=>update({filters:draft.filters.filter(row=>row.key!==filter.key)})}>Remove</button></div>;
    })}<button type="button" className="button secondary" disabled={draft.filters.length>=20} onClick={()=>{const column=dataset.columns[0];update({filters:[...draft.filters,{key:++filterKey.current,column:column.name,op:'eq',value:column.type==='boolean'?'true':''}]});}}>+ Add filter</button></fieldset>
    <div className="query-controls"><div className="field"><label htmlFor="sort-column">Sort by</label><select id="sort-column" value={draft.sortColumn} onChange={event=>update({sortColumn:event.target.value})}><option value="">No sorting</option>{sortable.map(name=><option key={name} value={name}>{aggregated&&name==='value'?'Aggregate result':name}</option>)}</select></div><div className="field"><label htmlFor="sort-direction">Direction</label><select id="sort-direction" disabled={!draft.sortColumn} value={draft.direction} onChange={event=>update({direction:event.target.value as 'asc'|'desc'})}><option value="asc">Ascending</option><option value="desc">Descending</option></select></div></div>
    <p className="input-hint" id="query-limit-hint">Up to 100 result rows. Filters apply to source rows before grouping and totals. COUNT counts rows, including rows with empty cells.</p>
    <div className="query-submit"><button className="button primary" type="submit">Run query <span aria-hidden="true">↗</span></button><button type="button" className="button secondary" onClick={()=>{setDraft(emptyQuery());setResult(null);setError('');}}>Reset query</button></div>
   </fieldset>
  </form>
  {busy&&<p className="notice info" role="status">Running your query…</p>}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {result&&<section className="query-results" aria-labelledby="results-title"><div className="section-title"><h3 id="results-title">Query results</h3><span>{result.rows.length} returned {result.rows.length===1?'row':'rows'}</span></div>{result.rows.length===0?<p className="document-state" role="status">No rows match this query.</p>:<div className="results-region" role="region" aria-label="Query results table" tabIndex={0}><table><caption>{dataset.filename} · {aggregateTitle||'Rows'}</caption><thead><tr>{headers.map(header=><th key={header} scope="col">{result.plan.aggregate&&header==='value'?aggregateTitle:header}</th>)}</tr></thead><tbody>{result.rows.map((row,index)=><tr key={index}>{headers.map(header=>{const value=Object.hasOwn(row,header)?row[header]:null;return <td key={header}>{value===null?<span aria-label="Empty value">—</span>:String(value)}</td>;})}</tr>)}</tbody></table></div>}{result.rows.length===result.plan.limit&&(!result.plan.aggregate||result.plan.groupBy.length>0)&&<p className="notice info" role="status">This result may be limited. Increase the row limit or use an aggregate for a full total.</p>}</section>}
 </section>;
}

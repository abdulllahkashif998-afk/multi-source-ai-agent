import { csvEvidenceTable,type ChatCitation } from '@/src/lib/ai-chat-client';
export function ChatCitations({sources}:{sources:ChatCitation[]}){
 const documents=sources.filter(source=>source.type==='document');
 const csv=sources.filter(source=>source.type==='csv');
 if(!sources.length)return null;
 return <div className="chat-citations">
  {documents.length>0&&<section aria-label="Document sources"><h4>Document sources</h4>{documents.map(source=><details className="chat-source" key={source.id}><summary><span className="citation-badge">[{source.id}]</span><span><strong>{source.filename}</strong><small>{source.chunkIndex!==undefined?`Chunk index ${source.chunkIndex}`:''}{source.chunkIndex!==undefined&&source.pageNumber!==null&&source.pageNumber!==undefined?' · ':''}{source.pageNumber!==null&&source.pageNumber!==undefined?`Page ${source.pageNumber}`:''}</small></span></summary><div className="source-quotes">{source.quotes.map((quote,index)=><blockquote key={index}>{quote}</blockquote>)}</div></details>)}</section>}
  {csv.length>0&&<section aria-label="CSV sources"><h4>CSV sources</h4>{csv.map(source=>{
   const table=csvEvidenceTable(source.rows);
   return <details className="chat-source" key={source.id} open={source.rows.length<=5}><summary><span className="citation-badge">[{source.id}]</span><span><strong>{source.filename}</strong><small>Structured query evidence</small></span></summary><div className="csv-source-content">{source.rows.length===0?<p className="input-hint">The query returned no rows.</p>:table?<div className="results-region" role="region" aria-label={`${source.id} CSV evidence table`} tabIndex={0}><table><caption>Returned evidence from {source.filename}</caption><thead><tr>{table.headers.map(header=><th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{table.rows.map((row,index)=><tr key={index}>{table.headers.map(header=>{const value=Object.hasOwn(row,header)?row[header]:null;return <td key={header}>{value===null?<span aria-label="Empty value">—</span>:String(value)}</td>;})}</tr>)}</tbody></table></div>:<pre className="chat-evidence-text">{source.text}</pre>}{source.possiblyTruncated&&<p className="notice info">This evidence may be limited; it may not include every matching row.</p>}<details className="exact-quotes"><summary>Exact cited evidence</summary>{source.quotes.map((quote,index)=><blockquote key={index}>{quote}</blockquote>)}</details></div></details>;
  })}</section>}
 </div>;
}

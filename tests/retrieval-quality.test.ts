import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cases,documents,datasets,owner,foreignOwner} from '../evaluation/fixtures';
import {retrievalCases,retrievalDocuments} from '../evaluation/retrieval-fixtures';
import {rankingMetrics,aggregateRankings} from '../evaluation/retrieval-metrics';
import {retrievalOnlyNetwork,parseRetrievalOptions} from '../evaluation/retrieval-quality';

test('retrieval metrics distinguish first rank, partial recall, reciprocal rank and any-hit',()=>{
 const r=rankingMetrics(['x','a','b'],['a','b']);assert.equal(r.recall1,0);assert.equal(r.precision1,0);assert.equal(r.recall3,1);assert.equal(r.precision3,2/3);assert.equal(r.reciprocalRank3,.5);assert.equal(r.hit3,1);
 const partial=rankingMetrics(['a','x','y'],['a','b']);assert.equal(partial.recall1,.5);assert.equal(partial.recall3,.5);assert.equal(partial.hit3,1);assert.deepEqual(partial.missed,['b']);
});
test('MRR is capped at the exposed top three; no labels remain not applicable',()=>{
 assert.equal(rankingMetrics(['x','y','z','a'],['a']).reciprocalRank3,0);assert.equal(rankingMetrics(['x','y','a'],['a']).reciprocalRank3,1/3);
 const empty=rankingMetrics(['x'],[]);assert.equal(empty.hit3,null);assert.equal(empty.reciprocalRank3,null);assert.equal(empty.recall1,null);assert.equal(empty.precision3,null);assert.equal(rankingMetrics([],['a']).hit3,0);
});
test('duplicates cannot inflate relevance; short results retain K as precision denominator',()=>{
 const r=rankingMetrics(['a','a','a'],['a','a']);assert.equal(r.recall3,1);assert.equal(r.precision3,1/3);assert.equal(r.reciprocalRank3,1);assert.equal(rankingMetrics(['a'],['a']).precision3,1/3);
});
test('paired aggregates expose empty-gold candidates and downstream eligibility separately',()=>{
 const rows=[{ranked:['x','a','b'],eligible:['a','b'],relevant:['a','b'],durationMs:10},{ranked:[],eligible:[],relevant:['a'],durationMs:30},{ranked:['noise'],eligible:[],relevant:[],durationMs:20}];const s=aggregateRankings(rows);
 assert.equal(s.raw.recall3.n,2);assert.equal(s.raw.recall3.value,.5);assert.equal(s.raw.mrr3.value,.25);assert.equal(s.raw.hitRate3.value,.5);assert.equal(s.eligible.mrr3.value,.5);assert.equal(s.emptyGold.rawNonempty,1);assert.equal(s.emptyGold.eligibleNonempty,0);assert.equal(s.latencyMs.p50,20);assert.equal(s.latencyMs.p95,30);
});
test('original 25-case definitions still match the independent committed fixture catalog',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../docs/evaluation/mock-baseline/fixtures.json',import.meta.url),'utf8'));assert.deepEqual(cases,catalog.cases);assert.deepEqual(documents,catalog.documents);assert.deepEqual(datasets,catalog.datasets);
 assert.equal(retrievalCases.filter(c=>c.cohort==='original').length,19);assert.equal(retrievalCases.filter(c=>c.cohort==='stress').length,20);
});
test('added labels and IDs are deterministic and permissions include a positive owner control',()=>{
 assert.equal(new Set(retrievalCases.map(c=>c.id)).size,retrievalCases.length);assert.equal(new Set(retrievalDocuments.map(d=>d.id)).size,retrievalDocuments.length);assert.equal(new Set(retrievalDocuments.map(d=>d.chunkId)).size,retrievalDocuments.length);
 for(const c of retrievalCases.filter(c=>c.cohort==='stress'))for(const id of c.fixture.relevantChunks){const d=[...documents,...retrievalDocuments].find(d=>d.chunkId===id);assert.ok(d);if('userId' in d&&d.userId)assert.equal(d.userId,c.userId);}
 assert.deepEqual(retrievalCases.find(c=>c.id==='ret-16')?.fixture.relevantChunks,[]);assert.deepEqual(retrievalCases.find(c=>c.id==='ret-20')?.fixture.relevantChunks,['2015']);assert.equal(retrievalCases.find(c=>c.id==='ret-20')?.userId,foreignOwner);
});
test('retrieval runner blocks provider HTTP calls while preserving embedding service arguments',async()=>{
 const fetch=mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{assert.equal(String(input),'http://localhost:11434/api/embed');assert.equal(init?.method,'POST');return Response.json({embeddings:[Array(768).fill(.1)]});});
 try{await retrievalOnlyNetwork(async()=>{await globalThis.fetch('http://localhost:11434/api/embed',{method:'POST'});for(const url of ['https://api.groq.com/openai/v1/chat/completions','https://generativelanguage.googleapis.com/v1beta/models/x:generateContent'])await assert.rejects(globalThis.fetch(url),/blocks/);});assert.equal(fetch.mock.callCount(),1);}finally{fetch.mock.restore();}
});
test('network guard restores fetch on failure and runner arguments reject unsafe bounds/paths',async()=>{
 const original=globalThis.fetch;await assert.rejects(retrievalOnlyNetwork(async()=>{throw Error('injected');}),/injected/);assert.equal(globalThis.fetch,original);
 assert.equal(parseRetrievalOptions([]).repetitions,3);for(const args of [['--repetitions','0'],['--repetitions','6'],['--out','storage/uploads'],['--suite','unknown'],['--suite','all','--suite','stress']])assert.throws(()=>parseRetrievalOptions(args));
});
test('extended fixture permissions and status checks roll back without public mutation',{skip:process.env.RUN_EVAL_DB_TESTS!=='1'},async()=>{
 const {withFixtureDatabase}=await import('../evaluation/isolation');const {runWithIdentity}=await import('../src/lib/identity');const {searchDocuments}=await import('../src/lib/search-documents');const {default:pool}=await import('../src/lib/db');const before=(await pool.query('SELECT count(*)::int AS n FROM public.documents')).rows[0].n;
 const embedding=[1,...Array(767).fill(0)],vectors=new Map([...documents,...retrievalDocuments].map(d=>[d.text,embedding]));const request=mock.method(globalThis,'fetch',async()=>Response.json({embeddings:[embedding]}));
 try{await withFixtureDatabase(cases[0],vectors,async()=>{
  const hidden=new Set(['191','192','193','2015','2016','2017','2018']);
  for(const mode of ['semantic','hybrid'] as const){const rows=await runWithIdentity(owner,()=>searchDocuments('ZETA-TENANT-77 ARCHIVE-DROP-44 DRAFT-UNPUBLISHED-9 LEGACY-TARGET-66',undefined,{mode}));assert.ok(rows.every(r=>!hidden.has(r.chunk_id)));}
  const other=await runWithIdentity(foreignOwner,()=>searchDocuments('ZETA-TENANT-77',undefined,{mode:'hybrid'}));assert.ok(other.some(r=>r.chunk_id==='2015'));assert.ok(other.every(r=>['191','2015'].includes(r.chunk_id)));
 },retrievalDocuments);assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.documents')).rows[0].n,before);}finally{request.mock.restore();}
});

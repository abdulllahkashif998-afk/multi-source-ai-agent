import {mkdir,writeFile} from 'node:fs/promises';
import {cases,documents,datasets,corpusDocuments,owner} from './fixtures';
import {fixtureHash} from './answer-quality';
import {oracleQuery,sameRows,independentCombinedFacts} from './answer-oracle';
import {generateEmbedding} from '../src/lib/embeddings';
import {getChatConfig} from '../src/lib/ai-provider';
import {withFixtureDatabase} from './isolation';
import {runWithIdentity} from '../src/lib/identity';
import {discoverDatasets,queryDataset} from '../src/lib/generic-csv';
import pool from '../src/lib/db';
async function main(){
 const config=getChatConfig();if(config.provider!=='groq')throw Error('Existing provider must already be Groq');
 const original=globalThis.fetch,ollama=new URL(process.env.OLLAMA_BASE_URL??'http://localhost:11434');
 let localRequests=0;
 globalThis.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input:input.url);if(u.origin!==ollama.origin||!['/api/embed','/api/tags'].includes(u.pathname))throw Error('Preflight blocks all provider HTTP');localRequests++;return original(input,init);};
 const embeddings=new Map<string,number[]>();
 try{
 for(const doc of documents)embeddings.set(doc.text,await generateEmbedding(doc.text,AbortSignal.timeout(15_000)));
 const checked=[];
 for(const c of cases){
  if(c.plan&&!sameRows(oracleQuery(c.plan),c.expectedRows??[],Boolean(c.plan.sort)))throw Error('Authored independent calculation mismatch');
  const derived=independentCombinedFacts(c.id);if(derived&&c.facts.some(f=>Math.abs(derived[f.label]-f.value)>f.tolerance))throw Error('Authored comparison mismatch');
  for(const chunk of c.relevantChunks)if(!corpusDocuments(c.corpus).some(d=>d.chunkId===chunk))throw Error('Required chunk missing');
  await runWithIdentity(owner,()=>withFixtureDatabase(c,embeddings,async()=>{
   const found=await discoverDatasets(owner);if(found.length!==datasets.length||found.some(d=>!datasets.some(x=>x.id===d.id)))throw Error('Fixture discovery mismatch');
   if(c.plan&&!sameRows(await queryDataset(owner,c.plan),c.expectedRows??[],Boolean(c.plan.sort)))throw Error('Real fixture SQL mismatch');
  }));checked.push({id:c.id,category:c.category,system:c.system,corpus:c.corpus,fixtureCheck:'passed'});
 }
 await mkdir('docs/evaluation/final-live',{recursive:true});
 const report={kind:'preflight-only-not-answer-evaluation',fixtureHash,provider:config.provider,model:config.model,configuredRPM:Number(process.env.GROQ_REQUESTS_PER_MINUTE??12),cases:checked,localEmbeddingRequests:localRequests,groqAttempts:0,fixtureIsolation:'temporary tables; explicit IDs; rollback; no user account or stored file mutation',authenticationScope:'existing operator fixture identity; not browser-session replay'};
 await writeFile('docs/evaluation/final-live/preflight.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({preflight:'passed',cases:checked.length,groqAttempts:0}));
 }finally{globalThis.fetch=original;await pool.end();}
}
main().catch(()=>{console.error('Fixture preflight failed; no provider call was permitted.');process.exitCode=1;});

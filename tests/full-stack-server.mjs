// Opt-in QA fixture server only. Never imported by the application.
import pg from 'pg';
import path from 'node:path';
const buildDirectory=process.env.QA_BUILD_DIRECTORY;
if(!buildDirectory||!path.isAbsolute(buildDirectory)||!buildDirectory.startsWith('/tmp/'))throw Error('Use an isolated production build under /tmp via QA_BUILD_DIRECTORY.');
// Fail before creating fixtures when a traced deployment would omit the PDF worker.

import {randomBytes} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:https';
import {request as forward} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
const schema='qa_day8_'+randomBytes(8).toString('hex');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const tables=['users','auth_credentials','auth_sessions','auth_rate_limits','documents','document_chunks','document_events','document_file_cleanup','generic_csv_datasets','generic_csv_rows','csv_datasets','employee_leaves'];
let child,proxy,cleaning=false,storageOwned=false;const storageRoot=path.join(buildDirectory,'storage');
async function cleanup(exitCode=0){if(cleaning)return;cleaning=true;proxy?.close();if(child&&!child.killed){child.kill('SIGTERM');await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,5000).unref();});}
 try{if(!/^qa_day8_[0-9a-f]{16}$/.test(schema))throw Error('Invalid fixture namespace');await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);console.log(JSON.stringify({fixtureCleanup:'complete',publicDataMutated:false}));}finally{if(storageOwned)rmSync(storageRoot,{recursive:true,force:true});await pool.end();}process.exit(exitCode);}
process.on('SIGINT',()=>void cleanup());process.on('SIGTERM',()=>void cleanup());
try{
 for(const route of ['upload','documents/[id]']){const trace=JSON.parse(readFileSync(path.join(buildDirectory,'.next/server/app/api',route,'route.js.nft.json'),'utf8'));if(!trace.files.some(file=>file.endsWith('pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs')))throw Error('PDF worker missing from production trace.');}
 if(existsSync(storageRoot))throw Error('Use a clean isolated build storage directory.');mkdirSync(storageRoot,{mode:0o700});storageOwned=true;
 await pool.query('BEGIN');await pool.query(`CREATE SCHEMA ${schema}`);await pool.query(`REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`);
 for(const table of tables){await pool.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);const result=await pool.query("SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='id'",[table]);if(result.rows[0]?.column_default?.includes('nextval(')){await pool.query(`CREATE SEQUENCE ${schema}.${table}_qa_ids START 100001`);await pool.query(`ALTER TABLE ${schema}.${table} ALTER COLUMN id SET DEFAULT nextval('${schema}.${table}_qa_ids')`);}}
 await pool.query(`SET LOCAL search_path=${schema},public`);
 const constraints=await pool.query("SELECT r.relname AS tab,c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND c.contype='f' AND r.relname=ANY($1::text[])",[tables]);
 for(const c of constraints.rows){let def=c.definition;for(const table of tables)def=def.replaceAll(`REFERENCES public.${table}(`,`REFERENCES ${schema}.${table}(`);if(def.includes('public.'))throw Error('Unexpected fixture reference');await pool.query(`ALTER TABLE ${schema}.${c.tab} ADD CONSTRAINT ${c.conname} ${def}`);}
 await pool.query('COMMIT');
 const url=new URL(process.env.DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema},public`);
 const check=new pg.Pool({connectionString:url.toString()});const actual=(await check.query('SELECT current_schema() AS schema')).rows[0].schema;await check.end();if(actual!==schema)throw Error('Fixture isolation failed');
 const tlsRoot='/tmp/day8-final-tls';mkdirSync(tlsRoot,{recursive:true,mode:0o700});execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',tlsRoot+'/key.pem','-out',tlsRoot+'/cert.pem','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
 writeFileSync('/tmp/day8-final-fixture.json',JSON.stringify({schema,baseURL:'https://127.0.0.1:3448'}),{mode:0o600});
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3109','-H','127.0.0.1'],{cwd:buildDirectory,env:{...process.env,DATABASE_URL:url.toString(),APP_ORIGIN:'https://127.0.0.1:3448',NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});
 proxy=createServer({key:readFileSync(tlsRoot+'/key.pem'),cert:readFileSync(tlsRoot+'/cert.pem')},(req,res)=>{const upstream=forward({hostname:'127.0.0.1',port:3109,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https'}},reply=>{res.writeHead(reply.statusCode,{...reply.headers,'X-QA-Fixture':schema});reply.pipe(res);});upstream.on('error',()=>{res.writeHead(503);res.end('Fixture server not ready');});req.pipe(upstream);});proxy.on('error',()=>void cleanup(1));let ready=false;child.stdout.on('data',chunk=>{process.stdout.write(chunk);if(!ready&&!cleaning&&chunk.toString().includes('Ready in')){ready=true;proxy.listen(3448,'127.0.0.1',()=>console.log(JSON.stringify({isolatedServer:'started',httpsOrigin:'https://127.0.0.1:3448',provider:process.env.AI_PROVIDER??'gemini'})));}});child.stderr.on('data',chunk=>process.stderr.write(chunk));child.on('error',()=>void cleanup(1));
 child.on('exit',()=>{if(!cleaning)void cleanup(1);});
}catch(error){console.log(JSON.stringify({fixtureSetup:'failed',errorType:error.name,code:error.code}));await pool.query('ROLLBACK').catch(()=>{});await cleanup(1);}

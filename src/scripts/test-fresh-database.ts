import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes} from 'node:crypto';
import {Client} from 'pg';
import {setupFreshDatabase} from './setup-fresh-db';
const run=promisify(execFile),bin='/usr/lib/postgresql/18/bin/';
async function main(){
const root=await mkdtemp('/tmp/msai-fresh-'),data=root+'/data',socket=root+'/socket',name='msai_fresh_'+randomBytes(8).toString('hex');
let started=false;
function url(database:string,user='fresh_admin'){const u=new URL('postgresql://'+user+'@localhost/'+database);u.searchParams.set('host',socket);return u.toString();}
try{
 await mkdir(socket,{mode:0o700});
 await run(bin+'initdb',['-D',data,'--username=fresh_admin','--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale']);
 await run(bin+'pg_ctl',['-D',data,'-l',root+'/server.log','-o',`-c listen_addresses='' -c unix_socket_directories='${socket}' -c unix_socket_permissions=0700`,'-w','start']);started=true;
 const admin=new Client({connectionString:url('postgres')});await admin.connect();
 try{await admin.query(`CREATE DATABASE ${name}`);}finally{await admin.end();}
 const result=await setupFreshDatabase({targetURL:url(name),confirmation:name,originalURL:process.env.DATABASE_URL});
 const db=new Client({connectionString:url(name)});await db.connect();
 try{
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
 if(tables.length!==12)throw Error('Unexpected table count');
 await db.query('CREATE ROLE fresh_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE');
 await db.query(`REVOKE ALL ON DATABASE ${name} FROM PUBLIC`);await db.query(`GRANT CONNECT,TEMP ON DATABASE ${name} TO fresh_app`);
 await db.query('GRANT USAGE ON SCHEMA public TO fresh_app');await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO fresh_app');await db.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO fresh_app');
 const vector=(await db.query("SELECT format_type(a.atttypid,a.atttypmod) AS type FROM pg_attribute a WHERE a.attrelid='document_chunks'::regclass AND a.attname='embedding'")).rows[0].type;
 const indexes=(await db.query("SELECT indexname FROM pg_indexes WHERE schemaname='public'")).rows.map(r=>r.indexname);
 for(const index of ['document_chunks_fts_english_idx','documents_active_owner_hash_idx','users_email_normalized_idx'])if(!indexes.includes(index))throw Error('Required index missing');
 if(vector!=='vector(768)')throw Error('Embedding shape differs');
 const foreignKeys=Number((await db.query("SELECT count(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace")).rows[0].count);
 if(foreignKeys<10)throw Error('Missing ownership relationships');
 console.log(JSON.stringify({stage:'fresh-schema',tables:tables.length,foreignKeys,embedding:vector,requiredIndexes:'present',...result}));
 }finally{await db.end();}
 const app=new Client({connectionString:url(name,'fresh_app')});await app.connect();
 try{const privileges=(await app.query("SELECT rolsuper,rolcreatedb,rolcreaterole,has_schema_privilege(current_user,'public','CREATE') AS schema_create FROM pg_roles WHERE rolname=current_user")).rows[0];if(Object.values(privileges).some(Boolean))throw Error('Runtime role has excessive privileges');}finally{await app.end();}
 let refused=false;try{await setupFreshDatabase({targetURL:url(name),confirmation:name});}catch{refused=true;}if(!refused)throw Error('Nonempty rerun was accepted');
 const env:NodeJS.ProcessEnv={...process.env,DATABASE_URL:url(name,'fresh_app'),RUN_CSV_LIFECYCLE_DB_TESTS:'1',RUN_AUTH_DB_TESTS:'1',RUN_LIFECYCLE_DB_TESTS:'1',RUN_SEARCH_DB_TESTS:'1',RUN_EVAL_DB_TESTS:'1'};
 delete env.GROQ_API_KEY;delete env.GOOGLE_GENERATIVE_AI_API_KEY;
 let tests;try{tests=await run('npm',['test'],{env,maxBuffer:16*1024*1024});}catch(error){const failed=error as {stdout?:string;stderr?:string};await writeFile('/tmp/day10-fresh-tests.log',(failed.stdout??'')+(failed.stderr??''),{mode:0o600});throw Error('Fictional regression suite failed; inspect /tmp/day10-fresh-tests.log.');}await writeFile('/tmp/day10-fresh-tests.log',tests.stdout+tests.stderr,{mode:0o600});console.log(tests.stdout.slice(-600));
 console.log(JSON.stringify({freshDatabase:'passed',nonemptyRerun:'refused',liveProviderCalls:0}));
}finally{
 if(started)await run(bin+'pg_ctl',['-D',data,'-w','stop','-m','fast']);
 await rm(root,{recursive:true,force:true});console.log(JSON.stringify({temporaryCluster:'removed'}));
}

}
main().catch(()=>{console.error("Fresh database verification failed; inspect safe test results. No connection details logged.");process.exitCode=1;});

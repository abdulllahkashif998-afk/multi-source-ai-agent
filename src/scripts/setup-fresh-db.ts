import {Client} from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function validateFreshTarget(target:string|undefined,confirmation:string|undefined,original?:string){
 if(!target||!confirmation)throw Error('FRESH_DATABASE_URL and --confirm-empty-database are required.');
 const url=new URL(target),name=decodeURIComponent(url.pathname.slice(1));
 if(!['postgres:','postgresql:'].includes(url.protocol)||!/^[a-z][a-z0-9_]{0,62}$/.test(name)||name!==confirmation||['postgres','template0','template1'].includes(name))throw Error('Use a confirmed, explicitly named application database.');
 if(original&&decodeURIComponent(new URL(original).pathname.slice(1))===name)throw Error('Fresh setup refuses the configured application database name.');
 return name;
}
export function orderedMigrationNames(files:string[]){
 const names=files.filter(f=>/^\d{3}-[a-z0-9-]+\.sql$/.test(f)).sort();
 if(names.length!==9||names.some((name,i)=>!name.startsWith(String(i+1).padStart(3,'0')+'-')))throw Error('Expected the complete ordered migration sequence 001 through 009.');
 return names;
}
export async function setupFreshDatabase(options:{targetURL:string;confirmation:string;originalURL?:string;directory?:string}){
 const name=validateFreshTarget(options.targetURL,options.confirmation,options.originalURL),directory=path.resolve(options.directory??'migrations');
 const files=orderedMigrationNames(await readdir(directory));
 const sql=await Promise.all(files.map(file=>readFile(path.join(directory,file),'utf8')));
 const client=new Client({connectionString:options.targetURL,connectionTimeoutMillis:5000});let locked=false;
 try{
 await client.connect();
 const actual=(await client.query('SELECT current_database() AS name')).rows[0].name;if(actual!==name)throw Error('Connected database differs from confirmation.');
 await client.query("SET search_path=public,pg_catalog");await client.query("SET statement_timeout='60s'");await client.query("SET lock_timeout='5s'");
 locked=(await client.query('SELECT pg_try_advisory_lock(71010003) AS locked')).rows[0].locked;if(!locked)throw Error('Another fresh setup is running.');
 const existing=await client.query("SELECT 1 FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND r.relkind IN ('r','p','v','m','S','f') LIMIT 1");
 const schemas=await client.query("SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%' LIMIT 1");
 if(existing.rowCount||schemas.rowCount)throw Error('Fresh setup requires an empty database; existing objects were not changed.');
 for(const text of sql)await client.query(text); // No outer transaction: 007 is CONCURRENTLY.
 const version=(await client.query("SELECT extversion FROM pg_extension WHERE extname='vector'")).rows[0]?.extversion;
 return {applied:files,vectorVersion:version};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{if(locked)await client.query('SELECT pg_advisory_unlock(71010003)').catch(()=>{});await client.end();}
}
async function main(){
 const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--confirm-empty-database')throw Error('Use --confirm-empty-database NAME.');
 const result=await setupFreshDatabase({targetURL:process.env.FRESH_DATABASE_URL??'',confirmation:args[1],originalURL:process.env.DATABASE_URL});
 console.log(JSON.stringify({freshSetup:'complete',migrations:result.applied,vectorVersion:result.vectorVersion}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{console.error('Fresh setup refused or failed. Verify target, empty schema, privileges and migration state. No connection string or raw database error was logged. Partial setup is not reset automatically.');process.exitCode=1;});

import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function secretCategories(text:string){
 const rules:Record<string,RegExp>={googleKey:/AIza[\w-]{30,}/,groqKey:/gsk_[A-Za-z0-9]{20,}/,privateKey:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,databaseCredential:/postgres(?:ql)?:\/\/[^\s:@/]+:([^\s@]+)@/g};
 return Object.entries(rules).filter(([name,rule])=>name==='databaseCredential'?[...text.matchAll(rule)].some(m=>!/(REPLACE|PASSWORD|placeholder|fictional|example|test)/i.test(m[1])):rule.test(text)).map(([name])=>name);
}
function git(args:string[]){return execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024});}
export function checkRepository(){
 const tracked=git(['ls-files','-z']).split('\0').filter(Boolean),files=git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
 const findings:{file:string;category:string}[]=[];
 for(const file of files){const data=readFileSync(file);if(data.includes(0))continue;for(const category of secretCategories(data.toString()))findings.push({file,category});}
 const ignored=['.env.local','storage/uploads/test.pdf','private.pdf','private.docx','private.csv','private.key','backup.sql','.aws/credentials','.codex/config.toml'];
 for(const file of ignored){try{git(['check-ignore','--no-index','-q','--',file]);}catch{findings.push({file,category:'missing-ignore'});}}
 for(const file of ['.env.example','migrations/001-vector-extension.sql','tests/fixtures/fictional-policy.pdf']){try{git(['check-ignore','--no-index','-q','--',file]);findings.push({file,category:'required-file-ignored'});}catch{}}
 let historyBlobs=0;
 for(const line of git(['rev-list','--objects','--all']).trim().split('\n')){const oid=line.split(' ')[0];if(!oid)continue;if(git(['cat-file','-t',oid]).trim()!=='blob')continue;historyBlobs++;const text=git(['cat-file','-p',oid]);for(const category of secretCategories(text))findings.push({file:'git-history-blob',category});}
 return {trackedFiles:tracked.length,scannedFiles:files.length,historyBlobs,findings,applicationSourceTracked:tracked.some(f=>f.startsWith('src/lib/'))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const result=checkRepository();console.log(JSON.stringify(result));if(result.findings.length)process.exitCode=1;}catch{console.error('Repository check failed; no file content was logged.');process.exitCode=1;}}

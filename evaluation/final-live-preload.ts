import {writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {guardedLiveFetch,type LiveLedger} from './live-request-guard';
const filename=path.resolve(process.env.FINAL_LIVE_LEDGER??'');
const root=path.resolve('.evaluation-results/final-live');
if(!filename.startsWith(root+path.sep)||process.env.ALLOW_LIVE_AI_EVAL!=='1')throw Error('Explicit guarded evaluation configuration required');
const ledger:LiveLedger={attempts:[],stopReason:null};
const save=async()=>{await writeFile(filename+'.tmp',JSON.stringify(ledger,null,2)+'\n',{mode:0o600});await rename(filename+'.tmp',filename);};
globalThis.fetch=guardedLiveFetch({fetch:globalThis.fetch,ollamaOrigin:new URL(process.env.OLLAMA_BASE_URL??'http://localhost:11434').origin,maxAttempts:Number(process.env.FINAL_LIVE_MAX_ATTEMPTS),tokenAllowance:Number(process.env.FINAL_LIVE_TOKEN_ALLOWANCE),ledger,save});
